/* ==========================================================
   controllers/checkoutController.js — Cotización y pago de una reserva
     POST /api/checkout/quote   calcula P(x) sin cobrar (para mostrar el resumen en vivo)
     POST /api/checkout         cobra (pasarela simulada) y guarda la compra en PostgreSQL
     GET  /api/zones            zonas y coeficientes C
   Ambas rutas de checkout pasan antes por el middleware de fila virtual.
   ========================================================== */
const { totalCost } = require("../lib/pricing");
const { checkCapacity } = require("../lib/capacity");
const gateway = require("../lib/payment-gateway");
const { HttpError, isUuid, handleError } = require("../lib/http-errors");
const { checkout: checkoutCfg } = require("../config/business");

module.exports = function checkoutController({ pool, traffic, onSale = () => {} }) {
  /** Lee todo lo necesario para calcular P(x) y valida que la compra sea posible. */
  async function loadContext({ eventId, userId }) {
    if (!isUuid(eventId) || !isUuid(userId)) throw new HttpError("Evento o usuario inválido.", 400);
    const [evR, zonesR, userR] = await Promise.all([
      pool.query(
        `SELECT e.id, e.name, e.price_cop, e.base_price_cop, e.capacity, e.status, e.availability, e.sales_state,
                (SELECT COUNT(*) FROM attendees a WHERE a.event_id = e.id AND a.status IN ('confirmado', 'pendiente'))::INT AS registered
           FROM events e WHERE e.id = $1`, [eventId]),
      pool.query("SELECT code, label, coefficient FROM zones ORDER BY sort_order"),
      pool.query("SELECT id, name, status, loyalty_points, is_new_member(id) AS is_new FROM users WHERE id = $1", [userId]),
    ]);
    const ev = evR.rows[0], user = userR.rows[0];
    if (!ev) throw new HttpError("Este evento ya no está disponible.", 404);
    if (!user) throw new HttpError("Tu cuenta no existe en la base de datos. Cierra sesión e inicia con una cuenta registrada.", 404, "NO_ACCOUNT");
    if (user.status !== "activo") throw new HttpError("Esta cuenta no puede inscribirse.", 403);
    if (ev.availability !== "open" || ["completado", "cancelado"].includes(ev.status)) throw new HttpError("Las inscripciones de este evento no están abiertas.", 409);
    const dup = await pool.query("SELECT 1 FROM attendees WHERE event_id = $1 AND user_id = $2 AND status <> 'cancelado' LIMIT 1", [eventId, userId]);
    if (dup.rows.length) throw new HttpError("Ya estás inscrito en este evento.", 409);
    return { ev, user, zones: zonesR.rows };
  }

  function buildQuote(ctx, { quantity = 1, zone = "general", usePoints = false }) {
    const q = Number(quantity);
    const cap = checkCapacity(ctx.ev.capacity, ctx.ev.registered, q);
    if (!cap.ok) throw new HttpError(cap.message, 409, "NO_CAPACITY");
    return totalCost({
      basePrice: ctx.ev.price_cop, quantity: q, zone, zones: ctx.zones,
      pointsBalance: ctx.user.loyalty_points, usePoints: !!usePoints, isNewMember: ctx.user.is_new,
    });
  }

  async function quote(req, res) {
    try {
      const b = req.body || {};
      const ctx = await loadContext(b);
      const spotsLeft = Math.max(0, ctx.ev.capacity - ctx.ev.registered);
      const q = buildQuote(ctx, b);
      res.json({
        event: { id: ctx.ev.id, name: ctx.ev.name, unitPriceCop: ctx.ev.price_cop, basePriceCop: ctx.ev.base_price_cop, capacity: ctx.ev.capacity, registered: ctx.ev.registered, spotsLeft, salesState: ctx.ev.sales_state },
        zones: ctx.zones.map((z) => ({ code: z.code, label: z.label, coefficient: Number(z.coefficient), unitPriceCop: Math.round(ctx.ev.price_cop * Number(z.coefficient)) })),
        user: { pointsBalance: ctx.user.loyalty_points, isNewMember: ctx.user.is_new },
        limits: { maxQuantity: Math.min(checkoutCfg.maxTicketsPerOrder, spotsLeft) },
        quote: q,
      });
    } catch (e) { handleError(res, e, "checkout.quote"); }
  }

  async function pay(req, res) {
    let auth = null;
    try {
      const b = req.body || {};
      const ctx = await loadContext(b);
      const q = buildQuote(ctx, b);

      // 1) cobro en la pasarela (simulada). Si el total es $0 (evento gratis o 100 % cubierto) no hay cobro.
      auth = gateway.authorize({ type: q.total > 0 ? (b.method && b.method.type) : "gratis", amount: q.total, ...(b.method || {}) });

      // 2) guardar la compra: una sola transacción en la base (revalida precio, aforo y puntos bajo bloqueo)
      let row;
      try {
        const r = await pool.query(
          "SELECT * FROM confirm_checkout($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
          [ctx.ev.id, ctx.user.id, q.quantity, q.zone, q.unitPrice, q.coefficient, q.subtotal,
            q.pointsUsed, q.loyaltyDiscount, q.welcomeDiscount, q.total, q.pointsEarned,
            auth.method, auth.brand, auth.last4]);
        row = r.rows[0];
      } catch (dbErr) {
        gateway.voidAuthorization(auth.approvalId);          // la base rechazó: se anula el cobro
        throw dbErr;
      }

      if (req.queueTicket) traffic.release(req.queueTicket); // libera el turno de pago
      const st = await pool.query("SELECT sales_state FROM events WHERE id = $1", [ctx.ev.id]);
      Promise.resolve(onSale(ctx.ev.id)).catch(() => {});    // el algoritmo de precios revisa la nueva venta

      res.status(201).json({
        success: true,
        payment: {
          id: row.payment_id, code: row.code, eventId: ctx.ev.id, eventName: ctx.ev.name,
          quantity: q.quantity, zone: q.zone, coefficient: q.coefficient, unitPriceCop: q.unitPrice,
          subtotalCop: q.subtotal, loyaltyDiscountCop: q.loyaltyDiscount, welcomeDiscountCop: q.welcomeDiscount,
          pointsUsed: q.pointsUsed, totalCop: q.total, formula: q.formula,
          method: auth.method, brand: auth.brand, last4: auth.last4,
          pointsEarned: row.points_earned, pointsBalance: row.new_balance,
        },
        salesState: st.rows[0] ? st.rows[0].sales_state : null,
      });
    } catch (e) { handleError(res, e, "checkout.pay"); }
  }

  async function zones(_req, res) {
    try {
      const r = await pool.query("SELECT code, label, coefficient FROM zones ORDER BY sort_order");
      res.json(r.rows.map((z) => ({ ...z, coefficient: Number(z.coefficient) })));
    } catch (e) { handleError(res, e, "zones"); }
  }

  /** Cancelación con reembolso simulado y reversión de puntos (reemplaza al antiguo /api/unregister) */
  async function cancel(req, res) {
    try {
      const { eventId, userId } = req.body || {};
      if (!isUuid(eventId) || !isUuid(userId)) throw new HttpError("Evento o usuario inválido.", 400);
      await pool.query("SELECT cancel_registration($1, $2)", [eventId, userId]);
      res.json({ success: true });
    } catch (e) { handleError(res, e, "checkout.cancel"); }
  }

  return { quote, pay, zones, cancel, loadContext, buildQuote };
};
