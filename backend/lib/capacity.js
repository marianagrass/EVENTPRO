/* ==========================================================
   lib/capacity.js — Control de aforo: límite por la izquierda
   Sea s = inscritos / aforo ∈ [0, 1].  Cuando s → 1⁻ el evento pasa a "Últimos cupos" y al llegar
   a s = 1 a "Agotado". Esta función es el espejo en JavaScript de sales_state_for() (004_payments.sql):
   la base de datos es la autoridad (trigger automático); esta copia sirve para validar ANTES de cobrar.
   ========================================================== */
const { capacity: cfg } = require("../config/business");

function salesState(capacity, registered, threshold = cfg.lastSpotsShare) {
  const remaining = capacity - registered;
  if (remaining <= 0) return "agotado";
  if (remaining <= Math.max(1, Math.ceil(capacity * threshold))) return "ultimos_cupos";
  return "disponible";
}

/** ¿Se pueden vender `quantity` boletas más? Devuelve { ok, remaining, message, stateAfter } */
function checkCapacity(capacity, registered, quantity) {
  const remaining = Math.max(0, capacity - registered);
  if (remaining <= 0) return { ok: false, remaining, message: "Este evento se quedó sin cupos.", stateAfter: "agotado" };
  if (quantity > remaining) {
    return { ok: false, remaining, message: `Solo quedan ${remaining} cupos para este evento.`, stateAfter: salesState(capacity, registered) };
  }
  return { ok: true, remaining, message: "", stateAfter: salesState(capacity, registered + quantity) };
}

module.exports = { salesState, checkCapacity };
