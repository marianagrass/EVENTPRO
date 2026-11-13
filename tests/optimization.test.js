const test = require("node:test");
const assert = require("node:assert/strict");
const o = require("../backend/lib/optimization");

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);

test("D(x) = M − kx, I(x) = Mx − kx², I′(x) = M − 2kx, I″ = −2k", () => {
  const m = { M: 1500, k: 0.015 };
  assert.equal(o.demand(40000, m), 900);
  assert.equal(o.revenue(40000, m), 40000 * 900);
  close(o.revenue(40000, m), 1500 * 40000 - 0.015 * 40000 ** 2);
  close(o.revenueFirstDerivative(40000, m), 1500 - 2 * 0.015 * 40000);
  assert.equal(o.revenueSecondDerivative(m), -0.03);
});

test("punto crítico x* = M/2k: anula I′, I″ < 0 y ningún otro precio rinde más", () => {
  for (const m of [{ M: 1500, k: 0.015 }, { M: 800, k: 0.002 }, { M: 12, k: 3 }, { M: 1e6, k: 7.5 }]) {
    const r = o.optimizeRevenue(m);
    close(r.optimum.price, m.M / (2 * m.k));
    close(r.optimum.firstDerivativeAtCritical, 0, 1e-9);
    close(r.optimum.revenue, (m.M * m.M) / (4 * m.k));          // I(x*) = M²/4k
    close(r.optimum.demand, m.M / 2);                           // D(x*) = M/2
    assert.equal(r.guarantee.secondDerivative, -2 * m.k);
    assert.equal(r.guarantee.isNegative, true);
    assert.equal(r.guarantee.numericCheck.ok, true);
    // máximo GLOBAL: ningún precio (negativo, mayor, aleatorio) supera I(x*)
    for (let i = 0; i < 300; i++) {
      const x = (Math.random() * 4 - 1) * (m.M / m.k);
      assert.ok(o.revenue(x, m) <= r.optimum.revenue + 1e-6 * r.optimum.revenue);
    }
  }
});

test("garantía estricta: M ≤ 0 o k ≤ 0 (I″ ≥ 0) se rechazan, nunca se sugiere un precio", () => {
  for (const bad of [{ M: 100, k: 0 }, { M: 100, k: -2 }, { M: 0, k: 1 }, { M: -5, k: 1 }, { M: NaN, k: 1 }, { M: 100, k: Infinity }]) {
    assert.throws(() => o.optimizeRevenue(bad), (e) => e.name === "OptimizationError");
    assert.throws(() => o.recommendPrice(bad, 100));
  }
  assert.throws(() => o.optimizeRevenue({ M: 100, k: 0 }), (e) => e.code === "INVALID_K");
});

test("aforo: si D(x*) > aforo, el precio sube hasta el mínimo que no sobrepasa los cupos", () => {
  const m = { M: 3000, k: 0.03 };                                // x* = 50.000 → D(x*) = 1.500
  const r = o.recommendPrice(m, 500);
  assert.equal(r.capacityBinding, true);
  assert.ok(r.recommended.price >= (3000 - 500) / 0.03 - 500);   // ≈ 83.333 (con redondeo a $500)
  assert.ok(r.recommended.expectedTickets <= 500);
  assert.ok(r.recommended.expectedRevenue > 50000 * 500);        // mejor que cobrar x* y vender solo 500
  const free = o.recommendPrice(m, 5000);                        // aforo holgado → manda el punto crítico
  assert.equal(free.capacityBinding, false); assert.equal(free.recommended.price, 50000);
});

test("redondeo a $500 elige el vecino que más ingresa y no se pasa del precio de demanda cero", () => {
  const r = o.recommendPrice({ M: 1000, k: 0.0123 }, 1000);      // x* ≈ 40.650,4
  assert.equal(r.recommended.price % 500, 0);
  const lo = Math.floor(r.optimum.price / 500) * 500, hi = lo + 500;
  assert.ok(o.revenue(r.recommended.price, r.model) >= Math.min(o.revenue(lo, r.model), o.revenue(hi, r.model)));
  assert.ok(r.recommended.price <= r.zeroDemandPrice);
});

test("estimación de M y k: recupera una demanda lineal exacta del historial", () => {
  // llenado = 1,0 − 4·10⁻⁶·precio  (aforo variable)
  const hist = [[20000, 500], [30000, 1000], [40000, 800], [60000, 2000], [50000, 1200]].map(([price, capacity]) => ({ price, capacity, registered: Math.round(capacity * (1 - 4e-6 * price)) }));
  const e = o.estimateDemandModel({ history: hist, capacity: 1000 });
  assert.equal(e.source, "historial"); assert.ok(e.r2 > 0.99);
  close(e.M, 1000, 0.01); close(e.k, 0.004, 0.01);
  close(o.optimizeRevenue({ M: e.M, k: e.k }).optimum.price, 125000, 0.02);
});

test("estimación: sin curva clara (más precio → más asistentes) o sin datos usa la estimación inicial", () => {
  const up = [[20000, 900], [30000, 1000], [40000, 1100], [60000, 1500]].map(([price, registered]) => ({ price, capacity: 2000, registered }));
  const a = o.estimateDemandModel({ history: up, capacity: 1000 });
  assert.equal(a.source, "inicial"); assert.ok(a.note);
  const b = o.estimateDemandModel({ history: [], capacity: 1000 });
  assert.equal(b.source, "inicial"); close(b.M, 1500); close(b.M / b.k, 100000);       // M = 1,5·aforo y precio de demanda cero = $100.000
  assert.equal(b.confidence, "baja");
  assert.throws(() => o.estimateDemandModel({ history: [], capacity: 0 }));
});

test("estimación: M y k manuales mandan; si solo cambia M se conserva el precio de demanda cero", () => {
  const base = o.estimateDemandModel({ history: [], capacity: 1000 });
  const both = o.estimateDemandModel({ history: [], capacity: 1000, manual: { M: 900, k: 0.01 } });
  assert.equal(both.source, "manual"); assert.equal(both.M, 900); assert.equal(both.k, 0.01);
  const onlyM = o.estimateDemandModel({ history: [], capacity: 1000, manual: { M: 3000 } });
  close(onlyM.M / onlyM.k, base.M / base.k);
});
