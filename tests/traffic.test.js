const test = require("node:test");
const assert = require("node:assert/strict");
const { createTraffic } = require("../backend/lib/traffic");
const gateway = require("../backend/lib/payment-gateway");

const make = () => { let t = 1_000_000; const T = createTraffic({}, () => t); return { T, advance: (s) => { t += s * 1000; } }; };

test("x máximo = 80 con C=100, k=200, umbral 0.5", () => {
  const { T } = make();
  assert.equal(T.maxConcurrent, 80);
  assert.equal(T.metrics().latencyMs, 122);
});

test("entran 80 y el 81.º queda en la fila (T'(x+1) supera el umbral)", () => {
  const { T } = make();
  const res = Array.from({ length: 85 }, (_, i) => T.enter("u" + i));
  assert.equal(res.filter((r) => r.status === "admitted").length, 80);
  const q = res[80];
  assert.equal(q.status, "queued"); assert.equal(q.position, 1);
  assert.equal(res[84].position, 5);
  assert.equal(T.metrics().saturated, true);
});

test("al liberar un turno, la fila avanza en orden (FIFO)", () => {
  const { T } = make();
  const all = Array.from({ length: 83 }, (_, i) => T.enter("u" + i));
  T.release(all[0].ticket);
  assert.equal(T.status(all[80].ticket).status, "admitted");
  assert.equal(T.status(all[81].ticket).status, "queued");
  assert.equal(T.status(all[81].ticket).position, 1);
});

test("un usuario no puede ocupar dos lugares", () => {
  const { T } = make();
  const a = T.enter("ana"), b = T.enter("ana");
  assert.equal(a.ticket, b.ticket);
  assert.equal(T.metrics().admitted, 1);
});

test("los turnos vencen y quien deja de consultar la fila la pierde", () => {
  const { T, advance } = make();
  const all = Array.from({ length: 82 }, (_, i) => T.enter("u" + i));
  advance(25);                                   // la fila caduca a los 20 s sin consultar
  T.tick();
  assert.equal(T.status(all[80].ticket).status, "unknown");
  advance(301);                                  // los turnos de pago duran 5 min
  T.tick();
  assert.equal(T.metrics().admitted, 0);
});

test("carga simulada: sube x y T'(x); sin salir de la simulación se normaliza", () => {
  const { T, advance } = make();
  const m = T.simulate(85, 30);
  assert.equal(m.x, 85); assert.equal(m.saturated, true);
  assert.ok(m.dTdx > 0.5);
  assert.equal(T.enter("nuevo").status, "queued");
  advance(31); T.tick();
  assert.equal(T.metrics().simulated, 0);
  assert.equal(T.status(T.enter("nuevo").ticket).status, "admitted");
});

test("x ≥ C: asíntota → latencia nula en JSON y saturado", () => {
  const { T } = make();
  const m = T.simulate(100, 30);
  assert.equal(m.latencyMs, null); assert.equal(m.saturated, true);
});

test("middleware: pasa con turno, da turno al vuelo y encola cuando T' supera el umbral", () => {
  const { T } = make();
  const mkReq = (ticket, userId) => ({ body: { userId }, get: (h) => (h === "X-Queue-Ticket" ? ticket : undefined) });
  const mkRes = () => { const r = { headers: {}, code: 200, body: null, set(k, v) { this.headers[k] = v; return this; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } }; return r; };

  // sin turno y sin saturación → entra y recibe cabecera
  let nexted = false; let res = mkRes();
  T.virtualQueueGate(mkReq(undefined, "ana"), res, () => { nexted = true; });
  assert.equal(nexted, true); assert.ok(res.headers["X-Queue-Ticket"]);

  // con ese turno → entra
  nexted = false;
  T.virtualQueueGate(mkReq(res.headers["X-Queue-Ticket"], "ana"), mkRes(), () => { nexted = true; });
  assert.equal(nexted, true);

  // saturar y probar un usuario nuevo
  T.simulate(85, 60);
  nexted = false; res = mkRes();
  T.virtualQueueGate(mkReq(undefined, "beto"), res, () => { nexted = true; });
  assert.equal(nexted, false);
  assert.equal(res.code, 429); assert.equal(res.body.code, "QUEUE_REQUIRED"); assert.equal(res.body.status, "queued");
  assert.ok(res.headers["Retry-After"]);
});

test("pasarela simulada: Luhn, rechazos de prueba y que nunca devuelva el número", () => {
  assert.equal(gateway.luhn("4242424242424242"), true);
  assert.equal(gateway.luhn("4242424242424241"), false);
  const ok = gateway.authorize({ type: "tarjeta", amount: 1000, number: "4242 4242 4242 4242", name: "Ana Pérez", exp: "12/39", cvv: "123" });
  assert.deepEqual([ok.method, ok.brand, ok.last4], ["tarjeta", "Visa", "4242"]);
  assert.ok(!JSON.stringify(ok).includes("4242 4242 4242"));
  assert.throws(() => gateway.authorize({ type: "tarjeta", amount: 1000, number: "4000 0000 0000 0002", name: "Ana Pérez", exp: "12/39", cvv: "123" }), /fondos insuficientes/);
  assert.throws(() => gateway.authorize({ type: "tarjeta", amount: 1000, number: "4242 4242 4242 4242", name: "Ana Pérez", exp: "01/20", cvv: "123" }), /Revisa los datos/);
  assert.equal(gateway.authorize({ type: "nequi", amount: 1000, phone: "3001234567" }).method, "nequi");
  assert.throws(() => gateway.authorize({ type: "nequi", amount: 1000, phone: "3000000000" }), /rechazado/);
  assert.equal(gateway.authorize({ type: "pse", amount: 1000, bank: "Bancolombia" }).brand, "Bancolombia");
  assert.equal(gateway.authorize({ type: "lo-que-sea", amount: 0 }).method, "gratis");   // total 0: no hay cobro
});
