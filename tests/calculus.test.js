const test = require("node:test");
const assert = require("node:assert/strict");
const { integrate, cumulative, finiteDifference, localMaxima, latency, latencyRate, maxConcurrentForRate } = require("../backend/lib/calculus");

test("integral: suma de Riemann y trapecios con valores conocidos", () => {
  assert.equal(integrate([1, 2, 3], 1, "riemann"), 6);            // 1+2+3
  assert.equal(integrate([10, 10, 10], 0.5, "riemann"), 15);      // Δt = 0.5
  assert.equal(integrate([0, 2, 4], 1, "trapezoid"), 4);          // (0+2)/2 + (2+4)/2
  assert.equal(integrate([], 1), 0);
  // ∫₀¹ x dx = 1/2 : con 1000 trapecios el error es ~0
  const xs = Array.from({ length: 1001 }, (_, i) => i / 1000);
  assert.ok(Math.abs(integrate(xs, 1 / 1000, "trapezoid") - 0.5) < 1e-9);
});

test("acumulada: F(t) es la primitiva numérica", () => {
  assert.deepEqual(cumulative([5, 0, 3, 2], 1), [5, 5, 8, 10]);
});

test("derivada por diferencias: es la inversa de la acumulada", () => {
  const f = [5, 0, 3, 2];
  assert.deepEqual(finiteDifference(cumulative(f, 1), 1), f);
  assert.deepEqual(finiteDifference([0, 10, 30], 0.5), [0, 20, 40]);
});

test("máximos locales: cambio de signo de la derivada", () => {
  assert.deepEqual(localMaxima([1, 3, 2, 5, 5, 4, 1]), [1, 3]);   // el 3 y el primer 5 de la meseta
  assert.deepEqual(localMaxima([1, 2, 3]), []);                   // creciente: no hay máximo
  assert.deepEqual(localMaxima([4, 4, 4]), []);
});

test("latencia racional T(x) = k/(C−x)+Tb y su derivada T'(x) = k/(C−x)²", () => {
  const p = { C: 100, k: 200, Tb: 120 };
  assert.equal(latency(0, p), 122);
  assert.equal(latency(80, p), 130);
  assert.equal(latency(100, p), Infinity);                        // asíntota vertical
  assert.equal(latencyRate(80, p), 0.5);
  assert.equal(latencyRate(100, p), Infinity);
  // la fórmula de T' coincide con la derivada numérica
  const h = 1e-6;
  for (const x of [0, 30, 60, 90]) {
    const numeric = (latency(x + h, p) - latency(x, p)) / h;
    assert.ok(Math.abs(numeric - latencyRate(x, p)) < 1e-3, `x=${x}`);
  }
});

test("x máximo: C − √(k/d) deja T' justo por debajo del umbral", () => {
  const p = { C: 100, k: 200 };
  const xmax = maxConcurrentForRate(p, 0.5);
  assert.equal(xmax, 80);
  assert.ok(latencyRate(xmax, p) <= 0.5);
  assert.ok(latencyRate(xmax + 1, p) > 0.5);
});
