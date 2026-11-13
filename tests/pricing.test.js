const test = require("node:test");
const assert = require("node:assert/strict");
const { zoneCoefficient, totalCost, evaluateDynamicPrice, PricingError } = require("../backend/lib/pricing");
const { salesState, checkCapacity } = require("../backend/lib/capacity");

const zones = [{ code: "general", coefficient: "1.00" }, { code: "preferencial", coefficient: "1.50" }, { code: "vip", coefficient: "2.50" }];
const base = { basePrice: 35000, zones };

test("C(zona): función a trozos", () => {
  assert.equal(zoneCoefficient("general", zones), 1);
  assert.equal(zoneCoefficient("preferencial", zones), 1.5);
  assert.equal(zoneCoefficient("vip", zones), 2.5);
  assert.throws(() => zoneCoefficient("palco", zones), PricingError);
});

test("P(x) = B·x·C sin descuentos", () => {
  assert.equal(totalCost({ ...base, quantity: 2, zone: "general" }).total, 70000);
  assert.equal(totalCost({ ...base, quantity: 1, zone: "vip" }).total, 87500);
  assert.equal(totalCost({ ...base, quantity: 3, zone: "preferencial" }).subtotal, 157500);
});

test("D(p): los puntos descuentan $25 c/u con tope del 30 % del subtotal", () => {
  const t = totalCost({ ...base, quantity: 1, zone: "general", pointsBalance: 140, usePoints: true });
  assert.equal(t.pointsUsed, 140); assert.equal(t.loyaltyDiscount, 3500); assert.equal(t.total, 31500);
  const capped = totalCost({ ...base, quantity: 1, zone: "general", pointsBalance: 100000, usePoints: true });
  assert.equal(capped.loyaltyDiscount, Math.floor(35000 * 0.3 / 25) * 25);      // 10.500
  assert.equal(capped.total, 35000 - 10500);
  assert.equal(totalCost({ ...base, quantity: 1, zone: "general", pointsBalance: 140, usePoints: false }).pointsUsed, 0);
});

test("D(p): oferta de nuevo ingreso = 10 % solo si la cuenta es nueva", () => {
  assert.equal(totalCost({ ...base, quantity: 2, zone: "general", isNewMember: true }).welcomeDiscount, 7000);
  assert.equal(totalCost({ ...base, quantity: 2, zone: "general", isNewMember: false }).welcomeDiscount, 0);
});

test("descuentos combinados + puntos ganados", () => {
  const t = totalCost({ ...base, quantity: 3, zone: "vip", pointsBalance: 140, usePoints: true, isNewMember: true });
  assert.equal(t.subtotal, 262500);
  assert.equal(t.discount, 3500 + 26250);
  assert.equal(t.total, 232750);
  assert.equal(t.pointsEarned, 232);                                            // 1 punto por cada $1.000 pagados
  assert.equal(t.total, t.subtotal - t.discount);
});

test("evento gratis: nada que descontar ni cobrar", () => {
  const t = totalCost({ basePrice: 0, zones, quantity: 4, zone: "vip", pointsBalance: 500, usePoints: true, isNewMember: true });
  assert.equal(t.total, 0); assert.equal(t.discount, 0); assert.equal(t.pointsUsed, 0);
});

test("validaciones: cantidad y precio", () => {
  assert.throws(() => totalCost({ ...base, quantity: 0, zone: "general" }), PricingError);
  assert.throws(() => totalCost({ ...base, quantity: 7, zone: "general" }), /Máximo 6/);
  assert.throws(() => totalCost({ ...base, quantity: 1.5, zone: "general" }), PricingError);
  assert.throws(() => totalCost({ basePrice: -1, zones, quantity: 1, zone: "general" }), PricingError);
});

/* ---------- aforo ---------- */
test("aforo: límite por la izquierda s → 1⁻", () => {
  assert.equal(salesState(100, 0), "disponible");
  assert.equal(salesState(100, 89), "disponible");        // quedan 11
  assert.equal(salesState(100, 90), "ultimos_cupos");     // quedan 10 = 10 %
  assert.equal(salesState(100, 99), "ultimos_cupos");
  assert.equal(salesState(100, 100), "agotado");
  assert.equal(salesState(5, 4), "ultimos_cupos");        // aforos pequeños: al menos 1 cupo cuenta como "últimos"
  assert.equal(salesState(2000, 1799), "disponible");
  assert.equal(salesState(2000, 1800), "ultimos_cupos");
});
test("aforo: validación previa al cobro", () => {
  assert.equal(checkCapacity(100, 95, 3).ok, true);
  assert.equal(checkCapacity(100, 95, 3).stateAfter, "ultimos_cupos");
  assert.equal(checkCapacity(100, 97, 3).stateAfter, "agotado");
  assert.match(checkCapacity(100, 98, 3).message, /Solo quedan 2/);
  assert.match(checkCapacity(100, 100, 1).message, /sin cupos/);
});

/* ---------- precios dinámicos ---------- */
const dyn = (revenue, extra = {}) => evaluateDynamicPrice({ basePrice: 50000, currentPrice: 50000, revenuePerBucket: revenue, bucketMinutes: 60, ...extra });

test("precio dinámico: demanda plana → no cambia", () => {
  const r = dyn(Array(12).fill(500000));
  assert.equal(r.action, "hold");
});
test("precio dinámico: máximo local de demanda → sube un paso (+5 %)", () => {
  //  ingresos por hora: sube, pico (1.2 M) y baja
  const r = dyn([100000, 150000, 200000, 300000, 700000, 1200000, 600000]);
  assert.equal(r.action, "raise");
  assert.equal(r.newPrice, 52500);
  assert.deepEqual(r.peaks, [5]);
});
test("precio dinámico: tope de +30 % sobre el precio base", () => {
  const r = evaluateDynamicPrice({ basePrice: 50000, currentPrice: 65000, revenuePerBucket: [100000, 200000, 300000, 1500000, 400000], bucketMinutes: 60 });
  assert.equal(r.action, "hold");                         // ya está en 65.000 = 50.000·1.3
  assert.equal(r.maxPrice, 65000);
});
test("precio dinámico: enfriamiento tras un ajuste reciente", () => {
  const r = dyn([100000, 150000, 200000, 300000, 700000, 1200000, 600000], { minutesSinceLastAdjustment: 10 });
  assert.equal(r.action, "hold");
});
test("precio dinámico: si la demanda cae, vuelve a bajar hacia el precio base", () => {
  const r = evaluateDynamicPrice({ basePrice: 50000, currentPrice: 55000, revenuePerBucket: [900000, 800000, 700000, 600000, 100000, 50000], bucketMinutes: 60 });
  assert.equal(r.action, "lower");
  assert.ok(r.newPrice < 55000 && r.newPrice >= 50000);
});
test("precio dinámico: picos pequeños (bajo el umbral) se ignoran; gratis y agotado no aplican", () => {
  assert.equal(dyn([1000, 2000, 5000, 2000, 1000]).action, "hold");
  assert.equal(evaluateDynamicPrice({ basePrice: 0, currentPrice: 0, revenuePerBucket: [1, 2, 3], bucketMinutes: 60 }).action, "hold");
  assert.equal(dyn([100000, 200000, 900000, 300000], { salesState: "agotado" }).action, "hold");
});
