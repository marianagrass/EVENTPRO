/* ==========================================================
   models/precioModel.js — Consultas de precios dinámicos y de «precio ideal»
   (la matemática vive en lib/pricing.js y lib/optimization.js; aquí solo se leen y escriben datos)
   ========================================================== */
module.exports = function precioModel(pool) {
  const rows = async (sql, p) => (await pool.query(sql, p)).rows;
  return {
    /** Evento con su precio base y vigente para el análisis de dI/dt. */
    async eventoParaPrecio(codigo) {
      return (await rows(
        `SELECT e.codigo_evento AS id, e.nombre_evento AS name, v.precio_vigente::float8 AS price_cop, v.precio_base::float8 AS base_price_cop,
                v.estado_ventas AS sales_state, s.nombre_estado AS estado, (e.fecha_hora_fin <= (now() AT TIME ZONE 'America/Bogota')) AS terminado
           FROM evento e JOIN v_evento_ventas v ON v.codigo_evento = e.codigo_evento
           JOIN estado_evento s ON s.id_estado_evento = e.id_estado_evento WHERE e.codigo_evento = $1`, [codigo]))[0] || null;
    },

    /** Ingresos por intervalo Δt: Σ valor_total de las reservas activas, agrupadas por ventana de tiempo. */
    serieIngresos(codigo, bucketSec, desdeSec, hastaSec) {
      return rows(
        `SELECT FLOOR(EXTRACT(EPOCH FROM (r.fecha_hora_reserva AT TIME ZONE 'America/Bogota')) / $2)::BIGINT AS b, SUM(r.valor_total)::float8 AS rev
           FROM reserva r JOIN estado_reserva er ON er.id_estado_reserva = r.id_estado_reserva
          WHERE r.codigo_evento = $1 AND er.nombre_estado IN ('Confirmada', 'Pendiente')
            AND (r.fecha_hora_reserva AT TIME ZONE 'America/Bogota') >= to_timestamp($3)
            AND (r.fecha_hora_reserva AT TIME ZONE 'America/Bogota') <  to_timestamp($4)
          GROUP BY 1`, [codigo, bucketSec, desdeSec, hastaSec]);
    },

    async ultimoAjuste(codigo) {
      return (await rows("SELECT creado_en FROM ajuste_precio WHERE codigo_evento = $1 ORDER BY creado_en DESC, id DESC LIMIT 1", [codigo]))[0] || null;
    },
    historialAjustes: (codigo, limite = 5) => rows(
      `SELECT precio_anterior::float8 AS old_price_cop, precio_nuevo::float8 AS new_price_cop, motivo AS reason,
              tasa_demanda::float8 AS demand_rate_cop, creado_en AS created_at
         FROM ajuste_precio WHERE codigo_evento = $1 ORDER BY creado_en DESC, id DESC LIMIT $2`, [codigo, limite]),

    /** Inserta el ajuste solo si nadie más movió el precio mientras tanto (función SQL aplicar_ajuste_precio). */
    async aplicarAjuste(codigo, precioAnterior, precioNuevo, motivo, tasa) {
      return (await rows("SELECT aplicar_ajuste_precio($1,$2,$3,$4,$5) AS ok", [codigo, precioAnterior, precioNuevo, motivo, tasa ?? null]))[0].ok === true;
    },

    /** Eventos de pago que siguen abiertos a la venta (los revisa la tarea periódica). */
    async idsAbiertosDePago() {
      return (await rows(
        `SELECT e.codigo_evento AS id FROM evento e JOIN estado_evento s ON s.id_estado_evento = e.id_estado_evento
          WHERE s.nombre_estado IN ('Disponible', 'Últimos cupos') AND e.precio_base > 0
            AND e.fecha_hora_fin > (now() AT TIME ZONE 'America/Bogota')`)).map((r) => r.id);
    },

    /** Historial para estimar M y k del «precio ideal»: eventos pagos, no cancelados, con ventas (o ya finalizados). */
    historialDeVentas(excluirCodigo) {
      return rows(
        `SELECT e.nombre_evento AS name, e.descripcion AS description, v.precio_base::float8 AS price, v.capacidad_total AS capacity, v.inscritos AS registered
           FROM evento e JOIN v_evento_ventas v ON v.codigo_evento = e.codigo_evento
           JOIN estado_evento s ON s.id_estado_evento = e.id_estado_evento
          WHERE v.precio_base > 0 AND s.nombre_estado <> 'Cancelado'
            AND (v.inscritos > 0 OR s.nombre_estado = 'Finalizado')
            AND ($1::varchar IS NULL OR e.codigo_evento <> $1::varchar)`, [excluirCodigo]);
    },
  };
};
