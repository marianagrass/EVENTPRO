/* Pruebas de integración: Express + SQL reales (en PGlite). Se omiten si no está instalado @electric-sql/pglite. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { createPglitePool, hasPglite } = require("./helpers/pglite-pool");
const { createTraffic } = require("../backend/lib/traffic");
const { createApp } = require("../backend/app");

const skip = hasPglite() ? false : "instala @electric-sql/pglite (npm i -D @electric-sql/pglite) para correr las pruebas de integración";
const CARD = { type: "tarjeta", number: "4242 4242 4242 4242", name: "Ana Pérez", exp: "12/39", cvv: "123" };
const ELECTRO = "e0000000-0000-4000-8000-000000000005";       // ElectroFest, $60.000
const TORNEO = "e0000000-0000-4000-8000-000000000006";        // gratis
const CARLOS = "a0000000-0000-4000-8000-00000000003a";        // user@eventpro.com (ya tiene inscripciones: no es "nuevo")
const AGENTE = "a0000000-0000-4000-8000-000000000035";

test("módulo de pagos (integración)", { skip, timeout: 240000 }, async (t) => {
  const pool = await createPglitePool();
  const traffic = createTraffic();
  const { app } = createApp({ pool, traffic });
  const server = await new Promise((res) => { const s = app.listen(0, () => res(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  t.after(() => { server.close(); });

  const call = async (method, path, body, headers = {}) => {
    const r = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    let json = null; try { json = await r.json(); } catch (_) { /* sin cuerpo */ }
    return { status: r.status, json, headers: r.headers };
  };
  const rows = async (sql, p) => (await pool.query(sql, p)).rows;
  const one = async (sql, p) => (await rows(sql, p))[0];
  // usuarios "nuevos": activos, con 100 puntos de bono y sin ninguna inscripción
  const freshUsers = await rows(`SELECT id, loyalty_points FROM users u WHERE role='user' AND status='activo' AND is_new_member(u.id) ORDER BY id LIMIT 8`);

  await t.test("el SQL 004 se puede ejecutar dos veces sin romper nada", async () => {
    const { createPglitePool: again } = require("./helpers/pglite-pool");
    const p2 = await again({ files: ["001_schema.sql", "002_seed.sql", "004_payments.sql", "004_payments.sql"] });
    assert.equal((await p2.query("SELECT COUNT(*)::int n FROM zones")).rows[0].n, 3);
    await p2.close();
  });

  await t.test("GET /events trae precio base, estado de ventas y recaudo numérico", async () => {
    const r = await call("GET", "/events");
    assert.equal(r.status, 200);
    const ev = r.json.find((e) => e.id === ELECTRO);
    assert.equal(ev.price_cop, 60000); assert.equal(ev.base_price_cop, 60000);
    assert.equal(typeof ev.revenue_cop, "number"); assert.ok(["disponible", "ultimos_cupos", "agotado"].includes(ev.sales_state));
  });

  const nuevo = freshUsers[0];
  await t.test("cotización: P(x) = B·x·C − D(p), con puntos y oferta de nuevo ingreso", async () => {
    const r = await call("POST", "/checkout/quote", { eventId: ELECTRO, userId: nuevo.id, quantity: 2, zone: "vip", usePoints: true });
    assert.equal(r.status, 200);
    const q = r.json.quote;
    assert.equal(q.subtotal, 60000 * 2 * 2.5);                       // 300.000
    assert.equal(q.welcomeDiscount, 30000);                          // 10 % por ser cuenta nueva
    assert.equal(q.pointsUsed, 100); assert.equal(q.loyaltyDiscount, 2500);
    assert.equal(q.total, 300000 - 30000 - 2500);
    assert.equal(r.json.user.isNewMember, true);
    assert.equal(r.json.zones.find((z) => z.code === "preferencial").unitPriceCop, 90000);
    assert.ok(r.headers.get("x-queue-ticket"), "el middleware entrega turno al vuelo");
  });

  let payment;
  await t.test("pago aprobado: guarda pago, boletas, puntos y recalcula el aforo", async () => {
    const before = await one("SELECT COUNT(*)::int n FROM attendees WHERE event_id=$1 AND status IN ('confirmado','pendiente')", [ELECTRO]);
    const r = await call("POST", "/checkout", { eventId: ELECTRO, userId: nuevo.id, quantity: 2, zone: "vip", usePoints: true, method: CARD });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    payment = r.json.payment;
    assert.equal(payment.totalCop, 267500); assert.equal(payment.last4, "4242"); assert.equal(payment.brand, "Visa");
    assert.equal(payment.pointsEarned, 267); assert.equal(payment.pointsBalance, 267);       // 100 − 100 + 267
    const tickets = await rows("SELECT user_id, name, price_paid_cop, zone_code FROM attendees WHERE payment_id=$1 ORDER BY (user_id IS NULL), name", [payment.id]);
    assert.equal(tickets.length, 2);
    assert.equal(tickets[0].user_id, nuevo.id); assert.match(tickets[1].name, /^Acompañante 1 de/);
    assert.equal(tickets.reduce((s, x) => s + x.price_paid_cop, 0), 267500);                  // el residuo no se pierde
    assert.ok(tickets.every((x) => x.zone_code === "vip"));
    const after = await one("SELECT COUNT(*)::int n FROM attendees WHERE event_id=$1 AND status IN ('confirmado','pendiente')", [ELECTRO]);
    assert.equal(after.n - before.n, 2);
    const ledger = await rows("SELECT delta, reason FROM loyalty_ledger WHERE user_id=$1 AND payment_id=$2 ORDER BY id", [nuevo.id, payment.id]);
    assert.deepEqual(ledger.map((l) => [l.delta, l.reason]), [[-100, "canje"], [267, "compra"]]);
    const stored = await one("SELECT * FROM payments WHERE id=$1", [payment.id]);
    assert.equal(stored.total_cop, stored.subtotal_cop - stored.loyalty_discount_cop - stored.welcome_discount_cop);
    assert.equal(stored.card_last4, "4242"); assert.ok(!JSON.stringify(stored).includes("4242 4242"));
  });

  await t.test("no se puede comprar dos veces el mismo evento ni ser «nuevo» otra vez", async () => {
    const r = await call("POST", "/checkout", { eventId: ELECTRO, userId: nuevo.id, quantity: 1, zone: "general", method: CARD });
    assert.equal(r.status, 409); assert.match(r.json.error, /Ya estás inscrito/);
    const q = await call("POST", "/checkout/quote", { eventId: TORNEO, userId: nuevo.id, quantity: 1, zone: "general" });
    assert.equal(q.json.user.isNewMember, false);
  });

  await t.test("tarjeta rechazada: 402 y no queda nada guardado; datos inválidos: 422 con campos", async () => {
    const u = freshUsers[1];
    const before = await one("SELECT COUNT(*)::int n FROM payments");
    const declined = await call("POST", "/checkout", { eventId: ELECTRO, userId: u.id, quantity: 1, zone: "general", method: { ...CARD, number: "4000 0000 0000 0002" } });
    assert.equal(declined.status, 402); assert.match(declined.json.error, /fondos insuficientes/);
    const bad = await call("POST", "/checkout", { eventId: ELECTRO, userId: u.id, quantity: 1, zone: "general", method: { ...CARD, cvv: "1" } });
    assert.equal(bad.status, 422); assert.ok(bad.json.fields.cvv);
    assert.equal((await one("SELECT COUNT(*)::int n FROM payments")).n, before.n);
    assert.equal((await one("SELECT COUNT(*)::int n FROM attendees WHERE user_id=$1", [u.id])).n, 0);
  });

  await t.test("evento gratis: se inscribe sin método de pago y sin cobro", async () => {
    const u = freshUsers[2];
    const r = await call("POST", "/checkout", { eventId: TORNEO, userId: u.id, quantity: 3, zone: "general" });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.payment.totalCop, 0); assert.equal(r.json.payment.method, "gratis"); assert.equal(r.json.payment.pointsEarned, 0);
  });

  await t.test("aforo: disponible → últimos cupos → agotado (límite por la izquierda) y vuelve al cancelar", async () => {
    const ev = await call("POST", "/events", { name: "Aforo de prueba", type_code: "fiesta", event_date: "2026-12-20", start_time: "20:00", location: "Campus", description: "", image_url: null, capacity: 20, price_cop: 10000, status: "planificado", availability: "open", coordinator: "x", created_by: AGENTE });
    const id = ev.json.id;
    await pool.query(`INSERT INTO attendees (event_id, name, status, price_paid_cop) SELECT $1, 'relleno ' || g, 'confirmado', 10000 FROM generate_series(1, 17) g`, [id]);
    assert.equal((await one("SELECT sales_state FROM events WHERE id=$1", [id])).sales_state, "disponible");     // quedan 3
    const u = freshUsers;
    const buy = (i, n = 1) => call("POST", "/checkout", { eventId: id, userId: u[i].id, quantity: n, zone: "general", method: CARD });
    const state = async () => (await one("SELECT sales_state FROM events WHERE id=$1", [id])).sales_state;
    let r = await buy(3);  assert.equal(r.status, 201); assert.equal(r.json.salesState, "ultimos_cupos"); assert.equal(await state(), "ultimos_cupos");   // quedan 2
    r = await buy(4, 3);   assert.equal(r.status, 409); assert.match(r.json.error, /Solo quedan 2/);
    r = await buy(4, 2);   assert.equal(r.status, 201); assert.equal(r.json.salesState, "agotado");
    r = await buy(5);      assert.equal(r.status, 409); assert.match(r.json.error, /sin cupos/);
    // cancelar libera cupos y el estado vuelve solo
    const c = await call("POST", "/unregister", { eventId: id, userId: u[4].id });
    assert.equal(c.status, 200);
    assert.equal(await state(), "ultimos_cupos");
    // bajar el aforo también recalcula
    await call("PUT", `/events/${id}/capacity`, { capacity: 21 });
    assert.equal(await state(), "ultimos_cupos");
    const bad = await call("PUT", `/events/${id}/capacity`, { capacity: 5 });
    assert.equal(bad.status, 400); assert.match(bad.json.error, /no puede ser menor/);
  });

  await t.test("cancelar: reembolso simulado y reversión de puntos", async () => {
    const c = await call("POST", "/unregister", { eventId: ELECTRO, userId: nuevo.id });
    assert.equal(c.status, 200);
    assert.equal((await one("SELECT status FROM payments WHERE id=$1", [payment.id])).status, "reembolsado");
    assert.equal((await rows("SELECT status FROM attendees WHERE payment_id=$1", [payment.id])).every((a) => a.status === "cancelado"), true);
    assert.equal((await one("SELECT loyalty_points p FROM users WHERE id=$1", [nuevo.id])).p, 100);    // devolvió lo canjeado y retiró lo ganado
    const sum = await one("SELECT COALESCE(SUM(delta),0)::int s FROM loyalty_ledger WHERE user_id=$1", [nuevo.id]);
    assert.equal(sum.s, 100);                                                                          // el libro siempre cuadra con el saldo
    const again = await call("POST", "/unregister", { eventId: ELECTRO, userId: nuevo.id });
    assert.equal(again.status, 400);
    // comprar de nuevo es posible, pero ya NO es «nuevo»
    const q = await call("POST", "/checkout/quote", { eventId: ELECTRO, userId: nuevo.id, quantity: 1, zone: "general" });
    assert.equal(q.json.user.isNewMember, false); assert.equal(q.json.quote.welcomeDiscount, 0);
  });

  await t.test("carrera de precio: si el precio cambió mientras pagaba, la base lo rechaza", async () => {
    const u = freshUsers[6];
    await assert.rejects(
      pool.query("SELECT * FROM confirm_checkout($1,$2,1,'general',59000,1,59000,0,0,0,59000,59,'tarjeta','Visa','4242')", [ELECTRO, u.id]),
      /El precio del evento cambió/);
    await assert.rejects(
      pool.query("SELECT * FROM confirm_checkout($1,$2,1,'general',60000,1,60000,0,0,0,60000,60,'tarjeta','Visa','4242')", [ELECTRO, "a0000000-0000-4000-8000-0000000000ff"]),
      /no puede inscribirse/);
  });

  await t.test("reporte del Admin: ∫ de ingresos por mes cuadra con la contabilidad", async () => {
    const r = await call("GET", "/admin/reports/revenue?year=2026");
    assert.equal(r.status, 200);
    assert.equal(r.json.months.length, 12);
    assert.equal(r.json.check.reconciled, true, JSON.stringify(r.json.check));
    const sumMonths = r.json.months.reduce((s, m) => s + m.revenueCop, 0);
    assert.equal(sumMonths, r.json.totalCop);
    assert.equal(r.json.months[11].cumulativeCop, r.json.totalCop);                       // F(31 dic) = total del año
    assert.ok(r.json.months.some((m) => m.revenueCop > 0));
    assert.ok(r.json.months.every((m) => Math.abs(m.approxTrapezoidCop - m.revenueCop) <= Math.max(1, m.peakDay ? m.peakDay.revenueCop : 0)));
    assert.equal(r.json.months[0].days, 31); assert.equal(r.json.months[1].days, 28);
    const bad = await call("GET", "/admin/reports/revenue?year=abc");
    assert.equal(bad.status, 400);
  });

  await t.test("comisión del Agente: L(E,T) = b·E + m·T y sube con cada check-in", async () => {
    const a = await call("GET", `/agents/${AGENTE}/commission`);
    assert.equal(a.status, 200);
    assert.equal(a.json.commissionCop, a.json.rule.perEventCop * a.json.eventsManaged + a.json.rule.perTicketCop * a.json.ticketsManaged);
    assert.equal(a.json.breakdown.reduce((s, b) => s + b.subtotalCop, 0), a.json.commissionCop);
    const att = await one("SELECT id FROM attendees WHERE event_id=$1 AND status='confirmado' AND checked_in_at IS NULL AND user_id IS NULL LIMIT 1", [ELECTRO]);
    await call("PUT", `/attendees/${att.id}/checkin`, { checkin: true, agentId: AGENTE });
    const b = await call("GET", `/agents/${AGENTE}/commission`);
    assert.equal(b.json.ticketsManaged, a.json.ticketsManaged + 1);
    assert.equal(b.json.commissionCop - a.json.commissionCop, a.json.rule.perTicketCop + (b.json.eventsManaged - a.json.eventsManaged) * a.json.rule.perEventCop);
    await call("PUT", `/attendees/${att.id}/checkin`, { checkin: false, agentId: AGENTE });
    assert.equal((await call("GET", `/agents/${AGENTE}/commission`)).json.ticketsManaged, a.json.ticketsManaged);
    assert.equal((await call("GET", `/agents/${CARLOS}/commission`)).status, 404);              // un usuario no es agente
  });

  await t.test("precios dinámicos: un máximo local de demanda sube B; la base del Agente no cambia", async () => {
    const ev = await call("POST", "/events", { name: "Evento de demanda", type_code: "musica", event_date: "2026-12-30", start_time: "21:00", location: "Campus", description: "", image_url: null, capacity: 5000, price_cop: 50000, status: "planificado", availability: "open", coordinator: "x", created_by: AGENTE });
    const id = ev.json.id;
    // ingresos por hora, de la más antigua a la más reciente completa: sube, pico (1.2 M) y baja
    const curve = [100000, 150000, 200000, 300000, 500000, 700000, 1200000, 600000];
    for (let i = 0; i < curve.length; i++) {
      const hoursAgo = curve.length - i;
      await pool.query(`INSERT INTO attendees (event_id, name, status, price_paid_cop, registered_at)
                        VALUES ($1, 'venta ' || $3, 'confirmado', $2, date_trunc('hour', now()) - ($3 || ' hours')::interval + interval '20 minutes')`, [id, curve[i], hoursAgo]);
    }
    const peek = await call("GET", `/events/${id}/pricing`);
    assert.equal(peek.json.decision.action, "raise"); assert.equal(peek.json.decision.applied, false);
    assert.equal((await one("SELECT price_cop FROM events WHERE id=$1", [id])).price_cop, 50000);   // consultar no cambia nada

    const go = await call("POST", `/events/${id}/pricing/evaluate`);
    assert.equal(go.json.decision.applied, true); assert.equal(go.json.event.currentPriceCop, 52500);
    const row = await one("SELECT price_cop, base_price_cop FROM events WHERE id=$1", [id]);
    assert.deepEqual([row.price_cop, row.base_price_cop], [52500, 50000]);
    assert.equal((await rows("SELECT * FROM price_adjustments WHERE event_id=$1", [id])).length, 1);

    const again = await call("POST", `/events/${id}/pricing/evaluate`);                              // enfriamiento: no vuelve a subir
    assert.equal(again.json.decision.action, "hold");

    // El Agente edita el precio: ambos se igualan (se reinicia el ajuste dinámico)
    await call("PUT", `/events/${id}`, { name: "Evento de demanda", type_code: "musica", event_date: "2026-12-30", start_time: "21:00", location: "Campus", description: "", image_url: null, capacity: 5000, price_cop: 55000, status: "planificado", availability: "open", coordinator: "x" });
    const row2 = await one("SELECT price_cop, base_price_cop FROM events WHERE id=$1", [id]);
    assert.deepEqual([row2.price_cop, row2.base_price_cop], [55000, 55000]);
  });

  await t.test("fila virtual: con T'(x) sobre el umbral el pago se intercepta; al normalizarse se entra", async () => {
    const u = freshUsers[7];
    const m = await call("POST", "/traffic/simulate", { users: 85, seconds: 120 });
    assert.equal(m.json.saturated, true); assert.ok(m.json.dTdx > 0.5);
    const blocked = await call("POST", "/checkout/quote", { eventId: ELECTRO, userId: u.id, quantity: 1, zone: "general" });
    assert.equal(blocked.status, 429); assert.equal(blocked.json.code, "QUEUE_REQUIRED"); assert.equal(blocked.json.queue, true);
    assert.equal(blocked.json.status, "queued"); assert.ok(blocked.headers.get("retry-after"));
    const st = await call("GET", `/queue/status/${blocked.json.ticket}`);
    assert.equal(st.json.status, "queued");
    await call("POST", "/traffic/simulate", { users: 0, seconds: 1 });                               // baja la carga
    const st2 = await call("GET", `/queue/status/${blocked.json.ticket}`);
    assert.equal(st2.json.status, "admitted");                                                        // la fila avanza sola
    const ok = await call("POST", "/checkout/quote", { eventId: ELECTRO, userId: u.id, quantity: 1, zone: "general" }, { "X-Queue-Ticket": blocked.json.ticket });
    assert.equal(ok.status, 200);
    traffic.reset();
  });

  await t.test("Agente: crear/editar evento se guarda; editar sin cambiar el precio NO pisa el precio base", async () => {
    const create = await call("POST", "/events", { name: "Evento de prueba", type_code: "fiesta", event_date: "2026-12-20", start_time: "20:00", location: "Campus",
      description: "", image_url: "", capacity: 100, price_cop: 40000, status: "planificado", availability: "open", coordinator: "Agente", created_by: AGENTE });
    assert.equal(create.status, 200);
    const id = create.json.id;
    let ev = await one("SELECT price_cop, base_price_cop FROM events WHERE id = $1", [id]);
    assert.deepEqual([ev.price_cop, ev.base_price_cop], [40000, 40000]);
    await pool.query("UPDATE events SET price_cop = 42000 WHERE id = $1", [id]);                      // el algoritmo subió el precio
    const form = { name: "Evento de prueba 2", type_code: "fiesta", event_date: "2026-12-20", start_time: "20:00", location: "Campus", description: "", image_url: "",
      capacity: 100, price_cop: 42000, status: "planificado", availability: "open", coordinator: "Agente" };
    assert.equal((await call("PUT", `/events/${id}`, form)).status, 200);                             // el Agente guarda sin tocar el precio
    ev = await one("SELECT name, price_cop, base_price_cop FROM events WHERE id = $1", [id]);
    assert.deepEqual([ev.name, ev.price_cop, ev.base_price_cop], ["Evento de prueba 2", 42000, 40000]);
    assert.equal((await call("PUT", `/events/${id}`, { ...form, price_cop: 50000 })).status, 200);    // el Agente fija un precio nuevo
    ev = await one("SELECT price_cop, base_price_cop FROM events WHERE id = $1", [id]);
    assert.deepEqual([ev.price_cop, ev.base_price_cop], [50000, 50000]);
    assert.equal((await call("DELETE", `/events/${id}`)).status, 200);
  });

  await t.test("errores: nunca se filtra SQL ni nombres internos", async () => {
    const dup = await call("POST", "/accounts", { name: "X", email: "user@eventpro.com", role: "user" });
    assert.equal(dup.status, 409); assert.ok(!JSON.stringify(dup.json).includes("users_email_unique"));
    const badId = await call("PUT", "/tasks/no-es-uuid/status", { status: "completado" });
    assert.equal(badId.status, 400);
    const badRole = await call("PUT", `/accounts/${CARLOS}/role`, { role: "superadmin" });
    assert.ok([400, 500].includes(badRole.status)); assert.ok(!/constraint|users_role_check|violates/i.test(JSON.stringify(badRole.json)));
    const raw = await fetch(base + "/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{malo" });
    assert.equal(raw.status, 400);
    assert.equal((await call("GET", "/no-existe")).status, 404);
    assert.equal((await call("GET", "/health")).json.ok, true);
  });

  await pool.close();
});
