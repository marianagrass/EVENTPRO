/* ==========================================================
   models/eventoModel.js — EVENTO (+ estado, ciudad y agente)
   El «precio vigente» (el que mueve el algoritmo de precios dinámicos) NO es una columna del ER:
   se calcula con precio_vigente() a partir de precio_base y de la bitácora ajuste_precio.
   ========================================================== */
const { classifyType } = require("../lib/event-presentation");

const AHORA = "(now() AT TIME ZONE 'America/Bogota')";

const SELECT_EVENTO = `
  SELECT e.codigo_evento AS id, e.nombre_evento AS name, e.descripcion AS description, e.teatro,
         ci.nombre_ciudad AS city, e.id_ciudad AS city_id,
         to_char(e.fecha_hora_inicio, 'YYYY-MM-DD') AS event_date, to_char(e.fecha_hora_inicio, 'HH24:MI') AS start_time,
         to_char(e.fecha_hora_fin, 'YYYY-MM-DD')    AS end_date,   to_char(e.fecha_hora_fin, 'HH24:MI')    AS end_time,
         s.nombre_estado AS estado, e.id_estado_evento,
         CASE WHEN s.nombre_estado = 'Cancelado' THEN 'cancelado'
              WHEN s.nombre_estado = 'Finalizado' OR e.fecha_hora_fin <= ${AHORA} THEN 'completado'
              WHEN e.fecha_hora_inicio <= ${AHORA} THEN 'en_progreso' ELSE 'planificado' END AS status,
         CASE WHEN s.nombre_estado = 'Pausado' THEN 'paused'
              WHEN s.nombre_estado IN ('Cerrado', 'Cancelado', 'Finalizado') THEN 'closed' ELSE 'open' END AS availability,
         v.capacidad_total AS capacity, v.precio_vigente::float8 AS price_cop, v.precio_base::float8 AS base_price_cop,
         v.inscritos AS registered, v.ingresos::float8 AS revenue_cop, v.cupos_disponibles AS spots_left, v.estado_ventas AS sales_state,
         e.observaciones, e.causa_cancelacion AS cancel_reason, e.id_agente AS agent_id, pa.nombre_completo AS coordinator
    FROM evento e
    JOIN estado_evento s ON s.id_estado_evento = e.id_estado_evento
    JOIN ciudad ci ON ci.id_ciudad = e.id_ciudad
    JOIN v_evento_ventas v ON v.codigo_evento = e.codigo_evento
    JOIN persona pa ON pa.numero_identificacion = e.id_agente`;

/** Fila de la BD → objeto que consume el front (agrega lo derivado: tipo, lugar completo, imagen vacía). */
function aApi(r) {
  return {
    ...r,
    location: r.city ? `${r.teatro}, ${r.city}` : r.teatro,
    type_code: classifyType(r.name, r.description),
    image_url: null,                       // el ER no guarda imagen: el front usa la de su tipo
    is_public: !["cancelado"].includes(r.status),
    created_by: r.agent_id,
  };
}

module.exports = function eventoModel(pool) {
  const rows = async (sql, p) => (await pool.query(sql, p)).rows;
  return {
    aApi,
    async listar() { return (await rows(`${SELECT_EVENTO} ORDER BY e.fecha_hora_inicio ASC`)).map(aApi); },
    async obtener(codigo) { const r = (await rows(`${SELECT_EVENTO} WHERE e.codigo_evento = $1`, [codigo]))[0]; return r ? aApi(r) : null; },

    async crear(d) {
      const r = await rows(
        `INSERT INTO evento (nombre_evento, descripcion, teatro, fecha_hora_inicio, fecha_hora_fin, capacidad_total, precio_base,
                             observaciones, id_ciudad, id_estado_evento, id_agente)
         VALUES ($1,$2,$3,$4::timestamp, COALESCE($5::timestamp, $4::timestamp + interval '3 hours'), $6,$7,$8,$9, id_estado_evento_de('Disponible'), $10) RETURNING codigo_evento`,
        [d.nombre, d.descripcion, d.teatro, d.inicio, d.fin, d.capacidad, d.precio, d.observaciones, d.idCiudad, d.idAgente]);
      await pool.query("SELECT refrescar_estado_evento($1)", [r[0].codigo_evento]);
      return r[0].codigo_evento;
    },

    /** Edita un evento. Si el precio enviado difiere del vigente, pasa a ser el nuevo precio_base y se reinicia el ajuste dinámico. */
    async actualizar(codigo, d) {
      const r = await pool.query(
        `WITH cambio AS (SELECT ($7::numeric IS DISTINCT FROM precio_vigente($10)) AS c),
              reinicio AS (UPDATE ajuste_precio SET vigente = FALSE
                            WHERE codigo_evento = $10 AND vigente AND (SELECT c FROM cambio) RETURNING 1)
         UPDATE evento SET nombre_evento = $1, descripcion = $2, teatro = $3, fecha_hora_inicio = $4::timestamp,
                fecha_hora_fin = COALESCE($5::timestamp, $4::timestamp + interval '3 hours'),
                capacidad_total = $6, precio_base = CASE WHEN (SELECT c FROM cambio) THEN $7 ELSE precio_base END,
                observaciones = $8, id_ciudad = $9
          WHERE codigo_evento = $10`,
        [d.nombre, d.descripcion, d.teatro, d.inicio, d.fin, d.capacidad, d.precio, d.observaciones, d.idCiudad, codigo]);
      return r.rowCount;
    },

    async cambiarCapacidad(codigo, capacidad) {
      return (await pool.query("UPDATE evento SET capacidad_total = $1 WHERE codigo_evento = $2", [capacidad, codigo])).rowCount;
    },
    cambiarDisponibilidad: (codigo, disponibilidad) => pool.query("SELECT cambiar_disponibilidad_evento($1,$2)", [codigo, disponibilidad]),

    /** Cancela el evento con su causa y cancela (con reembolso) todas sus reservas activas. Devuelve cuántas. */
    async cancelar(codigo, idActor, causa) {
      return (await rows("SELECT cancelar_evento($1,$2,$3) AS reservas_canceladas", [codigo, idActor, causa]))[0].reservas_canceladas;
    },

    async tieneReservas(codigo) { return (await rows("SELECT 1 FROM reserva WHERE codigo_evento = $1 LIMIT 1", [codigo])).length > 0; },
    async eliminar(codigo) { return (await pool.query("DELETE FROM evento WHERE codigo_evento = $1", [codigo])).rowCount; },
  };
};
