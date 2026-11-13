/* ==========================================================
   routes/core.js — Geografía, catálogos, personas, eventos y reservas (lectura / gestión)
   Cada ruta usa handleError: nunca se filtra SQL al cliente.
   (Se eliminó /tasks y el check-in: TAREA y la asistencia ya no existen en el ER del tutor.)
   ========================================================== */
const express = require("express");
const personaController = require("../controllers/personaController");
const eventoController = require("../controllers/eventoController");
const { handleError, isPositiveInt, HttpError } = require("../lib/http-errors");

module.exports = function coreRoutes({ models }) {
  const r = express.Router();
  const persona = personaController({ models });
  const evento = eventoController({ models });
  const route = (label, fn) => async (req, res) => { try { await fn(req, res); } catch (e) { handleError(res, e, label); } };
  const intParam = (v) => { if (!isPositiveInt(v)) throw new HttpError("Identificador inválido.", 400); return Number(v); };

  /* ---------- Geografía y catálogos ---------- */
  r.get("/geografia/paises", route("GET paises", async (_q, res) => res.json(await models.geografia.paises())));
  r.get("/geografia/paises/:id/departamentos", route("GET departamentos", async (q, res) => res.json(await models.geografia.departamentos(intParam(q.params.id)))));
  r.get("/geografia/departamentos/:id/ciudades", route("GET ciudades", async (q, res) => res.json(await models.geografia.ciudades(intParam(q.params.id)))));
  r.get("/ciudades", route("GET /ciudades", async (_q, res) => res.json(await models.geografia.ciudadesCompletas())));
  r.get("/catalogos/estados-evento", route("GET estados-evento", async (_q, res) => res.json(await models.catalogo.estadosEvento())));
  r.get("/catalogos/estados-reserva", route("GET estados-reserva", async (_q, res) => res.json(await models.catalogo.estadosReserva())));

  /* ---------- Personas ---------- */
  r.get("/accounts", persona.list);
  r.get("/accounts/:id", persona.get);
  r.post("/personas", persona.register);                 // registro público (siempre Cliente)
  r.post("/accounts", persona.create);                   // el Administrador crea cuentas
  r.put("/accounts/:id/profile", persona.updateProfile);
  r.put("/accounts/:id/role", persona.changeRole);
  r.patch("/accounts/:id/status", persona.setStatus);    // borrado lógico: activar / desactivar (ya no hay DELETE)

  /* ---------- Eventos ---------- */
  r.get("/events", evento.list);
  r.post("/events", evento.create);
  r.put("/events/:id", evento.update);
  r.put("/events/:id/availability", evento.setAvailability);
  r.put("/events/:id/capacity", evento.setCapacity);
  r.post("/events/:id/cancel", evento.cancel);
  r.delete("/events/:id", evento.remove);

  /* ---------- Reservas (el front las sigue llamando «attendees») ---------- */
  r.get("/attendees", route("GET /attendees", async (_q, res) => res.json(await models.reserva.listar())));
  r.get("/reservas", route("GET /reservas", async (_q, res) => res.json(await models.reserva.listar())));
  r.put("/attendees/:id/status", route("PUT attendee status", async (q, res) => {
    if (!q.body || q.body.status !== "confirmado") throw new HttpError("Para cancelar usa POST /api/reservas/:id/cancel con la causa.", 400);
    if (!(await models.reserva.confirmarPendiente(intParam(q.params.id)))) throw new HttpError("La reserva no existe o no estaba pendiente.", 409);
    res.json({ success: true });
  }));

  return r;
};
