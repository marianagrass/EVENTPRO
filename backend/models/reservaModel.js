/* ==========================================================
   models/reservaModel.js — RESERVA (+ detalle del pago, cliente y zonas)
   Una RESERVA = una compra: numero_entradas = x, valor_total = P(x).
   ========================================================== */
const ESTADO_API = { Confirmada: "confirmado", Pendiente: "pendiente", Cancelada: "cancelado" };

module.exports = function reservaModel(pool) {
  const rows = async (sql, p) => (await pool.query(sql, p)).rows;
  return {
    ESTADO_API,

    /** Reservas con los nombres que usa el front (antes «attendees»). */
    async listar() {
      const r = await rows(
        `SELECT r.id_reserva AS id, r.id_cliente AS user_id, p.nombre_completo AS name, p.correo_electronico AS email,
                (SELECT t.numero_telefono FROM telefono_persona t WHERE t.numero_identificacion = p.numero_identificacion ORDER BY t.id_telefono LIMIT 1) AS phone,
                r.codigo_evento AS event_id, e.nombre_evento AS event_name, er.nombre_estado AS estado,
                COALESCE(rp.zona, 'general') AS zone_code, to_char(r.fecha_hora_reserva, 'YYYY-MM-DD"T"HH24:MI:SS') AS registered_at,
                r.numero_entradas AS tickets, r.valor_total::float8 AS total_paid, r.causa_cancelacion AS cancel_reason, r.observaciones,
                rp.codigo_pago AS payment_code
           FROM reserva r
           JOIN persona p ON p.numero_identificacion = r.id_cliente
           JOIN evento e ON e.codigo_evento = r.codigo_evento
           JOIN estado_reserva er ON er.id_estado_reserva = r.id_estado_reserva
           LEFT JOIN reserva_pago rp ON rp.id_reserva = r.id_reserva
          ORDER BY r.fecha_hora_reserva DESC, r.id_reserva DESC`);
      return r.map((x) => ({ ...x, status: ESTADO_API[x.estado] || "pendiente", checked_in_at: null }));
    },

    zonas: () => rows("SELECT codigo AS code, etiqueta AS label, coeficiente::float8 AS coefficient FROM zona ORDER BY orden"),

    /** Todo lo necesario para calcular P(x) de una compra (sin escribir nada). */
    async contextoCheckout(codigoEvento, idCliente) {
      const [ev, cl, dup] = await Promise.all([
        rows(`SELECT e.codigo_evento AS id, e.nombre_evento AS name, v.precio_vigente::float8 AS price_cop, v.precio_base::float8 AS base_price_cop,
                     v.capacidad_total AS capacity, v.inscritos AS registered, v.estado_ventas AS sales_state, s.nombre_estado AS estado,
                     (e.fecha_hora_fin <= (now() AT TIME ZONE 'America/Bogota')) AS terminado
                FROM evento e JOIN v_evento_ventas v ON v.codigo_evento = e.codigo_evento
                JOIN estado_evento s ON s.id_estado_evento = e.id_estado_evento WHERE e.codigo_evento = $1`, [codigoEvento]),
        rows(`SELECT p.numero_identificacion AS id, p.nombre_completo AS name, c.cantidad_puntos AS loyalty_points,
                     es_cliente_nuevo(c.numero_identificacion) AS is_new
                FROM persona p JOIN cliente c ON c.numero_identificacion = p.numero_identificacion WHERE p.numero_identificacion = $1`, [idCliente]),
        rows(`SELECT 1 FROM reserva r JOIN estado_reserva er ON er.id_estado_reserva = r.id_estado_reserva
               WHERE r.codigo_evento = $1 AND r.id_cliente = $2 AND er.nombre_estado <> 'Cancelada' LIMIT 1`, [codigoEvento, idCliente]),
      ]);
      return { ev: ev[0] || null, cliente: cl[0] || null, yaInscrito: dup.length > 0 };
    },

    async existePersona(id) { return (await rows("SELECT 1 FROM persona WHERE numero_identificacion = $1", [id])).length > 0; },

    /** Guarda la compra (función SQL confirmar_reserva: revalida y escribe todo en una sola transacción). */
    async confirmar(c) {
      const r = await rows("SELECT * FROM confirmar_reserva($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
        [c.codigoEvento, c.idCliente, c.cantidad, c.zona, c.precioUnitario, c.coeficiente, c.subtotal,
         c.puntosUsados, c.descuentoFidelizacion, c.descuentoBienvenida, c.total, c.puntosGanados, c.metodo, c.marca, c.ultimos4]);
      return r[0];
    },

    async estadoVentasEvento(codigo) { return (await rows("SELECT estado_ventas FROM v_evento_ventas WHERE codigo_evento = $1", [codigo]))[0]?.estado_ventas ?? null; },

    cancelar: (idReserva, idActor, causa) => pool.query("SELECT cancelar_reserva($1,$2,$3)", [idReserva, idActor, causa]),

    /** La reserva activa de un cliente en un evento (para «cancelar mi inscripción»). */
    async reservaActiva(codigoEvento, idCliente) {
      return (await rows(
        `SELECT r.id_reserva FROM reserva r JOIN estado_reserva er ON er.id_estado_reserva = r.id_estado_reserva
          WHERE r.codigo_evento = $1 AND r.id_cliente = $2 AND er.nombre_estado <> 'Cancelada' ORDER BY r.id_reserva DESC LIMIT 1`,
        [codigoEvento, idCliente]))[0] || null;
    },

    /** Pendiente → Confirmada (lo hace el Agente). */
    async confirmarPendiente(idReserva) {
      return (await pool.query(
        `UPDATE reserva SET id_estado_reserva = id_estado_reserva_de('Confirmada')
          WHERE id_reserva = $1 AND id_estado_reserva = id_estado_reserva_de('Pendiente')`, [idReserva])).rowCount;
    },
  };
};
