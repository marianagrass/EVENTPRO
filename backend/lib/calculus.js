/* ==========================================================
   lib/calculus.js — Herramientas de cálculo diferencial e integral (funciones puras, sin BD)
   Todo lo que aparece en el informe vive aquí para poder probarlo con números conocidos.
   ========================================================== */

/* ---------- INTEGRALES: área bajo la curva como suma de Riemann ----------
   Dada una función muestreada f(t_i) con paso Δt, la integral ∫ f dt se aproxima con:
     · "riemann"   : Σ f_i · Δt                     (rectángulos; con flujo diario es el total exacto)
     · "trapezoid" : Σ (f_i + f_{i+1})/2 · Δt       (trapecios)
   Con un flujo de ingresos por día (COP/día) y Δt = 1 día, la suma de Riemann reproduce exactamente
   el total de la contabilidad, así que el reporte del Admin siempre cuadra. */
function integrate(samples, dt = 1, method = "riemann") {
  if (!Array.isArray(samples) || samples.length === 0) return 0;
  if (method === "trapezoid") {
    if (samples.length === 1) return 0;
    let area = 0;
    for (let i = 0; i < samples.length - 1; i++) area += ((samples[i] + samples[i + 1]) / 2) * dt;
    return area;
  }
  return samples.reduce((acc, f) => acc + f * dt, 0);
}

/** F(t_n) = ∫_0^{t_n} f dt  — la curva acumulada (primitiva numérica) */
function cumulative(samples, dt = 1) {
  const out = [];
  let acc = 0;
  for (const f of samples) { acc += f * dt; out.push(acc); }
  return out;
}

/* ---------- DERIVADAS ---------- */

/** Derivada por diferencias hacia atrás: f'(t_i) ≈ (F_i − F_{i−1}) / Δt.  El primer punto usa F_{-1} = 0. */
function finiteDifference(values, dt = 1) {
  return values.map((v, i) => (v - (i === 0 ? 0 : values[i - 1])) / dt);
}

/** Máximos locales discretos: i es máximo si f_{i−1} < f_i ≥ f_{i+1} (cambio de signo de f' de + a −). */
function localMaxima(values) {
  const peaks = [];
  for (let i = 1; i < values.length - 1; i++) {
    if (values[i] > values[i - 1] && values[i] >= values[i + 1]) peaks.push(i);
  }
  return peaks;
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/* ---------- MODELO RACIONAL DE LATENCIA ----------
     T(x)  = k / (C − x) + Tb          tiempo de respuesta con x usuarios concurrentes
     T'(x) = k / (C − x)²              cuánto empeora cada usuario adicional
   Cuando x → C⁻ ambas explotan (asíntota vertical): el servidor se satura. */
function latency(x, { C, k, Tb }) {
  if (x >= C) return Infinity;
  return k / (C - x) + Tb;
}
function latencyRate(x, { C, k }) {
  if (x >= C) return Infinity;
  return k / ((C - x) * (C - x));
}

/** Mayor x entero cuya aceleración T'(x) sigue ≤ umbral:  k/(C−x)² ≤ d  ⇔  x ≤ C − √(k/d) */
function maxConcurrentForRate({ C, k }, criticalDT) {
  const x = C - Math.sqrt(k / criticalDT);
  return Math.max(0, Math.floor(x + 1e-9));
}

module.exports = { integrate, cumulative, finiteDifference, localMaxima, mean, latency, latencyRate, maxConcurrentForRate };
