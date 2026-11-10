/* Pruebas de integración sobre el MODELO ER: Express + SQL reales (en PGlite).
   Se omiten si no está instalado @electric-sql/pglite. */
const test = require("node:test");
const assert = require("node:assert/strict");
const { createPglitePool, hasPglite } = require("./helpers/pglite-pool");
const { createTraffic } = require("../backend/lib/traffic");
const { createApp } = require("../backend/app");

const skip = hasPglite() ? false : "instala @electric-sql/pglite (npm i -D @electric-sql/pglite) para correr las pruebas de integración";
const CARD = { type: "tarjeta", number: "4242 4242 4242 4242", name: "Ana Pérez", exp: "12/39", cvv: "123" };
const ELECTRO = "EVT-000005";            // ElectroFest, $60.000, agente Carmen López
const TORNEO = "EVT-000006";             // gratis, agente Valentina Serra
const CARLOS = "1100000052";             // user@eventpro.com (cliente con 3 reservas: no es «nuevo»)
const AGENTE = "1000000002";             // agente@eventpro.com (Carmen López)
const ADMIN = "1000000001";              // admin@eventpro.com
const COMPRADOR = "1200000001";          // cliente de prueba con reservas de relleno
const TORNEO_AGENTE = "1000000005";      // Valentina Serra (otra agente: no puede cancelar eventos de Carmen)

/* Columnas EXACTAS del ER aprobado por el tutor: si alguien agrega o quita un atributo, esta prueba falla. */
const ER = {
  pais: ["id_pais", "nombre_pais"],
  departamento: ["id_departamento", "nombre_departamento", "id_pais"],
  ciudad: ["id_ciudad", "nombre_ciudad", "id_departamento"],
  persona: ["numero_identificacion", "nombre_completo", "correo_electronico", "contrasena", "direccion", "id_ciudad"],
  telefono_persona: ["id_telefono", "numero_telefono", "numero_identificacion"],
  cliente: ["numero_identificacion", "cantidad_puntos", "visualizacion_publicidad"],
  agente: ["numero_identificacion", "comision", "experiencia"],
  administrador: ["numero_identificacion", "salario", "horario"],
  estado_evento: ["id_estado_evento", "nombre_estado"],
  estado_reserva: ["id_estado_reserva", "nombre_estado"],
  evento: ["codigo_evento", "nombre_evento", "descripcion", "teatro", "fecha_hora_inicio", "fecha_hora_fin", "capacidad_total", "precio_base",
    "observaciones", "causa_cancelacion", "id_ciudad", "id_estado_evento", "id_agente"],
  reserva: ["id_reserva", "fecha_hora_reserva", "valor_total", "numero_entradas", "observaciones", "causa_cancelacion", "id_cliente", "codigo_evento", "id_estado_reserva"],
};
const FK = [   // [tabla, columna, tabla referenciada]
  ["departamento", "id_pais", "pais"], ["ciudad", "id_departamento", "departamento"], ["persona", "id_ciudad", "ciudad"],
  ["telefono_persona", "numero_identificacion", "persona"], ["cliente", "numero_identificacion", "persona"],
  ["agente", "numero_identificacion", "persona"], ["administrador", "numero_identificacion", "persona"],
  ["evento", "id_ciudad", "ciudad"], ["evento", "id_estado_evento", "estado_evento"], ["evento", "id_agente", "agente"],
  ["reserva", "id_cliente", "cliente"], ["reserva", "codigo_evento", "evento"], ["reserva", "id_estado_reserva", "estado_reserva"],
];

