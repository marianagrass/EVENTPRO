/* ==========================================================
   controllers/checkoutController.js — Cotización y pago de una reserva
     POST /api/checkout/quote   calcula P(x) sin cobrar (para mostrar el resumen en vivo)
     POST /api/checkout         cobra (pasarela simulada) y guarda la RESERVA en PostgreSQL
     POST /api/unregister       cancela la reserva de un cliente en un evento (con causa)
     POST /api/reservas/:id/cancel   cancela una reserva por su id (con causa)
     GET  /api/zones            zonas y coeficientes C
   Ambas rutas de checkout pasan antes por el middleware de fila virtual.

   MODELO ER: el cliente es CLIENTE.numero_identificacion y el evento es EVENTO.codigo_evento.
   La matemática (lib/pricing.js · lib/capacity.js · lib/payment-gateway.js) NO cambió: solo cambió de dónde
   salen los datos y dónde se guarda el resultado (RESERVA + reserva_pago).
   ========================================================== */
const { totalCost } = require("../lib/pricing");
const { checkCapacity } = require("../lib/capacity");
const gateway = require("../lib/payment-gateway");
const { HttpError, isId, isEventCode, isPositiveInt, handleError } = require("../lib/http-errors");
const { checkout: checkoutCfg } = require("../config/business");

const ESTADOS_ABIERTOS = ["Disponible", "Últimos cupos", "Agotado"];     // Agotado se rechaza luego por aforo, con su mensaje

module.exports = function checkoutController({ models, traffic, onSale = () => {} }) {
  const { reserva } = models;

  /** Lee todo lo necesario para calcular P(x) y valida que la compra sea posible. */
  async function loadContext({ eventId, userId }) {
    if (!isEventCode(eventId) || !isId(userId)) throw new HttpError("Evento o usuario inválido.", 400);
    const [ctx, zones] = await Promise.all([reserva.contextoCheckout(eventId, userId), reserva.zonas()]);
    const { ev, cliente } = ctx;
    if (!ev) throw new HttpError("Este evento ya no está disponible.", 404);
    if (!cliente) {
      if (await reserva.existePersona(userId)) throw new HttpError("Solo las cuentas de Cliente pueden reservar entradas.", 403);
      throw new HttpError("Tu cuenta no existe en la base de datos. Cierra sesión e inicia con una cuenta registrada.", 404, "NO_ACCOUNT");
    }
    if (!ESTADOS_ABIERTOS.includes(ev.estado) || ev.terminado) throw new HttpError("Las inscripciones de este evento no están abiertas.", 409);
    if (ctx.yaInscrito) throw new HttpError("Ya estás inscrito en este evento.", 409);
    return { ev, user: cliente, zones };
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

      // 2) guardar la RESERVA: una sola transacción en la base (revalida precio, aforo y puntos bajo bloqueo)
      let row;
      try {
        row = await reserva.confirmar({
          codigoEvento: ctx.ev.id, idCliente: ctx.user.id, cantidad: q.quantity, zona: q.zone,
          precioUnitario: q.unitPrice, coeficiente: q.coefficient, subtotal: q.subtotal,
          puntosUsados: q.pointsUsed, descuentoFidelizacion: q.loyaltyDiscount, descuentoBienvenida: q.welcomeDiscount,
          total: q.total, puntosGanados: q.pointsEarned, metodo: auth.method, marca: auth.brand, ultimos4: auth.last4,
        });
      } catch (dbErr) {
        gateway.voidAuthorization(auth.approvalId);          // la base rechazó: se anula el cobro
        throw dbErr;
      }

      if (req.queueTicket) traffic.release(req.queueTicket); // libera el turno de pago
      const salesState = await reserva.estadoVentasEvento(ctx.ev.id);
      Promise.resolve(onSale(ctx.ev.id)).catch(() => {});    // el algoritmo de precios revisa la nueva venta

      res.status(201).json({
        success: true,
        payment: {
          id: row.reserva_id, reservaId: row.reserva_id, code: row.pago_codigo, eventId: ctx.ev.id, eventName: ctx.ev.name,
          quantity: q.quantity, zone: q.zone, coefficient: q.coefficient, unitPriceCop: q.unitPrice,
          subtotalCop: q.subtotal, loyaltyDiscountCop: q.loyaltyDiscount, welcomeDiscountCop: q.welcomeDiscount,
          pointsUsed: q.pointsUsed, totalCop: q.total, formula: q.formula,
          method: auth.method, brand: auth.brand, last4: auth.last4,
          pointsEarned: row.pts_ganados, pointsBalance: row.pts_saldo,
        },
        salesState,
      });
    } catch (e) { handleError(res, e, "checkout.pay"); }
  }

  async function zones(_req, res) {
    try { res.json(await reserva.zonas()); } catch (e) { handleError(res, e, "zones"); }
  }

  const needCausa = (causa) => {
    const c = typeof causa === "string" ? causa.trim() : "";
    if (c.length < 3) throw new HttpError("Indica la causa de la cancelación (mínimo 3 caracteres).", 400, "CAUSA_REQUERIDA");
    if (c.length > 500) throw new HttpError("La causa de la cancelación es demasiado larga (máximo 500 caracteres).", 400);
    return c;
  };

  /** Cancelación con reembolso simulado y reversión de puntos. Pide la causa (RESERVA.causa_cancelacion). */
  async function cancel(req, res) {
    try {
      const { eventId, userId, causa } = req.body || {};
      if (!isEventCode(eventId) || !isId(userId)) throw new HttpError("Evento o usuario inválido.", 400);
      const c = needCausa(causa);
      const activa = await reserva.reservaActiva(eventId, userId);
      if (!activa) throw new HttpError("No tienes una inscripción activa en este evento.", 404);
      await reserva.cancelar(activa.id_reserva, userId, c);
      res.json({ success: true });
    } catch (e) { handleError(res, e, "checkout.cancel"); }
  }

  /** Cancelar una reserva concreta (la hace su dueño, el Agente del evento o un Administrador). */
  async function cancelById(req, res) {
    try {
      const { actorId, causa } = req.body || {};
      if (!isPositiveInt(req.params.id)) throw new HttpError("Identificador de reserva inválido.", 400);
      if (!isId(actorId)) throw new HttpError("Falta indicar quién cancela la reserva.", 400);
      await reserva.cancelar(Number(req.params.id), actorId, needCausa(causa));
      res.json({ success: true });
    } catch (e) { handleError(res, e, "checkout.cancelById"); }
  }

  return { quote, pay, zones, cancel, cancelById, loadContext, buildQuote };
};
