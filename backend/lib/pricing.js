/* ==========================================================
   lib/pricing.js — Motor de precios (funciones puras, sin BD)

     P(x) = (B · x · C) − D(p)

       x    número de entradas
       B    precio base VIGENTE del evento (puede haber subido por el algoritmo de precios dinámicos)
       C    coeficiente de la zona  → función a trozos
              C(general) = 1.00 · C(preferencial) = 1.50 · C(vip) = 2.50      (tabla zones)
       D(p) descuento = puntos de fidelización canjeados + oferta de "nuevo ingreso"

   Todos los valores son pesos enteros (COP no usa decimales).
   ========================================================== */
const { checkout, loyalty, welcome, maxTotalDiscountShare, dynamicPricing } = require("../config/business");
const { cumulative, finiteDifference, localMaxima, mean } = require("./calculus");

class PricingError extends Error {
  constructor(message, status = 422) { super(message); this.name = "PricingError"; this.status = status; }
}

/** Función a trozos: cada zona es un "trozo" con su propio coeficiente. Zona desconocida → error. */
function zoneCoefficient(zone, pieces) {
  for (const piece of pieces) {
    if (piece.code === zone) return Number(piece.coefficient);
  }
  throw new PricingError("La zona seleccionada no es válida.");
}

/** D(p): descuento por puntos. Puntos canjeables = min(saldo, tope del 30 % del subtotal). */
function loyaltyDiscount({ balance, subtotal, usePoints }) {
  if (!usePoints || balance <= 0 || subtotal <= 0) return { pointsUsed: 0, discount: 0 };
  const capByShare = Math.floor((subtotal * loyalty.maxPointsDiscountShare) / loyalty.copPerPoint);
  const pointsUsed = Math.max(0, Math.min(balance, capByShare));
  return { pointsUsed, discount: pointsUsed * loyalty.copPerPoint };
}

/** Oferta de "nuevo ingreso": solo si la cuenta es nueva Y hay algo que pagar. */
function welcomeDiscount({ isNewMember, subtotal }) {
  if (!isNewMember || subtotal <= 0) return 0;
  return Math.round(subtotal * welcome.discountShare);
}

/**
 * Calcula el costo total de una reserva.
 * @returns desglose completo: { unitPrice, quantity, zone, coefficient, subtotal, pointsUsed, loyaltyDiscount,
 *                               welcomeDiscount, discount, total, pointsEarned, formula }
 */
function totalCost({ basePrice, quantity, zone, zones, pointsBalance = 0, usePoints = false, isNewMember = false }) {
  if (!Number.isInteger(basePrice) || basePrice < 0) throw new PricingError("Precio base inválido.", 500);
  if (!Number.isInteger(quantity) || quantity < 1) throw new PricingError("Elige al menos una entrada.");
  if (quantity > checkout.maxTicketsPerOrder) throw new PricingError(`Máximo ${checkout.maxTicketsPerOrder} entradas por compra.`);

  const coefficient = zoneCoefficient(zone, zones);                 // C
  const subtotal = Math.round(basePrice * quantity * coefficient);  // B · x · C

  // D(p) = puntos + bienvenida, con tope global (nunca se paga menos de la mitad del subtotal)
  const welcomeCop = welcomeDiscount({ isNewMember, subtotal });
  let { pointsUsed, discount: loyaltyCop } = loyaltyDiscount({ balance: pointsBalance, subtotal, usePoints });
  const maxTotal = Math.floor(subtotal * maxTotalDiscountShare);
  if (welcomeCop + loyaltyCop > maxTotal) {
    const room = Math.max(0, maxTotal - welcomeCop);
    pointsUsed = Math.min(pointsUsed, Math.floor(room / loyalty.copPerPoint));
    loyaltyCop = pointsUsed * loyalty.copPerPoint;
  }
  const discount = loyaltyCop + welcomeCop;
  const total = subtotal - discount;                                // P(x)
  const pointsEarned = Math.floor(total / loyalty.earnEveryCop);

  return {
    unitPrice: basePrice, quantity, zone, coefficient, subtotal,
    pointsUsed, loyaltyDiscount: loyaltyCop, welcomeDiscount: welcomeCop, discount,
    total, pointsEarned,
    formula: `P(${quantity}) = (${basePrice} · ${quantity} · ${coefficient}) − ${discount} = ${total}`,
  };
}

