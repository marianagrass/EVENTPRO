/* ==========================================================
   config/business.js — Constantes del negocio en UN solo lugar.
   Cámbialas aquí (o con variables de entorno) sin tocar la lógica.
   ========================================================== */
const num = (name, fallback) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && process.env[name] !== undefined && process.env[name] !== "" ? v : fallback;
};

module.exports = {
  /* ----- P(x) = (B·x·C) − D(p) ----- */
  checkout: {
    maxTicketsPerOrder: 6,           // x máximo por compra
  },

  /* ----- D(p): descuento por fidelización + oferta de "nuevo ingreso" ----- */
  loyalty: {
    earnEveryCop: 1000,              // 1 punto por cada $1.000 pagados (se redondea hacia abajo)
    copPerPoint: 25,                 // 1 punto canjeado = $25 de descuento
    maxPointsDiscountShare: 0.30,    // los puntos pueden cubrir como máximo el 30 % del subtotal
  },
  welcome: {
    discountShare: 0.10,             // 10 % de descuento en la primera compra de una cuenta nueva
  },
  maxTotalDiscountShare: 0.50,       // sumando todo, nunca más del 50 % del subtotal

  /* ----- Aforo (límite por la izquierda). Debe coincidir con sales_state_for() de 004_payments.sql ----- */
  capacity: {
    lastSpotsShare: 0.10,            // "Últimos cupos" cuando quedan ≤ max(1, ⌈10 % del aforo⌉)
  },

  /* ----- Precios dinámicos: dI/dt y máximos locales ----- */
  dynamicPricing: {
    bucketMinutes: num("DYNPRICE_BUCKET_MIN", 60),   // ancho Δt de cada muestra de ingresos
    windowBuckets: 24,               // cuántas muestras recientes se analizan
    minRateCopPerHour: num("DYNPRICE_MIN_RATE", 150000), // un pico solo cuenta si dI/dt ≥ esto
    peakVsMeanFactor: 1.25,          // …y supera 1.25 veces el promedio de la ventana
    stepShare: 0.05,                 // sube/baja el precio en pasos de 5 %
    maxIncreaseShare: 0.30,          // nunca más de +30 % sobre el precio base del Agente
    coolDownFactor: 0.5,             // si dI/dt < 0.5 × promedio, el precio vuelve a bajar un paso
    cooldownMinutes: num("DYNPRICE_COOLDOWN_MIN", 60),    // mínimo entre dos ajustes del mismo evento
    roundToCop: 500,
  },

  /* ----- Modelo de saturación: T(x) = k/(C − x) + Tb ----- */
  traffic: {
    C: num("TRAFFIC_C", 100),        // capacidad máxima de conexiones simuladas
    k: num("TRAFFIC_K", 200),        // constante de procesamiento (ms·usuarios)
    Tb: num("TRAFFIC_TB", 120),      // tiempo de respuesta base (ms)
    criticalDT: num("TRAFFIC_DT_CRITICAL", 0.5),  // umbral crítico de T'(x) en ms por usuario adicional
    sessionTtlS: num("TRAFFIC_SESSION_TTL", 300), // cuánto dura un turno de pago
    queueStaleS: num("TRAFFIC_QUEUE_STALE", 20),  // quien deja de consultar la fila pierde su lugar
    avgSessionS: num("TRAFFIC_AVG_SESSION", 90),  // para estimar la espera
    simulationEnabled: process.env.TRAFFIC_SIM !== "off",
  },
};
