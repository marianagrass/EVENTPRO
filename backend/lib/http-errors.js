/* ==========================================================
   lib/http-errors.js — Convierte un error en una respuesta HTTP SIN filtrar detalles internos.
   · Errores de negocio (PricingError, GatewayError, RAISE EXCEPTION de la BD) → su mensaje en español.
   · Cualquier otro error → mensaje genérico; el detalle real solo se escribe en la consola del servidor.
   ========================================================== */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);

function handleError(res, err, where = "") {
  // Errores propios (precios, pasarela, validaciones)
  if (err && (err.name === "PricingError" || err.name === "GatewayError" || err.name === "HttpError")) {
    return res.status(err.status || 400).json({ error: err.message, ...(err.code ? { code: err.code } : {}), ...(err.fields ? { fields: err.fields } : {}) });
  }
  const code = err && err.code;
  // RAISE EXCEPTION escrito por nosotros en 001/004 (P0001) o CHECK que lanza un trigger (23514)
  if (code === "P0001") return res.status(400).json({ error: err.message });
  if (code === "23514") {
    // Un CHECK de la tabla ("violates check constraint …") revela nombres internos → mensaje genérico.
    // Un RAISE de nuestros triggers con ERRCODE check_violation (p. ej. el aforo) sí trae un mensaje pensado para el usuario.
    const internal = /violates check constraint|check constraint/i.test(err.message || "");
    return res.status(400).json({ error: internal ? "Alguno de los datos enviados no cumple las reglas permitidas." : err.message });
  }
  if (code === "23502") return res.status(400).json({ error: "Falta un dato obligatorio." });
  if (code === "23505") return res.status(409).json({ error: "Ya existe un registro con esos datos." });
  if (code === "23503") return res.status(409).json({ error: "La operación depende de otros datos que no existen o ya no están." });
  if (code === "22P02" || code === "22007" || code === "22008" || code === "22003") return res.status(400).json({ error: "Alguno de los datos enviados tiene un formato inválido." });
  console.error(`[api]${where ? " " + where : ""}`, err);
  return res.status(500).json({ error: "Error interno del servidor." });
}

class HttpError extends Error {
  constructor(message, status = 400, code = null) { super(message); this.name = "HttpError"; this.status = status; this.code = code; }
}

module.exports = { handleError, HttpError, isUuid };
