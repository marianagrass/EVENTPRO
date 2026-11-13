/* ==========================================================
   models/catalogoModel.js — ESTADO_EVENTO y ESTADO_RESERVA
   ========================================================== */
module.exports = function catalogoModel(pool) {
  const rows = async (sql, p) => (await pool.query(sql, p)).rows;
  return {
    estadosEvento: () => rows("SELECT id_estado_evento, nombre_estado FROM estado_evento ORDER BY id_estado_evento"),
    estadosReserva: () => rows("SELECT id_estado_reserva, nombre_estado FROM estado_reserva ORDER BY id_estado_reserva"),
  };
};
