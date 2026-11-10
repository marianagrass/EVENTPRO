/* ==========================================================
   controllers/pricingController.js — Precios dinámicos (derivada de los ingresos)
   Lee las ventas recientes del evento en intervalos de Δt, arma la serie de ingresos, la deriva
   (dI/dt), busca máximos locales y, si corresponde, registra un ajuste en ajuste_precio (el precio_base del Agente nunca se sobrescribe).
   ========================================================== */
const { dynamicPricing } = require("../config/business");
const { evaluateDynamicPrice } = require("../lib/pricing");
const { HttpError, isEventCode, handleError } = require("../lib/http-errors");

module.exports = function pricingController({ models }) {
  const { precio } = models;
  /** Ingresos por intervalo, desde (N−1) intervalos atrás hasta el último intervalo COMPLETO. */
  async function revenueSeries(eventId, nowMs, opts) {
    const bucketSec = opts.bucketMinutes * 60;
    const nowSec = Math.floor(nowMs / 1000);
    const lastComplete = Math.floor(nowSec / bucketSec) * bucketSec - bucketSec;   // inicio del último intervalo completo
    const n = opts.windowBuckets + 1;                                              // +1 para poder confirmar un máximo
    const first = lastComplete - (n - 1) * bucketSec;
    const r = await precio.serieIngresos(eventId, bucketSec, first, lastComplete + bucketSec);
    const series = new Array(n).fill(0);
    for (const row of r) {
      const idx = Number(row.b) - Math.floor(first / bucketSec);
      if (idx >= 0 && idx < n) series[idx] = Number(row.rev);
    }
    return { series, from: first, to: lastComplete + bucketSec };
  }

  async function evaluateEvent(eventId, { apply = true, now = Date.now(), opts = dynamicPricing } = {}) {
    const ev = await precio.eventoParaPrecio(eventId);
    if (!ev) throw new HttpError("Evento no encontrado.", 404);

    const { series } = await revenueSeries(eventId, now, opts);
    const lastAdj = await precio.ultimoAjuste(eventId);
    const minutesSince = lastAdj ? (now - new Date(lastAdj.creado_en).getTime()) / 60000 : Infinity;

    const decision = evaluateDynamicPrice({
      basePrice: ev.base_price_cop, currentPrice: ev.price_cop, revenuePerBucket: series,
      bucketMinutes: opts.bucketMinutes, salesState: ev.sales_state, minutesSinceLastAdjustment: minutesSince, opts,
    });

    let applied = false;
    // «abierto» = Disponible · Últimos cupos · Agotado, y que el evento no haya terminado
    const closed = !["Disponible", "Últimos cupos", "Agotado"].includes(ev.estado) || ev.terminado;
    if (apply && decision.action !== "hold" && !closed) {
      // INSERT condicionado: si otro proceso ya cambió el precio vigente, no se pisa (función SQL aplicar_ajuste_precio)
      applied = await precio.aplicarAjuste(eventId, ev.price_cop, decision.newPrice, decision.reason, decision.peakRate ?? null);
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
    const out = [];
    for (const id of await precio.idsAbiertosDePago()) {
      try { const res = await evaluateEvent(id, { apply: true, now }); if (res.decision.applied) out.push(res); }
      catch (e) { console.error("[precios dinámicos]", id, e.message); }
    }
    return out;
  }

  /* ----- HTTP ----- */
  async function show(req, res) {
    try {
      if (!isEventCode(req.params.id)) throw new HttpError("Identificador inválido.", 400);
      const result = await evaluateEvent(req.params.id, { apply: false });
      res.json({ ...result, adjustments: await precio.historialAjustes(req.params.id, 5) });
    } catch (e) { handleError(res, e, "pricing.show"); }
  }
  async function evaluate(req, res) {
    try {
      if (!isEventCode(req.params.id)) throw new HttpError("Identificador inválido.", 400);
      res.json(await evaluateEvent(req.params.id, { apply: true }));
    } catch (e) { handleError(res, e, "pricing.evaluate"); }
  }

  return { evaluateEvent, evaluateAllOpen, revenueSeries, show, evaluate };
};