/* ==========================================================
   PRECIOS DINÁMICOS — derivada de los ingresos y máximos locales

     I(t)  ingresos acumulados del evento        (suma de las ventas por intervalo)
     r(t)  = dI/dt  tasa instantánea de venta     (diferencia finita, COP por hora)

   Un PICO de demanda es un máximo local de r(t): r_{i−1} < r_i ≥ r_{i+1}  (r' cambia de + a −).
   Si el último pico confirmado es relevante (≥ umbral absoluto y ≥ 1.25 × el promedio reciente),
   el precio base B sube un paso (+5 %) con tope en +30 % sobre el precio fijado por el Agente.
   Si la demanda se enfría (r ≤ 0.5 × promedio) y el precio está por encima de la base, baja un paso.
   ========================================================== */
const roundTo = (v, step) => Math.round(v / step) * step;

function evaluateDynamicPrice({ basePrice, currentPrice, revenuePerBucket, bucketMinutes, salesState = "disponible",
                                minutesSinceLastAdjustment = Infinity, opts = dynamicPricing }) {
  const hold = (reason, extra = {}) => ({ action: "hold", newPrice: currentPrice, reason, ...extra });
  const maxPrice = roundTo(basePrice * (1 + opts.maxIncreaseShare), opts.roundToCop);
  const bucketHours = bucketMinutes / 60;

  if (basePrice <= 0) return hold("Evento gratuito: no aplica precio dinámico.", { maxPrice });
  if (salesState === "agotado") return hold("Evento agotado.", { maxPrice });

  // I(t) y r(t) = dI/dt (COP/hora) sobre las muestras recientes
  const I = cumulative(revenuePerBucket, 1);
  const rates = finiteDifference(I, bucketHours).slice(-opts.windowBuckets);
  if (rates.length < 3) return hold("Aún hay muy pocas muestras para estimar la tendencia.", { rates, maxPrice });

  const meanRate = mean(rates);
  const lastRate = rates[rates.length - 1];
  const peaks = localMaxima(rates);
  const confirmedPeak = peaks.length && peaks[peaks.length - 1] === rates.length - 2 ? rates.length - 2 : null;
  const info = { rates, peaks, meanRate, lastRate, maxPrice, peakRate: confirmedPeak === null ? null : rates[confirmedPeak] };

  if (minutesSinceLastAdjustment < opts.cooldownMinutes) return hold("Ajuste reciente: en enfriamiento.", info);

  if (confirmedPeak !== null) {
    const peakRate = rates[confirmedPeak];
    if (peakRate >= opts.minRateCopPerHour && peakRate >= opts.peakVsMeanFactor * meanRate) {
      const stepped = roundTo(currentPrice * (1 + opts.stepShare), opts.roundToCop);
      const newPrice = Math.min(maxPrice, Math.max(stepped, currentPrice + opts.roundToCop));
      if (newPrice <= currentPrice) return hold(`Pico detectado, pero el precio ya está en el tope (+${Math.round(opts.maxIncreaseShare * 100)} %).`, info);
      return { action: "raise", newPrice: Math.min(newPrice, maxPrice),
               reason: `Máximo local de demanda: dI/dt = ${Math.round(peakRate).toLocaleString("es-CO")} COP/h (promedio ${Math.round(meanRate).toLocaleString("es-CO")}).`, ...info };
    }
  }

  if (currentPrice > basePrice && lastRate <= opts.coolDownFactor * meanRate) {
    const newPrice = Math.max(basePrice, roundTo(currentPrice / (1 + opts.stepShare), opts.roundToCop));
    if (newPrice < currentPrice) return { action: "lower", newPrice, reason: "La demanda se enfrió: el precio baja un paso hacia el precio base.", ...info };
  }
  return hold("Sin cambios: no hay un pico de demanda relevante.", info);
}

module.exports = { PricingError, zoneCoefficient, loyaltyDiscount, welcomeDiscount, totalCost, evaluateDynamicPrice, roundTo };