test("modelo ER (estructura SQL)", { skip, timeout: 240000 }, async (t) => {
  const pool = await createPglitePool();
  const rows = async (sql, p) => (await pool.query(sql, p)).rows;

  await t.test("las 12 tablas del ER tienen exactamente los atributos aprobados", async () => {
    for (const [tabla, cols] of Object.entries(ER)) {
      const real = (await rows("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", [tabla])).map((r) => r.column_name);
      assert.deepEqual(real, cols, `columnas de ${tabla}`);
    }
  });

  await t.test("llaves foráneas del ER y subclases con PK = FK hacia PERSONA", async () => {
    const fks = await rows(
      `SELECT c.conrelid::regclass::text AS tabla, a.attname AS columna, c.confrelid::regclass::text AS destino
         FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey) WHERE c.contype = 'f'`);
    for (const [tabla, col, destino] of FK) assert.ok(fks.some((f) => f.tabla === tabla && f.columna === col && f.destino === destino), `FK ${tabla}.${col} → ${destino}`);
    for (const sub of ["cliente", "agente", "administrador"]) {
      const pk = await rows(`SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey) WHERE i.indrelid = '${sub}'::regclass AND i.indisprimary`);
      assert.deepEqual(pk.map((r) => r.attname), ["numero_identificacion"]);
    }
    const cascade = await rows("SELECT confdeltype FROM pg_constraint WHERE conrelid='telefono_persona'::regclass AND contype='f'");
    assert.equal(cascade[0].confdeltype, "c");                                                    // ON DELETE CASCADE
    const uq = await rows("SELECT 1 FROM pg_constraint WHERE conrelid='persona'::regclass AND contype='u' AND conname='uq_persona_correo'");
    assert.equal(uq.length, 1);                                                                   // correo_electronico UNIQUE
  });

  await t.test("las tablas viejas ya no existen", async () => {
    const viejas = ["registro_financiero", "tarea", "inscribe_reserva", "usuario", "usuario_base", "users", "events", "attendees", "tasks", "payments", "loyalty_ledger", "zones", "price_adjustments", "commission_rules"];
    const hay = (await rows("SELECT tablename FROM pg_tables WHERE schemaname='public'")).map((r) => r.tablename);
    for (const v of viejas) assert.ok(!hay.includes(v), `${v} debería haberse eliminado`);
  });

  await t.test("los SQL se pueden volver a ejecutar (010 recrea todo; 011 y 012 son idempotentes)", async () => {
    const again = await createPglitePool({ files: ["010_modelo_er.sql", "011_soporte_negocio.sql", "012_catalogos.sql", "010_modelo_er.sql", "011_soporte_negocio.sql", "012_catalogos.sql", "011_soporte_negocio.sql", "012_catalogos.sql"] });
    assert.equal((await again.query("SELECT COUNT(*)::int n FROM estado_evento")).rows[0].n, 7);
    assert.equal((await again.query("SELECT COUNT(*)::int n FROM zona")).rows[0].n, 3);
    assert.equal((await again.query("SELECT COUNT(*)::int n FROM persona")).rows[0].n, 0);
    await again.close();
  });

  await t.test("migración desde el esquema V9 (users/events/attendees…) hasta el ER", async () => {
    const legacy = ["legacy_v9/001_schema.sql", "legacy_v9/002_seed.sql", "legacy_v9/004_payments.sql"];
    const p = await createPglitePool({ files: [...legacy, "010_modelo_er.sql", "011_soporte_negocio.sql", "012_catalogos.sql", "013_datos_demo.sql"] });
    const tablas = (await p.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1")).rows.map((r) => r.tablename);
    assert.ok(!tablas.includes("users") && !tablas.includes("events") && tablas.includes("reserva"));
    assert.equal((await p.query("SELECT COUNT(*)::int n FROM reserva")).rows[0].n, 1328);
    await p.close();
  });

  await t.test("herencia: una persona solo puede estar en UNA subclase; cada reserva exige causa al cancelarse", async () => {
    await assert.rejects(pool.query("INSERT INTO agente (numero_identificacion) VALUES ($1)", [CARLOS]), /solo puede ser Cliente, Agente o Administrador/);
    await assert.rejects(pool.query("UPDATE reserva SET id_estado_reserva = id_estado_reserva_de('Cancelada') WHERE id_reserva = 1"), /indicar la causa/);
    await assert.rejects(pool.query("UPDATE evento SET id_estado_evento = id_estado_evento_de('Cancelado') WHERE codigo_evento = $1", [ELECTRO]), /indicar la causa/);
    await assert.rejects(pool.query("UPDATE reserva SET causa_cancelacion = 'x no aplica' WHERE id_reserva = 1"), /solo se registra en reservas canceladas/);
  });

  await pool.close();
});

test("módulo de pagos + ER (integración)", { skip, timeout: 240000 }, async (t) => {
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
  // clientes "nuevos": con 100 puntos de bono y sin ninguna reserva
  const freshUsers = await rows(`SELECT numero_identificacion AS id, cantidad_puntos AS loyalty_points FROM cliente c WHERE es_cliente_nuevo(c.numero_identificacion) ORDER BY 1 LIMIT 12`);
  const activas = (codigo) => one("SELECT inscritos_evento($1) AS n", [codigo]);
  const eventForm = (extra = {}) => ({ name: "Evento de prueba", event_date: "2027-03-20", start_time: "20:00", location: "Campus", description: "", capacity: 100, price_cop: 40000, created_by: AGENTE, ...extra });

  await t.test("GET /events trae precio base y vigente, estado de ventas, tipo derivado y recaudo numérico", async () => {
    const r = await call("GET", "/events");
    assert.equal(r.status, 200);
    const ev = r.json.find((e) => e.id === ELECTRO);
    assert.equal(ev.price_cop, 60000); assert.equal(ev.base_price_cop, 60000);
    assert.equal(typeof ev.revenue_cop, "number"); assert.ok(["disponible", "ultimos_cupos", "agotado"].includes(ev.sales_state));
    assert.equal(ev.type_code, "fiesta"); assert.equal(ev.estado, "Disponible"); assert.equal(ev.location, "Canchas del Campus, Tuluá");
    assert.equal(ev.agent_id, AGENTE); assert.equal(ev.status, "planificado"); assert.equal(ev.availability, "open");
    const pasado = r.json.find((e) => e.id === "EVT-000009");
    assert.equal(pasado.status, "completado"); assert.equal(pasado.availability, "closed");
  });

  await t.test("geografía y catálogos", async () => {
    const ciudades = await call("GET", "/ciudades");
    assert.ok(ciudades.json.some((c) => c.nombre_ciudad === "Tuluá" && c.nombre_departamento === "Valle del Cauca" && c.nombre_pais === "Colombia"));
    const paises = await call("GET", "/geografia/paises");
    const deps = await call("GET", `/geografia/paises/${paises.json[0].id_pais}/departamentos`);
    assert.ok(deps.json.length >= 10);
    const cs = await call("GET", `/geografia/departamentos/${deps.json[0].id_departamento}/ciudades`);
    assert.ok(cs.json.length >= 1);
    assert.equal((await call("GET", "/catalogos/estados-evento")).json.length, 7);
    assert.deepEqual((await call("GET", "/catalogos/estados-reserva")).json.map((e) => e.nombre_estado), ["Confirmada", "Pendiente", "Cancelada"]);
    assert.equal((await call("GET", "/geografia/paises/abc/departamentos")).status, 400);
  });

  await t.test("cuentas: el rol sale de la herencia (Cliente / Agente / Administrador)", async () => {
    const r = await call("GET", "/accounts");
    assert.equal(r.json.length, 82);
    const rol = (id) => r.json.find((a) => a.id === id).role;
    assert.equal(rol(ADMIN), "admin"); assert.equal(rol(AGENTE), "agent"); assert.equal(rol(CARLOS), "user");
    assert.ok(r.json.every((a) => !("contrasena" in a) && !("password" in a)));
    const carlos = r.json.find((a) => a.id === CARLOS);
    assert.equal(carlos.loyalty_points, 140); assert.equal(carlos.city, "Tuluá"); assert.equal(carlos.phone, "315 678 9012");
  });

  await t.test("registro de una Persona: valida ciudad e identificación, guarda cliente + teléfono, rechaza duplicados", async () => {
    const tulua = (await call("GET", "/ciudades")).json.find((c) => c.nombre_ciudad === "Tuluá").id_ciudad;
    const okBody = { identificacion: "1112223334", name: "Lucía Fernanda Cortés", email: "Lucia.Cortes@Correo.co", password: "Clave1234", cityId: tulua, address: "Calle 10 # 5-20", phone: "300 123 4567" };
    const sinCiudad = await call("POST", "/personas", { ...okBody, cityId: undefined });
    assert.equal(sinCiudad.status, 422); assert.ok(sinCiudad.json.fields.cityId);
    const ciudadFalsa = await call("POST", "/personas", { ...okBody, cityId: 99999 });
    assert.equal(ciudadFalsa.status, 422);
    const idMalo = await call("POST", "/personas", { ...okBody, identificacion: "12" });
    assert.equal(idMalo.status, 422); assert.ok(idMalo.json.fields.identificacion);
    const clavedebil = await call("POST", "/personas", { ...okBody, password: "abc" });
    assert.equal(clavedebil.status, 422); assert.ok(clavedebil.json.fields.password);

    const ok = await call("POST", "/personas", { ...okBody, role: "admin" });          // aunque pida admin, SIEMPRE es cliente
    assert.equal(ok.status, 201, JSON.stringify(ok.json));
    assert.equal(ok.json.account.role, "user"); assert.equal(ok.json.account.email, "lucia.cortes@correo.co");
    const guardado = await one(`SELECT p.contrasena, cl.cantidad_puntos, cl.visualizacion_publicidad, (SELECT numero_telefono FROM telefono_persona WHERE numero_identificacion = p.numero_identificacion) AS tel
                                  FROM persona p JOIN cliente cl USING (numero_identificacion) WHERE p.numero_identificacion = $1`, ["1112223334"]);
    assert.match(guardado.contrasena, /^\$2[aby]\$/); assert.ok(!guardado.contrasena.includes("Clave1234"));   // bcrypt, nunca texto plano
    assert.equal(guardado.cantidad_puntos, 0); assert.equal(guardado.visualizacion_publicidad, true); assert.equal(guardado.tel, "300 123 4567");

    const mismoCorreo = await call("POST", "/personas", { ...okBody, identificacion: "9998887776", email: "lucia.cortes@correo.co" });
    assert.equal(mismoCorreo.status, 409); assert.match(mismoCorreo.json.error, /Ya existe una cuenta con este correo/);
    const mismoId = await call("POST", "/personas", { ...okBody, email: "otra@correo.co" });
    assert.equal(mismoId.status, 409); assert.match(mismoId.json.error, /número de identificación/);
    // un cliente puede comprar; es «nuevo» y no tiene puntos
    const q = await call("POST", "/checkout/quote", { eventId: TORNEO, userId: "1112223334", quantity: 1, zone: "general" });
    assert.equal(q.status, 200); assert.equal(q.json.user.isNewMember, true);
  });

  await t.test("el Administrador crea un Agente y cambia su rol; el perfil guarda ciudad, dirección y teléfono", async () => {
    const cali = (await call("GET", "/ciudades")).json.find((c) => c.nombre_ciudad === "Cali").id_ciudad;
    const mk = await call("POST", "/accounts", { identificacion: "1055566677", name: "Marta Lucía Ospina", email: "marta.ospina@eventpro.co", role: "agent", cityId: cali, experiencia: "2 años", phone: "311 555 6677" });
    assert.equal(mk.status, 201, JSON.stringify(mk.json));
    assert.equal((await call("GET", "/accounts/1055566677")).json.role, "agent");
    assert.equal((await one("SELECT experiencia, comision::float8 AS c FROM agente WHERE numero_identificacion = '1055566677'")).experiencia, "2 años");
    const up = await call("PUT", "/accounts/1055566677/profile", { name: "Marta Lucía Ospina R.", email: "marta.ospina@eventpro.co", phone: "311 000 1111", address: "Av. 6N # 20-30", cityId: cali });
    assert.equal(up.status, 200);
    const acc = (await call("GET", "/accounts/1055566677")).json;
    assert.equal(acc.phone, "311 000 1111"); assert.equal(acc.address, "Av. 6N # 20-30"); assert.equal(acc.name, "Marta Lucía Ospina R.");
    // agente → cliente → agente (sin eventos ni reservas se puede)
    assert.equal((await call("PUT", "/accounts/1055566677/role", { role: "user" })).status, 200);
    assert.equal((await call("GET", "/accounts/1055566677")).json.role, "user");
    assert.equal((await call("PUT", "/accounts/1055566677/role", { role: "agent" })).status, 200);
    // un cliente con reservas no puede volverse agente; un agente con eventos no puede volverse cliente
    const noCambia = await call("PUT", `/accounts/${CARLOS}/role`, { role: "agent" });
    assert.equal(noCambia.status, 400); assert.match(noCambia.json.error, /tiene reservas/);
    assert.equal((await call("PUT", `/accounts/${AGENTE}/role`, { role: "user" })).status, 400);
    assert.equal((await call("PUT", `/accounts/${ADMIN}/role`, { role: "user" })).status, 400);
    // eliminar: solo un administrador; nunca a sí mismo ni a quien tiene historial
    assert.equal((await call("DELETE", "/accounts/1055566677", { adminId: AGENTE })).status, 400);
    assert.equal((await call("DELETE", `/accounts/${ADMIN}`, { adminId: ADMIN })).status, 400);
    assert.equal((await call("DELETE", `/accounts/${CARLOS}`, { adminId: ADMIN })).status, 400);
    assert.equal((await call("DELETE", "/accounts/1055566677", { adminId: ADMIN })).status, 200);
    assert.equal((await one("SELECT COUNT(*)::int n FROM agente WHERE numero_identificacion = '1055566677'")).n, 0);          // cascada a la subclase
  });

  const nuevo = freshUsers[0];
  await t.test("cotización: P(x) = B·x·C − D(p), con puntos y oferta de nuevo ingreso", async () => {
    const r = await call("POST", "/checkout/quote", { eventId: ELECTRO, userId: nuevo.id, quantity: 2, zone: "vip", usePoints: true });
    assert.equal(r.status, 200);
    const q = r.json.quote;
    assert.equal(q.subtotal, 60000 * 2 * 2.5);                       // 300.000
    assert.equal(q.welcomeDiscount, 30000);                          // 10 % por ser cuenta nueva
    assert.equal(q.pointsUsed, 100); assert.equal(q.loyaltyDiscount, 2500);   // descuento leído de CLIENTE.cantidad_puntos
    assert.equal(q.total, 300000 - 30000 - 2500);
    assert.equal(r.json.user.isNewMember, true);
    assert.equal(r.json.zones.find((z) => z.code === "preferencial").unitPriceCop, 90000);
    assert.ok(r.headers.get("x-queue-ticket"), "el middleware entrega turno al vuelo");
  });

  let payment, comisionAntes;
  await t.test("pago aprobado: crea RESERVA + detalle, descuenta puntos y recalcula aforo y comisión", async () => {
    const before = await activas(ELECTRO);
    comisionAntes = (await call("GET", `/agents/${AGENTE}/commission`)).json;
    const r = await call("POST", "/checkout", { eventId: ELECTRO, userId: nuevo.id, quantity: 2, zone: "vip", usePoints: true, method: CARD });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    payment = r.json.payment;
    assert.equal(payment.totalCop, 267500); assert.equal(payment.last4, "4242"); assert.equal(payment.brand, "Visa");
    assert.equal(payment.pointsEarned, 267); assert.equal(payment.pointsBalance, 267);       // 100 − 100 + 267
    const res = await one(`SELECT r.*, er.nombre_estado, rp.zona, rp.ultimos4, rp.subtotal::float8 AS subtotal, rp.descuento_fidelizacion::float8 AS d1, rp.descuento_bienvenida::float8 AS d2
                             FROM reserva r JOIN estado_reserva er USING (id_estado_reserva) JOIN reserva_pago rp USING (id_reserva) WHERE r.id_reserva = $1`, [payment.reservaId]);
    assert.equal(res.id_cliente, nuevo.id); assert.equal(res.codigo_evento, ELECTRO); assert.equal(res.nombre_estado, "Confirmada");
    assert.equal(res.numero_entradas, 2); assert.equal(res.valor_total, 267500); assert.equal(res.zona, "vip"); assert.equal(res.ultimos4, "4242");
    assert.equal(res.subtotal - res.d1 - res.d2, res.valor_total);                           // P(x) = B·x·C − D(p) verificado en la base
    assert.equal((await activas(ELECTRO)).n - before.n, 2);
    assert.equal((await one("SELECT cantidad_puntos AS p FROM cliente WHERE numero_identificacion = $1", [nuevo.id])).p, 267);
    assert.ok(!JSON.stringify(await rows("SELECT * FROM reserva_pago")).includes("4242 4242"));   // nunca el número completo
    // la comisión de la agente (L = b·E + m·T) subió exactamente 2 entradas × m, y AGENTE.comision lo refleja
    const despues = (await call("GET", `/agents/${AGENTE}/commission`)).json;
    assert.equal(despues.ticketsManaged - comisionAntes.ticketsManaged, 2);
    assert.equal(despues.commissionCop - comisionAntes.commissionCop, 2 * despues.rule.perTicketCop);
    assert.equal(despues.storedCommissionCop, despues.commissionCop);
  });

  await t.test("no se puede comprar dos veces el mismo evento ni ser «nuevo» otra vez; solo los Clientes reservan", async () => {
    const r = await call("POST", "/checkout", { eventId: ELECTRO, userId: nuevo.id, quantity: 1, zone: "general", method: CARD });
    assert.equal(r.status, 409); assert.match(r.json.error, /Ya estás inscrito/);
    const q = await call("POST", "/checkout/quote", { eventId: TORNEO, userId: nuevo.id, quantity: 1, zone: "general" });
    assert.equal(q.json.user.isNewMember, false);
    const agente = await call("POST", "/checkout/quote", { eventId: ELECTRO, userId: AGENTE, quantity: 1, zone: "general" });
    assert.equal(agente.status, 403); assert.match(agente.json.error, /Cliente/);
    const fantasma = await call("POST", "/checkout/quote", { eventId: ELECTRO, userId: "9999999999", quantity: 1, zone: "general" });
    assert.equal(fantasma.status, 404); assert.equal(fantasma.json.code, "NO_ACCOUNT");
    assert.equal((await call("POST", "/checkout/quote", { eventId: "EVT-999999", userId: nuevo.id, quantity: 1, zone: "general" })).status, 404);
    assert.equal((await call("POST", "/checkout/quote", { eventId: "!!", userId: nuevo.id })).status, 400);
  });

  await t.test("tarjeta rechazada: 402 y no queda nada guardado; datos inválidos: 422 con campos", async () => {
    const u = freshUsers[1];
    const before = await one("SELECT COUNT(*)::int n FROM reserva");
    const declined = await call("POST", "/checkout", { eventId: ELECTRO, userId: u.id, quantity: 1, zone: "general", method: { ...CARD, number: "4000 0000 0000 0002" } });
    assert.equal(declined.status, 402); assert.match(declined.json.error, /fondos insuficientes/);
    const bad = await call("POST", "/checkout", { eventId: ELECTRO, userId: u.id, quantity: 1, zone: "general", method: { ...CARD, cvv: "1" } });
    assert.equal(bad.status, 422); assert.ok(bad.json.fields.cvv);
    assert.equal((await one("SELECT COUNT(*)::int n FROM reserva")).n, before.n);
    assert.equal((await one("SELECT COUNT(*)::int n FROM reserva WHERE id_cliente=$1", [u.id])).n, 0);
  });

  await t.test("evento gratis: se reserva sin método de pago y sin cobro", async () => {
    const u = freshUsers[2];
    const r = await call("POST", "/checkout", { eventId: TORNEO, userId: u.id, quantity: 3, zone: "general" });
    assert.equal(r.status, 201, JSON.stringify(r.json));
    assert.equal(r.json.payment.totalCop, 0); assert.equal(r.json.payment.method, "gratis"); assert.equal(r.json.payment.pointsEarned, 0);
  });

  await t.test("aforo: Disponible → Últimos cupos → Agotado (límite por la izquierda) y vuelve al cancelar, con causa", async () => {
    const ev = await call("POST", "/events", eventForm({ name: "Aforo exacto", capacity: 20, price_cop: 10000 }));
    const id = ev.json.id;
    await pool.query(`INSERT INTO reserva (valor_total, numero_entradas, id_cliente, codigo_evento, id_estado_reserva) VALUES (90000, 9, $2, $1, id_estado_reserva_de('Confirmada')), (80000, 8, $2, $1, id_estado_reserva_de('Confirmada'))`, [id, COMPRADOR]);
    const estado = async () => (await one("SELECT s.nombre_estado AS n FROM evento e JOIN estado_evento s USING (id_estado_evento) WHERE codigo_evento=$1", [id])).n;
    assert.equal(await estado(), "Disponible");                                        // vendidas 17, quedan 3 > 2
    const u = freshUsers;
    const buy = (i, n = 1) => call("POST", "/checkout", { eventId: id, userId: u[i].id, quantity: n, zone: "general", method: CARD });
    let r = await buy(3);  assert.equal(r.status, 201); assert.equal(r.json.salesState, "ultimos_cupos"); assert.equal(await estado(), "Últimos cupos");   // quedan 2
    r = await buy(4, 3);   assert.equal(r.status, 409); assert.match(r.json.error, /Solo quedan 2/);
    r = await buy(4, 2);   assert.equal(r.status, 201); assert.equal(r.json.salesState, "agotado"); assert.equal(await estado(), "Agotado");
    r = await buy(5);      assert.equal(r.status, 409); assert.match(r.json.error, /sin cupos/);
    // cancelar exige causa; con causa libera cupos y el estado vuelve solo
    const sinCausa = await call("POST", "/unregister", { eventId: id, userId: u[4].id });
    assert.equal(sinCausa.status, 400); assert.equal(sinCausa.json.code, "CAUSA_REQUERIDA");
    const c = await call("POST", "/unregister", { eventId: id, userId: u[4].id, causa: "Me enfermé" });
    assert.equal(c.status, 200);
    assert.equal(await estado(), "Últimos cupos");
    const guardada = await one("SELECT r.causa_cancelacion, er.nombre_estado FROM reserva r JOIN estado_reserva er USING (id_estado_reserva) WHERE r.id_cliente=$1 AND r.codigo_evento=$2", [u[4].id, id]);
    assert.deepEqual([guardada.causa_cancelacion, guardada.nombre_estado], ["Me enfermé", "Cancelada"]);
    // subir el aforo recalcula; bajarlo por debajo de lo vendido se rechaza
    await call("PUT", `/events/${id}/capacity`, { capacity: 40 });
    assert.equal(await estado(), "Disponible");
    const bad = await call("PUT", `/events/${id}/capacity`, { capacity: 5 });
    assert.equal(bad.status, 400); assert.match(bad.json.error, /no puede ser menor/);
  });

  await t.test("cancelar una reserva: reembolso simulado, reversión de puntos y causa guardada", async () => {
    const antesDeCancelar = (await call("GET", `/agents/${AGENTE}/commission`)).json;
    const sinCausa = await call("POST", `/reservas/${payment.reservaId}/cancel`, { actorId: nuevo.id });
    assert.equal(sinCausa.status, 400);
    const ajeno = await call("POST", `/reservas/${payment.reservaId}/cancel`, { actorId: freshUsers[8].id, causa: "no es mía" });
    assert.equal(ajeno.status, 400); assert.match(ajeno.json.error, /No tienes permiso/);
    const c = await call("POST", "/unregister", { eventId: ELECTRO, userId: nuevo.id, causa: "Cambio de planes" });
    assert.equal(c.status, 200);
    assert.equal((await one("SELECT reembolsado FROM reserva_pago WHERE id_reserva=$1", [payment.reservaId])).reembolsado, true);
    const res = await one("SELECT er.nombre_estado, r.causa_cancelacion FROM reserva r JOIN estado_reserva er USING (id_estado_reserva) WHERE id_reserva=$1", [payment.reservaId]);
    assert.deepEqual([res.nombre_estado, res.causa_cancelacion], ["Cancelada", "Cambio de planes"]);
    assert.equal((await one("SELECT cantidad_puntos AS p FROM cliente WHERE numero_identificacion=$1", [nuevo.id])).p, 100);    // devolvió lo canjeado y retiró lo ganado
    assert.equal((await call("POST", "/unregister", { eventId: ELECTRO, userId: nuevo.id, causa: "otra vez" })).status, 404);
    const despues = (await call("GET", `/agents/${AGENTE}/commission`)).json;                                                 // la comisión también baja
    assert.equal(antesDeCancelar.commissionCop - despues.commissionCop, 2 * despues.rule.perTicketCop);
    // comprar de nuevo es posible, pero ya NO es «nuevo»
    const q = await call("POST", "/checkout/quote", { eventId: ELECTRO, userId: nuevo.id, quantity: 1, zone: "general" });
    assert.equal(q.json.user.isNewMember, false); assert.equal(q.json.quote.welcomeDiscount, 0);
  });

  await t.test("cancelar un EVENTO: exige causa, queda «Cancelado» y cancela (con reembolso) todas sus reservas", async () => {
    const ev = await call("POST", "/events", eventForm({ name: "Evento a cancelar", capacity: 50, price_cop: 20000 }));
    const id = ev.json.id;
    const a = freshUsers[9], b = freshUsers[10];
    const ra = await call("POST", "/checkout", { eventId: id, userId: a.id, quantity: 2, zone: "general", usePoints: true, method: CARD });
    const rb = await call("POST", "/checkout", { eventId: id, userId: b.id, quantity: 1, zone: "general", method: CARD });
    assert.equal(ra.status, 201); assert.equal(rb.status, 201);
    assert.equal((await call("POST", `/events/${id}/cancel`, { actorId: AGENTE })).status, 400);                         // sin causa
    const otro = await call("POST", `/events/${id}/cancel`, { actorId: TORNEO_AGENTE, causa: "Lluvia" });
    assert.equal(otro.status, 400); assert.match(otro.json.error, /No tienes permiso/);                                   // otra agente no puede
    const ok = await call("POST", `/events/${id}/cancel`, { actorId: AGENTE, causa: "Mal clima: se reprogramará" });
    assert.equal(ok.status, 200, JSON.stringify(ok.json)); assert.equal(ok.json.reservasCanceladas, 2);
    const e = (await call("GET", "/events")).json.find((x) => x.id === id);
    assert.equal(e.estado, "Cancelado"); assert.equal(e.status, "cancelado"); assert.equal(e.cancel_reason, "Mal clima: se reprogramará"); assert.equal(e.registered, 0);
    const rs = await rows("SELECT er.nombre_estado, r.causa_cancelacion FROM reserva r JOIN estado_reserva er USING (id_estado_reserva) WHERE codigo_evento=$1", [id]);
    assert.ok(rs.length === 2 && rs.every((x) => x.nombre_estado === "Cancelada" && /^Evento cancelado: Mal clima/.test(x.causa_cancelacion)));
    assert.equal((await one("SELECT cantidad_puntos AS p FROM cliente WHERE numero_identificacion=$1", [a.id])).p, 100);   // puntos revertidos
    assert.equal((await call("POST", `/events/${id}/cancel`, { actorId: AGENTE, causa: "otra vez" })).status, 400);       // ya estaba cancelado
    assert.equal((await call("PUT", `/events/${id}`, eventForm({ name: "x" }))).status, 409);                             // no se edita un evento cancelado
    const compra = await call("POST", "/checkout/quote", { eventId: id, userId: freshUsers[11].id, quantity: 1, zone: "general" });
    assert.equal(compra.status, 409);                                                                                       // ya no se vende
    assert.equal((await call("DELETE", `/events/${id}`)).status, 409);                                                      // con reservas no se borra
  });

  await t.test("carrera de precio: si el precio cambió mientras pagaba, la base lo rechaza", async () => {
    const u = freshUsers[6];
    await assert.rejects(
      pool.query("SELECT * FROM confirmar_reserva($1,$2,1,'general',59000,1,59000,0,0,0,59000,59,'tarjeta','Visa','4242')", [ELECTRO, u.id]),
      /El precio del evento cambió/);
    await assert.rejects(
      pool.query("SELECT * FROM confirmar_reserva($1,$2,1,'general',60000,1,60000,0,0,0,60000,60,'tarjeta','Visa','4242')", [ELECTRO, "9999999999"]),
      /Solo las cuentas de Cliente/);
    await assert.rejects(
      pool.query("SELECT * FROM confirmar_reserva($1,$2,1,'general',60000,1,60000,0,0,0,50000,50,'tarjeta','Visa','4242')", [ELECTRO, u.id]),
      /El total no coincide/);
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
    assert.equal((await call("GET", "/admin/reports/revenue?year=abc")).status, 400);
  });

  await t.test("comisión del Agente: L(E,T) = b·E + m·T, desglose por evento y valor guardado en AGENTE.comision", async () => {
    const a = await call("GET", `/agents/${AGENTE}/commission`);
    assert.equal(a.status, 200);
    assert.equal(a.json.commissionCop, a.json.rule.perEventCop * a.json.eventsManaged + a.json.rule.perTicketCop * a.json.ticketsManaged);
    assert.equal(a.json.breakdown.reduce((s, b) => s + b.subtotalCop, 0), a.json.commissionCop);
    assert.equal(a.json.storedCommissionCop, a.json.commissionCop);
    // el cliente no es agente; id inválido
    assert.equal((await call("GET", `/agents/${CARLOS}/commission`)).status, 404);
    assert.equal((await call("GET", "/agents/%20/commission")).status, 400);
    // cancelar un evento saca ese evento de E
    const tmp = await call("POST", "/events", eventForm({ name: "Evento temporal", created_by: TORNEO_AGENTE }));
    const antes = (await call("GET", `/agents/${TORNEO_AGENTE}/commission`)).json;
    await call("POST", `/events/${tmp.json.id}/cancel`, { actorId: TORNEO_AGENTE, causa: "Se cae la logística" });
    const despues = (await call("GET", `/agents/${TORNEO_AGENTE}/commission`)).json;
    assert.equal(antes.eventsManaged - despues.eventsManaged, 1);
    assert.equal(antes.commissionCop - despues.commissionCop, antes.rule.perEventCop);
  });

  await t.test("precios dinámicos: un máximo local de demanda sube B; el precio_base del Agente no cambia", async () => {
    const ev = await call("POST", "/events", eventForm({ name: "Evento de demanda", capacity: 5000, price_cop: 50000 }));
    const id = ev.json.id;
    // ingresos por hora, de la más antigua a la más reciente completa: sube, pico (1.2 M) y baja
    const curve = [100000, 150000, 200000, 300000, 500000, 700000, 1200000, 600000];
    for (let i = 0; i < curve.length; i++) {
      const hoursAgo = curve.length - i;
      await pool.query(`INSERT INTO reserva (fecha_hora_reserva, valor_total, numero_entradas, id_cliente, codigo_evento, id_estado_reserva)
                        VALUES (date_trunc('hour', now() AT TIME ZONE 'America/Bogota') - ($3 || ' hours')::interval + interval '20 minutes', $2, 1, $4, $1, id_estado_reserva_de('Confirmada'))`,
        [id, curve[i], hoursAgo, COMPRADOR]);
    }
    const precios = async () => { const e = (await call("GET", "/events")).json.find((x) => x.id === id); return [e.price_cop, e.base_price_cop]; };
    const peek = await call("GET", `/events/${id}/pricing`);
    assert.equal(peek.json.decision.action, "raise"); assert.equal(peek.json.decision.applied, false);
    assert.deepEqual(await precios(), [50000, 50000]);                                              // consultar no cambia nada

    const go = await call("POST", `/events/${id}/pricing/evaluate`);
    assert.equal(go.json.decision.applied, true); assert.equal(go.json.event.currentPriceCop, 52500);
    assert.deepEqual(await precios(), [52500, 50000]);                                              // vigente sube; precio_base (ER) intacto
    assert.equal((await one("SELECT precio_base::float8 AS b FROM evento WHERE codigo_evento=$1", [id])).b, 50000);
    assert.equal((await rows("SELECT * FROM ajuste_precio WHERE codigo_evento=$1", [id])).length, 1);
    const again = await call("POST", `/events/${id}/pricing/evaluate`);                              // enfriamiento: no vuelve a subir
    assert.equal(again.json.decision.action, "hold");
    // la compra se cobra al precio VIGENTE
    const q = await call("POST", "/checkout/quote", { eventId: id, userId: freshUsers[7].id, quantity: 1, zone: "general" });
    assert.equal(q.json.event.unitPriceCop, 52500);

    // El Agente edita SIN tocar el precio (el formulario manda el vigente): el precio_base no se pisa
    const form = eventForm({ name: "Evento de demanda 2", capacity: 5000, price_cop: 52500 });
    assert.equal((await call("PUT", `/events/${id}`, form)).status, 200);
    assert.deepEqual(await precios(), [52500, 50000]);
    // El Agente fija un precio nuevo: ambos se igualan (se reinicia el ajuste dinámico)
    assert.equal((await call("PUT", `/events/${id}`, { ...form, price_cop: 55000 })).status, 200);
    assert.deepEqual(await precios(), [55000, 55000]);
  });

  await t.test("fila virtual: con T'(x) sobre el umbral el pago se intercepta; al normalizarse se entra", async () => {
    const u = { id: "1100000030" };                    // cliente que aún no ha consultado ningún pago (sin turno previo)
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

  await t.test("Agente: crear/editar/borrar evento; el creador debe existir en AGENTE", async () => {
    const create = await call("POST", "/events", eventForm({ end_time: "23:30", observations: "Traer carnet" }));
    assert.equal(create.status, 201, JSON.stringify(create.json));
    const id = create.json.id;
    const ev = (await call("GET", "/events")).json.find((e) => e.id === id);
    assert.equal(ev.start_time, "20:00"); assert.equal(ev.end_time, "23:30"); assert.equal(ev.observaciones, "Traer carnet");
    assert.equal(ev.city, "Tuluá");                                                                  // sin ciudad: la del agente
    assert.equal(ev.coordinator, "Carmen López"); assert.equal(ev.estado, "Disponible");
    // fin por defecto = inicio + 3 h
    const d = await call("POST", "/events", eventForm({ name: "Sin hora de fin" }));
    assert.equal((await call("GET", "/events")).json.find((e) => e.id === d.json.id).end_time, "23:00");
    // el creador debe ser un AGENTE
    for (const quien of [CARLOS, ADMIN, "0000000000", undefined]) {
      const r = await call("POST", "/events", eventForm({ created_by: quien }));
      assert.equal(r.status, 403, String(quien)); assert.match(r.json.error, /agente registrado/);
    }
    // validaciones
    const bad = await call("POST", "/events", eventForm({ name: "ab", capacity: 0, price_cop: -5, event_date: "mañana", start_time: "25:00" }));
    assert.equal(bad.status, 422); assert.ok(bad.json.fields.name && bad.json.fields.capacity && bad.json.fields.price && bad.json.fields.event_date && bad.json.fields.start_time);
    assert.equal((await call("POST", "/events", eventForm({ end_time: "19:00" }))).status, 422);
    assert.equal((await call("POST", "/events", eventForm({ cityId: 99999 }))).status, 422);
    // pausar / cerrar / reabrir
    assert.equal((await call("PUT", `/events/${id}/availability`, { availability: "paused" })).status, 200);
    let e2 = (await call("GET", "/events")).json.find((e) => e.id === id);
    assert.deepEqual([e2.estado, e2.availability], ["Pausado", "paused"]);
    assert.equal((await call("POST", "/checkout/quote", { eventId: id, userId: freshUsers[7].id, quantity: 1, zone: "general" })).status, 409);
    assert.equal((await call("PUT", `/events/${id}/availability`, { availability: "open" })).status, 200);
    e2 = (await call("GET", "/events")).json.find((e) => e.id === id);
    assert.deepEqual([e2.estado, e2.availability], ["Disponible", "open"]);
    assert.equal((await call("PUT", `/events/${id}/availability`, { availability: "x" })).status, 400);
    assert.equal((await call("DELETE", `/events/${id}`)).status, 200);                               // sin reservas se puede borrar
    assert.equal((await call("DELETE", `/events/${id}`)).status, 404);
  });

  await t.test("Precio ideal: POST /events/price-suggestion modela I(x), deriva y exige I″ < 0", async () => {
    const ok = await call("POST", "/events/price-suggestion", { typeCode: "fiesta", capacity: 1000, currentPrice: 20000 });
    assert.equal(ok.status, 200);
    const j = ok.json;
    assert.ok(j.model.M > 0 && j.model.k > 0);
    assert.ok(Math.abs(j.optimum.price - j.model.M / (2 * j.model.k)) < 1);                  // x* = M/2k
    assert.ok(j.guarantee.secondDerivative < 0 && j.guarantee.isNegative && j.guarantee.concaveDown);
    assert.ok(Math.abs(j.guarantee.secondDerivative + 2 * j.model.k) < 1e-6);                  // I″ = −2k
    assert.equal(j.recommended.price % 500, 0);
    assert.ok(j.compare.expectedRevenue <= j.recommended.expectedRevenue);                     // nunca peor que el precio actual
    assert.equal(j.curve.xs.length, j.curve.revenue.length);
    // sin tipo: usa todo el historial de eventos pagos (el ER no guarda «tipo»)
    const sinTipo = await call("POST", "/events/price-suggestion", { capacity: 1000 });
    assert.equal(sinTipo.status, 200); assert.ok(sinTipo.json.model.samples >= j.model.samples);
    // el Agente fija M y k a mano
    const manual = await call("POST", "/events/price-suggestion", { typeCode: "fiesta", capacity: 1000, M: 1500, k: 0.015 });
    assert.equal(manual.json.model.source, "manual"); assert.equal(manual.json.optimum.price, 50000); assert.equal(manual.json.recommended.price, 50000);
    // tipo sin historial → estimación inicial; datos inválidos → 400 sin filtrar nada interno
    const none = await call("POST", "/events/price-suggestion", { typeCode: "no-existe", capacity: 300 });
    assert.equal(none.status, 200); assert.equal(none.json.model.source, "inicial");
    for (const bad of [{ typeCode: "fiesta", capacity: 0 }, { typeCode: "fiesta", capacity: 100, k: -1 }, { typeCode: "fiesta", capacity: 100, M: "abc" }, { typeCode: "fiesta", capacity: 100, eventId: "!!" }]) {
      const r = await call("POST", "/events/price-suggestion", bad);
      assert.equal(r.status, 400); assert.ok(!/select|constraint|pg_|stack/i.test(JSON.stringify(r.json)));
    }
    // un evento editado se excluye de su propio historial
    const conId = await call("POST", "/events/price-suggestion", { typeCode: "fiesta", capacity: 1000, eventId: ELECTRO });
    assert.equal(conId.status, 200);
  });

  await t.test("errores: nunca se filtra SQL ni nombres internos; rutas eliminadas devuelven 404", async () => {
    const dup = await call("POST", "/accounts", { identificacion: "7778889990", name: "Otro Carlos", email: "user@eventpro.com", role: "user", cityId: 1 });
    assert.equal(dup.status, 409); assert.ok(!/uq_persona|persona_|violates/i.test(JSON.stringify(dup.json)));
    const badRole = await call("PUT", `/accounts/${CARLOS}/role`, { role: "superadmin" });
    assert.equal(badRole.status, 400); assert.ok(!/constraint|violates/i.test(JSON.stringify(badRole.json)));
    assert.equal((await call("GET", "/accounts/ab")).status, 400);
    assert.equal((await call("GET", "/accounts/1999999999")).status, 404);
    assert.equal((await call("PUT", "/attendees/abc/status", { status: "confirmado" })).status, 400);
    const raw = await fetch(base + "/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{malo" });
    assert.equal(raw.status, 400);
    for (const gone of ["/tasks", "/accounts/1/status"]) assert.equal((await call("GET", gone)).status, 404);
    assert.equal((await call("GET", "/no-existe")).status, 404);
    assert.equal((await call("GET", "/health")).json.ok, true);
  });

  await t.test("reservas (lista del Agente): una fila por reserva con tipo de estado del catálogo", async () => {
    const r = await call("GET", "/attendees");
    assert.equal(r.status, 200);
    const mia = r.json.find((a) => a.user_id === CARLOS && a.event_id === "EVT-000002");
    assert.deepEqual([mia.status, mia.estado, mia.tickets, mia.total_paid], ["confirmado", "Confirmada", 1, 25000]);
    assert.ok(r.json.some((a) => a.status === "cancelado" && a.cancel_reason));
    const pend = r.json.find((a) => a.status === "pendiente");
    assert.equal((await call("PUT", `/attendees/${pend.id}/status`, { status: "confirmado" })).status, 200);
    assert.equal((await call("PUT", `/attendees/${pend.id}/status`, { status: "confirmado" })).status, 409);       // ya no estaba pendiente
    assert.equal((await call("PUT", `/attendees/${pend.id}/status`, { status: "cancelado" })).status, 400);        // cancelar pide causa: otra ruta
  });

  await pool.close();
});
