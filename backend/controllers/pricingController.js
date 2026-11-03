/* ==========================================================
   controllers/pricingController.js — Precios dinámicos (derivada de los ingresos)
   Lee las ventas recientes del evento en intervalos de Δt, arma la serie de ingresos, la deriva
   (dI/dt), busca máximos locales y, si corresponde, mueve events.price_cop (nunca base_price_cop).
   ========================================================== */
const { dynamicPricing } = require("../config/business");
const { evaluateDynamicPrice } = require("../lib/pricing");
const { HttpError, isUuid, handleError } = require("../lib/http-errors");

module.exports = function pricingController({ pool }) {
  /** Ingresos por intervalo, desde (N−1) intervalos atrás hasta el último intervalo COMPLETO. */
  async function revenueSeries(eventId, nowMs, opts) {
    const bucketSec = opts.bucketMinutes * 60;
    const nowSec = Math.floor(nowMs / 1000);
    const lastComplete = Math.floor(nowSec / bucketSec) * bucketSec - bucketSec;   // inicio del último intervalo completo
    const n = opts.windowBuckets + 1;                                              // +1 para poder confirmar un máximo
    const first = lastComplete - (n - 1) * bucketSec;
    const r = await pool.query(
      `SELECT FLOOR(EXTRACT(EPOCH FROM registered_at) / $2)::BIGINT AS b, SUM(price_paid_cop)::BIGINT AS rev
         FROM attendees
        WHERE event_id = $1 AND status IN ('confirmado', 'pendiente')
          AND registered_at >= to_timestamp($3) AND registered_at < to_timestamp($4)
        GROUP BY 1`,
      [eventId, bucketSec, first, lastComplete + bucketSec]);
    const series = new Array(n).fill(0);
    for (const row of r.rows) {
      const idx = Number(row.b) - Math.floor(first / bucketSec);
      if (idx >= 0 && idx < n) series[idx] = Number(row.rev);
    }
    return { series, from: first, to: lastComplete + bucketSec };
  }

  async function evaluateEvent(eventId, { apply = true, now = Date.now(), opts = dynamicPricing } = {}) {
    const evr = await pool.query("SELECT id, name, price_cop, base_price_cop, sales_state, availability, status FROM events WHERE id = $1", [eventId]);
    if (!evr.rows.length) throw new HttpError("Evento no encontrado.", 404);
    const ev = evr.rows[0];

    const { series } = await revenueSeries(eventId, now, opts);
    const lastAdj = await pool.query("SELECT created_at FROM price_adjustments WHERE event_id = $1 ORDER BY created_at DESC LIMIT 1", [eventId]);
    const minutesSince = lastAdj.rows.length ? (now - new Date(lastAdj.rows[0].created_at).getTime()) / 60000 : Infinity;

    const decision = evaluateDynamicPrice({
      basePrice: ev.base_price_cop, currentPrice: ev.price_cop, revenuePerBucket: series,
      bucketMinutes: opts.bucketMinutes, salesState: ev.sales_state, minutesSinceLastAdjustment: minutesSince, opts,
    });

    let applied = false;
    const closed = ev.availability !== "open" || ["completado", "cancelado"].includes(ev.status);
    if (apply && decision.action !== "hold" && !closed) {
      // UPDATE condicionado: si otro proceso ya cambió el precio, no se pisa
      const up = await pool.query("UPDATE events SET price_cop = $2 WHERE id = $1 AND price_cop = $3", [eventId, decision.newPrice, ev.price_cop]);
      applied = (up.rowCount ?? 0) > 0;
      if (applied) {
        await pool.query(
          "INSERT INTO price_adjustments (event_id, old_price_cop, new_price_cop, reason, demand_rate_cop) VALUES ($1, $2, $3, $4, $5)",
          [eventId, ev.price_cop, decision.newPrice, decision.reason, decision.peakRate ?? null]);
      }
    }
    return {
      event: { id: ev.id, name: ev.name, basePriceCop: ev.base_price_cop, currentPriceCop: applied ? decision.newPrice : ev.price_cop, maxPriceCop: decision.maxPrice },
      bucketMinutes: opts.bucketMinutes,
      decision: { action: decision.action, reason: decision.reason, newPriceCop: decision.newPrice, applied },
      analysis: { ratesCopPerHour: (decision.rates || []).map((v) => Math.round(v)), peaks: decision.peaks || [], meanRate: Math.round(decision.meanRate || 0), lastRate: Math.round(decision.lastRate || 0) },
    };
  }

  /** Revisión periódica: evalúa todos los eventos de pago que siguen abiertos (la lanza server.js). */
  async function evaluateAllOpen(now = Date.now()) {
    const r = await pool.query("SELECT id FROM events WHERE availability = 'open' AND status NOT IN ('completado', 'cancelado') AND base_price_cop > 0");
    const out = [];
    for (const row of r.rows) {
      try { const res = await evaluateEvent(row.id, { apply: true, now }); if (res.decision.applied) out.push(res); }
      catch (e) { console.error("[precios dinámicos]", row.id, e.message); }
    }
    return out;
  }

  /* ----- HTTP ----- */
  async function show(req, res) {
    try {
      if (!isUuid(req.params.id)) throw new HttpError("Identificador inválido.", 400);
      const result = await evaluateEvent(req.params.id, { apply: false });
      const hist = await pool.query("SELECT old_price_cop, new_price_cop, reason, demand_rate_cop, created_at FROM price_adjustments WHERE event_id = $1 ORDER BY created_at DESC LIMIT 5", [req.params.id]);
      res.json({ ...result, adjustments: hist.rows });
    } catch (e) { handleError(res, e, "pricing.show"); }
  }
  async function evaluate(req, res) {
    try {
      if (!isUuid(req.params.id)) throw new HttpError("Identificador inválido.", 400);
      res.json(await evaluateEvent(req.params.id, { apply: true }));
    } catch (e) { handleError(res, e, "pricing.evaluate"); }
  }

  return { evaluateEvent, evaluateAllOpen, revenueSeries, show, evaluate };
};
