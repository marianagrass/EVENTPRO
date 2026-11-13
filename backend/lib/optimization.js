/* ==========================================================
   lib/optimization.js — Precio ideal del boleto con cálculo diferencial

   Demanda lineal (boletos que se venden al precio x):      D(x) = M − k·x
        M = mercado máximo (personas que irían si fuera gratis) · k = sensibilidad al precio (boletos que se pierden por cada $1 más)
   Ingresos:                                                 I(x) = x·D(x) = M·x − k·x²
   Primera derivada (tasa de cambio de los ingresos):        I′(x) = M − 2k·x
   Punto crítico (I′(x) = 0 ⇒ M − 2k·x = 0):                 x* = M / (2k)
   Segunda derivada (criterio de la 2ª derivada):            I″(x) = −2k  < 0  ⇒ parábola cóncava hacia abajo ⇒ x* es un MÁXIMO
        Como I″ es constante y negativa en todo ℝ, el máximo es GLOBAL (no solo local).
   Ingreso máximo:                                           I(x*) = M² / (4k)      ·  demanda en el óptimo: D(x*) = M/2

   Todo son funciones puras (sin base de datos): el controlador solo les pasa números.
   ========================================================== */
const { priceOptimization: CFG } = require("../config/business");

class OptimizationError extends Error {
  constructor(message, code = "INVALID_MODEL", status = 422) { super(message); this.name = "OptimizationError"; this.code = code; this.status = status; }
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const round2 = (v) => Math.round(v * 100) / 100;

/* ---------- Las cuatro funciones del modelo ---------- */
const demand = (x, { M, k }) => M - k * x;                    // D(x)
const revenue = (x, { M, k }) => M * x - k * x * x;           // I(x) = x(M − kx)
const revenueFirstDerivative = (x, { M, k }) => M - 2 * k * x; // I′(x)
const revenueSecondDerivative = ({ k }) => -2 * k;            // I″(x) (no depende de x)

/** Valida el modelo: M y k deben ser números positivos. Si k ≤ 0, I″ ≥ 0 y NO existiría un máximo. */
function assertModel({ M, k }) {
  if (!isNum(M) || M <= 0) throw new OptimizationError("El mercado máximo M debe ser un número mayor que 0.", "INVALID_M");
  if (!isNum(k) || k <= 0) throw new OptimizationError("La sensibilidad k debe ser un número mayor que 0: con k ≤ 0 la segunda derivada no es negativa y no existe un máximo de ingresos.", "INVALID_K");
}

/**
 * Optimización completa con garantía de la segunda derivada.
 * @returns {{model, steps, optimum, guarantee}}  (lanza OptimizationError si el modelo no cumple I″ < 0)
 */
function optimizeRevenue({ M, k }) {
  assertModel({ M, k });
  const model = { M, k };

  // 1) Punto crítico: igualar I′(x) a cero y despejar
  const critical = M / (2 * k);                               // x* = M / 2k
  const slopeAtCritical = revenueFirstDerivative(critical, model);

  // 2) Criterio de la segunda derivada — validación ESTRICTA
  const second = revenueSecondDerivative(model);              // −2k
  const concaveDown = second < 0;
  if (!concaveDown) throw new OptimizationError("La segunda derivada I″(x) = −2k no es negativa: el punto crítico no es un máximo.", "NOT_A_MAXIMUM");
  if (Math.abs(slopeAtCritical) > 1e-9 * Math.max(1, M)) throw new OptimizationError("El punto crítico no anula la primera derivada.", "NOT_CRITICAL");

  // 3) Comprobación numérica independiente: a ambos lados de x* los ingresos son menores
  const h = Math.max(1, critical * 0.01);
  const peak = revenue(critical, model);
  const left = revenue(critical - h, model), right = revenue(critical + h, model);
  const numericOk = left < peak && right < peak;
  if (!numericOk) throw new OptimizationError("La comprobación numérica no confirmó el máximo.", "NUMERIC_CHECK_FAILED");

  return {
    model,
    // Fórmulas con los números sustituidos (para mostrarlas tal cual en pantalla)
    steps: {
      demand: `D(x) = ${fmt(M)} − ${fmt(k)}·x`,
      revenue: `I(x) = x·(${fmt(M)} − ${fmt(k)}·x) = ${fmt(M)}·x − ${fmt(k)}·x²`,
      firstDerivative: `I′(x) = ${fmt(M)} − ${fmt(2 * k)}·x`,
      criticalEquation: `I′(x) = 0  ⇒  ${fmt(M)} − ${fmt(2 * k)}·x = 0  ⇒  x = M / 2k = ${fmt(M)} / ${fmt(2 * k)}`,
      secondDerivative: `I″(x) = −2k = ${fmt(second)}`,
    },
    optimum: {
      price: critical,                                        // x*
      demand: demand(critical, model),                        // M/2
      revenue: peak,                                          // M²/4k
      firstDerivativeAtCritical: slopeAtCritical,             // = 0
    },
    guarantee: {
      secondDerivative: second,                               // −2k
      isNegative: concaveDown,                                // ¿I″ < 0?
      concaveDown,                                            // parábola abierta hacia abajo
      kind: "maximo_global",
      numericCheck: { h, left, peak, right, ok: numericOk },
      statement: "I″(x) = −2k < 0 en todo x: la parábola es cóncava hacia abajo, así que x* = M/2k es un máximo global absoluto de los ingresos.",
    },
  };
}

/**
 * Del óptimo teórico al precio que se le recomienda al Agente. Tres ajustes honestos:
 *  · Aforo: no se pueden vender más boletos que cupos. Si D(x*) > aforo, I(x) real = x·aforo crece hasta que D(x) = aforo,
 *    así que el precio mínimo útil es (M − aforo)/k y el recomendado es el mayor de los dos.
 *  · Dominio: el precio no puede pasar de M/k (a ese precio la demanda llega a 0).
 *  · Redondeo: se redondea a múltiplos de `roundToCop` eligiendo el vecino que más ingresa.
 */
function recommendPrice({ M, k }, capacity, { roundToCop = CFG.roundToCop } = {}) {
  const opt = optimizeRevenue({ M, k });
  const zeroDemandPrice = M / k;
  const capacityFloor = capacity && M > capacity ? (M - capacity) / k : 0;        // D(x) ≤ aforo ⇔ x ≥ (M − aforo)/k
  const capacityBinding = capacity > 0 && demand(opt.optimum.price, opt.model) > capacity;
  const target = Math.min(Math.max(opt.optimum.price, capacityFloor), zeroDemandPrice);

  const expected = (x) => {
    const tickets = Math.max(0, Math.min(demand(x, opt.model), capacity || Infinity));
    return { tickets, revenue: x * tickets };
  };
  const lo = Math.floor(target / roundToCop) * roundToCop, hi = lo + roundToCop;
  const candidates = [lo, hi].filter((c) => c > 0 && c >= capacityFloor - 1e-9 && c <= zeroDemandPrice);
  const price = candidates.length ? candidates.reduce((best, c) => (expected(c).revenue > expected(best).revenue ? c : best)) : Math.round(target);
  const exp = expected(price);
  return {
    ...opt,
    capacity,
    zeroDemandPrice,
    capacityBinding,
    capacityFloorPrice: capacityFloor,
    recommended: { price, expectedTickets: Math.floor(exp.tickets), expectedRevenue: Math.round(exp.revenue), soldOutExpected: capacity > 0 && exp.tickets >= capacity - 0.5 },
  };
}

/** Ingresos esperados a un precio cualquiera (para comparar con el precio actual del Agente). */
function expectedAt(price, { M, k }, capacity) {
  const tickets = Math.max(0, Math.min(demand(price, { M, k }), capacity || Infinity));
  return { price, tickets: Math.floor(tickets), revenue: Math.round(price * tickets) };
}

/* ==========================================================
   Cómo obtener M y k
   1) Regresión por mínimos cuadrados con eventos PAGOS del mismo tipo: se ajusta  (llenado) = a − b·precio,
      donde llenado = inscritos / aforo (así eventos de distinto tamaño son comparables).  M = a·aforo,  k = b·aforo.
   2) Sin historial confiable: M = marketFactor × aforo y k = M / (precio al que nadie compraría).
   3) El Agente puede fijar M y/o k a mano; lo que no fije se completa con 1) o 2).
   ========================================================== */
function linearFit(points) {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n, my = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of points) { sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my); syy += (p.y - my) ** 2; }
  if (sxx === 0) return null;
  const slope = sxy / sxx, intercept = my - slope * mx;
  const r2 = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2 };
}

