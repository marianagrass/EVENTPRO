/* ==========================================================
   models/reporteModel.js — Consultas de reportes (ingresos mensuales) y comisión del Agente
   ========================================================== */
module.exports = function reporteModel(pool) {
  const rows = async (sql, p) => (await pool.query(sql, p)).rows;
  const ACTIVAS = "er.nombre_estado IN ('Confirmada', 'Pendiente') AND s.nombre_estado <> 'Cancelado' AND r.valor_total > 0";
  return {
    /** f(t): flujo de ingresos de cada día del año (COP/día) y entradas vendidas. */
    flujoDiario: (anio) => rows(
      `WITH dias AS (
         SELECT generate_series(make_date($1, 1, 1), make_date($1, 12, 31), interval '1 day')::DATE AS dia
       ), ventas AS (
         SELECT r.fecha_hora_reserva::DATE AS dia, SUM(r.valor_total)::float8 AS ingresos, SUM(r.numero_entradas)::INT AS entradas
           FROM reserva r JOIN evento e ON e.codigo_evento = r.codigo_evento
           JOIN estado_evento s ON s.id_estado_evento = e.id_estado_evento
           JOIN estado_reserva er ON er.id_estado_reserva = r.id_estado_reserva
          WHERE ${ACTIVAS} GROUP BY 1
       )
       SELECT to_char(d.dia, 'YYYY-MM-DD') AS day, COALESCE(v.ingresos, 0)::float8 AS revenue, COALESCE(v.entradas, 0)::INT AS tickets
         FROM dias d LEFT JOIN ventas v ON v.dia = d.dia ORDER BY d.dia`, [anio]),

    /** Total directo con SUM(): se contrasta contra la integral numérica. */
    async totalDirecto(anio) {
      return (await rows(
        `SELECT COALESCE(SUM(r.valor_total), 0)::float8 AS total
           FROM reserva r JOIN evento e ON e.codigo_evento = r.codigo_evento
           JOIN estado_evento s ON s.id_estado_evento = e.id_estado_evento
           JOIN estado_reserva er ON er.id_estado_reserva = r.id_estado_reserva
          WHERE ${ACTIVAS} AND r.fecha_hora_reserva::DATE BETWEEN make_date($1, 1, 1) AND make_date($1, 12, 31)`, [anio]))[0].total;
    },

    async actividadAgente(id) {
      return (await rows("SELECT id_agente, nombre_completo, eventos_gestionados, entradas_gestionadas FROM v_agente_actividad WHERE id_agente = $1", [id]))[0] || null;
    },
    async reglaComision() {
      return (await rows("SELECT valor_por_evento::float8 AS b, valor_por_entrada::float8 AS m FROM regla_comision WHERE id = 1"))[0];
    },
    /** Desglose por evento del agente: cuántas entradas confirmadas vendió cada uno. */
    desgloseAgente: (id) => rows(
      `SELECT e.codigo_evento AS id, e.nombre_evento AS name, to_char(e.fecha_hora_inicio, 'YYYY-MM-DD') AS date,
              COALESCE((SELECT SUM(r.numero_entradas) FROM reserva r JOIN estado_reserva er ON er.id_estado_reserva = r.id_estado_reserva
                         WHERE r.codigo_evento = e.codigo_evento AND er.nombre_estado = 'Confirmada'), 0)::INT AS tickets
         FROM evento e JOIN estado_evento s ON s.id_estado_evento = e.id_estado_evento
        WHERE e.id_agente = $1 AND s.nombre_estado <> 'Cancelado' ORDER BY e.fecha_hora_inicio DESC`, [id]),
    /** Valor guardado en AGENTE.comision (lo mantiene recalcular_comision_agente). */
    async comisionGuardada(id) { return (await rows("SELECT comision::float8 AS c FROM agente WHERE numero_identificacion = $1", [id]))[0]?.c ?? null; },
  };
};
