/* ==========================================================
   controllers/eventoController.js — EVENTO
     GET    /api/events
     POST   /api/events                 crea un evento (el creador debe existir en AGENTE)
     PUT    /api/events/:id             edita (si cambia el precio, ese pasa a ser el precio_base)
     PUT    /api/events/:id/availability   'open' | 'paused' | 'closed'
     PUT    /api/events/:id/capacity
     POST   /api/events/:id/cancel      cancela con causa_cancelacion y cancela sus reservas (con reembolso)
     DELETE /api/events/:id             solo si NO tiene reservas (si las tiene, se cancela)
   ========================================================== */
const { HttpError, isId, isEventCode, handleError } = require("../lib/http-errors");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_PRICE = 99999999;

module.exports = function eventoController({ models }) {
  const { evento, persona, geografia } = models;

  /** Valida y arma los datos de un evento. El front manda event_date + start_time (+ end_time); el ER guarda fecha_hora_inicio/fin. */
  async function validar(b, { idAgente }) {
    const f = {};
    const nombre = String(b.name ?? b.nombre_evento ?? "").trim();
    if (nombre.length < 3 || nombre.length > 200) f.name = "El nombre del evento debe tener entre 3 y 200 caracteres.";
    const teatro = String(b.teatro ?? b.location ?? "").split(",")[0].trim();       // «Teatro, Ciudad» → el lugar sin la ciudad
    if (!teatro || teatro.length > 150) f.location = "Escribe el lugar del evento (máximo 150 caracteres).";
    const date = String(b.event_date ?? "").slice(0, 10), time = String(b.start_time ?? "").slice(0, 5);
    if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) f.event_date = "Elige una fecha válida.";
    if (!TIME_RE.test(time)) f.start_time = "Elige la hora de inicio.";
    const endTime = b.end_time ? String(b.end_time).slice(0, 5) : null;
    if (endTime && !TIME_RE.test(endTime)) f.end_time = "La hora de fin no es válida.";
    const capacidad = Number(b.capacity);
    if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 1000000) f.capacity = "El aforo debe ser un número entero entre 1 y 1.000.000.";
    const precio = Number(b.price_cop ?? b.precio_base);
    if (!Number.isFinite(precio) || precio < 0 || precio > MAX_PRICE) f.price = "El precio debe ser un número entre 0 y 99.999.999.";
    const descripcion = b.description == null ? null : String(b.description).slice(0, 5000);
    const observaciones = b.observaciones ?? b.observations;
    let idCiudad = Number(b.cityId ?? b.city_id);
    if (!idCiudad) {                                                                  // sin ciudad: la del agente que lo crea
      const ag = await persona.obtener(idAgente);
      idCiudad = ag ? ag.city_id : NaN;
    }
    if (!Number.isInteger(idCiudad) || !(await geografia.existeCiudad(idCiudad))) f.cityId = "Selecciona la ciudad del evento.";
    if (Object.keys(f).length) throw new HttpError("Revisa los datos del evento.", 422, "VALIDATION", f);

    const inicio = `${date} ${time}:00`;
    let fin = null;
    if (endTime) {
      const endDate = DATE_RE.test(String(b.end_date || "")) ? b.end_date : date;
      fin = `${endDate} ${endTime}:00`;
      if (fin <= inicio) throw new HttpError("La hora de fin debe ser posterior a la de inicio.", 422, "VALIDATION", { end_time: "La hora de fin debe ser posterior a la de inicio." });
    }
    return { nombre, descripcion, teatro, inicio, fin, capacidad, precio, observaciones: observaciones == null || observaciones === "" ? null : String(observaciones).slice(0, 2000), idCiudad };
  }

  const list = async (_req, res) => { try { res.json(await evento.listar()); } catch (e) { handleError(res, e, "GET /events"); } };

  const create = async (req, res) => {
    try {
      const b = req.body || {};
      const idAgente = b.created_by ?? b.agentId ?? b.id_agente;
      if (!isId(idAgente) || !(await persona.esAgente(idAgente))) throw new HttpError("Solo un agente registrado puede crear eventos.", 403);
      const id = await evento.crear({ ...(await validar(b, { idAgente })), idAgente });
      res.status(201).json({ success: true, id });
    } catch (e) { handleError(res, e, "POST /events"); }
  };

  const update = async (req, res) => {
    try {
      if (!isEventCode(req.params.id)) throw new HttpError("Identificador inválido.", 400);
      const actual = await evento.obtener(req.params.id);
      if (!actual) throw new HttpError("Evento no encontrado.", 404);
      if (actual.status === "cancelado") throw new HttpError("Un evento cancelado no se puede editar.", 409);
      const n = await evento.actualizar(req.params.id, await validar(req.body || {}, { idAgente: actual.agent_id }));
      if (!n) throw new HttpError("Evento no encontrado.", 404);
      res.json({ success: true });
    } catch (e) { handleError(res, e, "PUT /events/:id"); }
  };

  const setAvailability = async (req, res) => {
    try {
      if (!isEventCode(req.params.id)) throw new HttpError("Identificador inválido.", 400);
      const disp = req.body && req.body.availability;
      if (!["open", "paused", "closed"].includes(disp)) throw new HttpError("Disponibilidad inválida.", 400);
      await evento.cambiarDisponibilidad(req.params.id, disp);
      res.json({ success: true });
    } catch (e) { handleError(res, e, "PUT availability"); }
  };

  const setCapacity = async (req, res) => {
    try {
      if (!isEventCode(req.params.id)) throw new HttpError("Identificador inválido.", 400);
      const cap = Number(req.body && req.body.capacity);
      if (!Number.isInteger(cap) || cap < 1 || cap > 1000000) throw new HttpError("El aforo debe ser un número entero entre 1 y 1.000.000.", 400);
      if (!(await evento.cambiarCapacidad(req.params.id, cap))) throw new HttpError("Evento no encontrado.", 404);
      res.json({ success: true });
    } catch (e) { handleError(res, e, "PUT capacity"); }
  };

  /** Cancelar un evento: exige la causa, deja EVENTO.causa_cancelacion y cancela todas las reservas activas. */
  const cancel = async (req, res) => {
    try {
      const { actorId, causa } = req.body || {};
      if (!isEventCode(req.params.id)) throw new HttpError("Identificador inválido.", 400);
      if (!isId(actorId)) throw new HttpError("Falta indicar quién cancela el evento.", 400);
      const c = typeof causa === "string" ? causa.trim() : "";
      if (c.length < 3) throw new HttpError("Indica la causa de la cancelación (mínimo 3 caracteres).", 400, "CAUSA_REQUERIDA");
      if (c.length > 500) throw new HttpError("La causa de la cancelación es demasiado larga (máximo 500 caracteres).", 400);
      const reservasCanceladas = await evento.cancelar(req.params.id, actorId, c);
      res.json({ success: true, reservasCanceladas });
    } catch (e) { handleError(res, e, "POST /events/:id/cancel"); }
  };

  const remove = async (req, res) => {
    try {
      if (!isEventCode(req.params.id)) throw new HttpError("Identificador inválido.", 400);
      if (await evento.tieneReservas(req.params.id)) throw new HttpError("Este evento tiene reservas: no se puede borrar. Cancélalo indicando la causa.", 409);
      if (!(await evento.eliminar(req.params.id))) throw new HttpError("Evento no encontrado.", 404);
      res.json({ success: true });
    } catch (e) { handleError(res, e, "DELETE /events/:id"); }
  };

  return { list, create, update, setAvailability, setCapacity, cancel, remove };
};
