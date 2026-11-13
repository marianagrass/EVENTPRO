/* ==========================================================
   controllers/priceSuggestionController.js — «Precio ideal» para el Agente (cálculo diferencial)

   POST /api/events/price-suggestion
     { capacity, typeCode?, eventId?, currentPrice?, M?, k? }

   1) Lee de la BD los eventos pagos (precio_base, capacidad_total y entradas vendidas) del mismo tipo, si se indicó.
   2) Estima M y k (regresión; o estimación inicial; o los valores que fijó el Agente).
   3) Modela D(x) = M − kx, I(x) = Mx − kx², deriva I′(x) = M − 2kx, resuelve I′(x) = 0 → x* = M/2k
      y exige I″(x) = −2k < 0 antes de recomendar nada (lib/optimization.js).
   No modifica ningún dato: solo sugiere. El Agente decide si usa el precio.
   ========================================================== */
const { priceOptimization: CFG } = require("../config/business");
const opt = require("../lib/optimization");
const { HttpError, isEventCode, handleError } = require("../lib/http-errors");
const { classifyType } = require("../lib/event-presentation");

const toNumberOrNull = (v, field) => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  if (!Number.isFinite(n)) throw new HttpError(`El valor de ${field} no es un número válido.`, 400);
  return n;
};

module.exports = function priceSuggestionController({ models }) {
  /** Eventos pagos del mismo tipo (sin el evento que se está editando ni los cancelados). El tipo se deriva del nombre
   *  del evento (lib/event-presentation.js) porque el ER no guarda «tipo». Sin tipo, se usan todos los eventos pagos. */
  async function history(typeCode, excludeId) {
    const rows = await models.precio.historialDeVentas(excludeId);
    return rows
      .filter((x) => !typeCode || classifyType(x.name, x.description) === typeCode)
      .map((x) => ({ price: Number(x.price), capacity: Number(x.capacity), registered: Number(x.registered) }));
  }

  /** Núcleo sin HTTP (lo usan las pruebas): devuelve el análisis completo. */
  async function compute(body = {}) {
    const typeCode = typeof body.typeCode === "string" ? body.typeCode.trim() : "";    // opcional: sin tipo se usa todo el historial
    if (typeCode.length > 40) throw new HttpError("Tipo de evento inválido.", 400);
    const capacity = Number(body.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > CFG.maxCapacity) throw new HttpError(`El aforo debe ser un número entero entre 1 y ${CFG.maxCapacity}.`, 400);
    const eventId = body.eventId ? (isEventCode(body.eventId) ? body.eventId : (() => { throw new HttpError("Identificador de evento inválido.", 400); })()) : null;
    const currentPrice = toNumberOrNull(body.currentPrice, "el precio actual");
    const manual = { M: toNumberOrNull(body.M, "M"), k: toNumberOrNull(body.k, "k") };
    if (manual.M !== null && manual.M <= 0) throw new HttpError("El mercado máximo M debe ser mayor que 0.", 400, "INVALID_M");
    if (manual.k !== null && manual.k <= 0) throw new HttpError("La sensibilidad k debe ser mayor que 0.", 400, "INVALID_K");

    const hist = await history(typeCode, eventId);
    const est = opt.estimateDemandModel({ history: hist, capacity, manual });
    let analysis;
    try { analysis = opt.recommendPrice({ M: est.M, k: est.k }, capacity); }
    catch (e) { if (e.name === "OptimizationError") throw new HttpError(e.message, e.status, e.code); throw e; }

    const rec = analysis.recommended.price;
    const warnings = [];
    if (est.observedPriceRange && (rec < est.observedPriceRange.min * 0.5 || rec > est.observedPriceRange.max * 1.5)) {
      warnings.push(`El precio sugerido queda lejos de lo que has cobrado antes (${est.observedPriceRange.min.toLocaleString("es-CO")} – ${est.observedPriceRange.max.toLocaleString("es-CO")}): el modelo extrapola, úsalo con cautela.`);
    }
    if (analysis.capacityBinding) warnings.push("Con el aforo de este evento se llenaría antes de llegar al punto crítico, así que el precio recomendado sube hasta el mínimo que no lo sobrepasa.");
    if (est.note) warnings.push(est.note);

    const compare = currentPrice !== null && currentPrice >= 0
      ? (() => {
          const now = opt.expectedAt(currentPrice, analysis.model, capacity);
          const best = analysis.recommended;
          return { currentPrice, expectedTickets: now.tickets, expectedRevenue: now.revenue,
                   gainCop: best.expectedRevenue - now.revenue, gainShare: now.revenue > 0 ? (best.expectedRevenue - now.revenue) / now.revenue : null };
        })()
      : null;

    return {
      model: { M: round(est.M), k: Number(est.k.toPrecision(6)), zeroDemandPrice: Math.round(analysis.zeroDemandPrice), source: est.source, confidence: est.confidence,
               samples: est.samples, r2: est.r2, observedPriceRange: est.observedPriceRange, auto: { M: round(est.auto.M), k: Number(est.auto.k.toPrecision(6)) } },
      steps: analysis.steps,
      optimum: { ...analysis.optimum, price: Math.round(analysis.optimum.price * 100) / 100 },
      guarantee: analysis.guarantee,
      recommended: { ...analysis.recommended, capacityBinding: analysis.capacityBinding },
      compare,
      curve: curvePoints(analysis, currentPrice),
      warnings,
    };
  }

  const round = (v) => Math.round(v * 100) / 100;

  /** Puntos de I(x) para dibujar la parábola (de 0 a M/k). */
  function curvePoints(a, currentPrice) {
    const { M, k } = a.model, top = M / k, n = 48;
    const xs = Array.from({ length: n + 1 }, (_, i) => (top * i) / n);
    return { xs: xs.map(Math.round), revenue: xs.map((x) => Math.round(opt.revenue(x, a.model))), maxX: Math.round(top), currentPrice: currentPrice ?? null };
  }

  const suggest = async (req, res) => {
    try { res.json(await compute(req.body)); } catch (e) { handleError(res, e, "POST /events/price-suggestion"); }
  };

  return { suggest, compute };
};