function estimateDemandModel({ history = [], capacity, manual = {}, opts = CFG }) {
  if (!isNum(capacity) || capacity < 1) throw new OptimizationError("El aforo debe ser de al menos 1 cupo.", "INVALID_CAPACITY", 400);
  const paid = history.filter((h) => isNum(h.price) && h.price > 0 && isNum(h.capacity) && h.capacity > 0 && isNum(h.registered) && h.registered >= 0);
  const prices = paid.map((h) => h.price);
  const distinct = new Set(prices).size;
  const range = prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null;

  let auto = null, note = "";
  if (paid.length >= opts.minSamples && distinct >= opts.minDistinctPrices) {
    const fit = linearFit(paid.map((h) => ({ x: h.price, y: Math.min(h.registered / h.capacity, 1.5) })));
    if (fit && fit.slope < 0 && fit.intercept > 0 && fit.r2 >= opts.minR2) {
      auto = { M: fit.intercept * capacity, k: -fit.slope * capacity, source: "historial", samples: paid.length, r2: round2(fit.r2) };
    } else note = "Con los eventos anteriores no se ve una curva de demanda clara (a mayor precio no baja la asistencia), así que se usa una estimación inicial.";
  } else note = paid.length ? "Hay pocos eventos pagos del mismo tipo para ajustar la curva; se usa una estimación inicial." : "Aún no hay eventos pagos de este tipo; se usa una estimación inicial.";
  if (!auto) {
    const M = opts.marketFactor * capacity;
    auto = { M, k: M / opts.defaultZeroDemandPriceCop, source: "inicial", samples: paid.length, r2: null };
  }

  const manualM = isNum(manual.M) ? manual.M : null, manualK = isNum(manual.k) ? manual.k : null;
  const M = manualM ?? auto.M;
  let k = manualK ?? auto.k;
  // Si el Agente solo cambió M, se conserva el precio de demanda cero estimado (k = M / (M₀/k₀)) para que el modelo no se desbalancee
  if (manualM !== null && manualK === null) k = manualM / (auto.M / auto.k);
  const source = manualM !== null || manualK !== null ? "manual" : auto.source;

  const confidence = source === "historial" ? (auto.samples >= 8 && auto.r2 >= 0.6 ? "alta" : auto.r2 >= 0.5 ? "media" : "baja") : source === "manual" ? "definida por ti" : "baja";
  return { M, k, source, samples: auto.samples, r2: auto.r2, confidence, observedPriceRange: range, auto: { M: auto.M, k: auto.k, source: auto.source }, note };
}

function fmt(v) {
  if (!isNum(v)) return String(v);
  if (v < 0) return `−${fmt(-v)}`;
  const abs = v;
  const out = abs >= 1000 ? String(Math.round(v * 100) / 100) : String(Number(v.toPrecision(4)));
  return out.replace(".", ",");                                // decimales con coma (es-CO)
}

module.exports = {
  OptimizationError, demand, revenue, revenueFirstDerivative, revenueSecondDerivative,
  optimizeRevenue, recommendPrice, expectedAt, estimateDemandModel, linearFit,
};
