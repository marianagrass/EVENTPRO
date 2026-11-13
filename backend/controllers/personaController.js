/* ==========================================================
   controllers/personaController.js — PERSONA y sus subclases (Cliente · Agente · Administrador)
     GET    /api/accounts                lista de cuentas (con rol deducido de la herencia)
     GET    /api/accounts/:id
     POST   /api/personas                registro público: SIEMPRE crea un Cliente
     POST   /api/accounts                el Administrador crea una cuenta (cliente / agente / administrador)
     PUT    /api/accounts/:id/profile    editar datos básicos (incluye ciudad, dirección y teléfono)
     PUT    /api/accounts/:id/role       cliente ↔ agente
     PATCH  /api/accounts/:id/status     borrado LÓGICO: activa / desactiva la cuenta (solo un administrador). Ya NO existe DELETE.
   ========================================================== */
const { HttpError, isId, handleError } = require("../lib/http-errors");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[0-9+() -]{7,20}$/;
const DEFAULT_PASSWORD = "123456";            // SOLO desarrollo: las cuentas creadas por el Admin entran con la clave de demostración

module.exports = function personaController({ models }) {
  const { persona, geografia } = models;

  /** Valida y limpia los datos comunes de una PERSONA. Lanza 422 con el detalle por campo. */
  async function validar(b, { password = false } = {}) {
    const f = {};
    const id = String(b.identificacion ?? b.id ?? "").trim();
    if (!isId(id)) f.identificacion = "El número de identificación debe tener entre 5 y 20 letras, números o guiones.";
    const nombre = String(b.name ?? b.nombre ?? "").trim().replace(/\s+/g, " ");
    if (nombre.length < 3 || nombre.length > 150 || nombre.split(" ").filter((w) => w.length >= 2).length < 2) f.name = "Escribe el nombre completo (nombre y apellido).";
    const correo = String(b.email ?? b.correo ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(correo) || correo.length > 150) f.email = "Escribe un correo válido (ej. nombre@correo.com).";
    const idCiudad = Number(b.cityId ?? b.city_id ?? b.idCiudad);
    if (!Number.isInteger(idCiudad) || idCiudad < 1) f.cityId = "Selecciona la ciudad.";
    else if (!(await geografia.existeCiudad(idCiudad))) f.cityId = "La ciudad seleccionada no existe.";
    const direccion = String(b.address ?? b.direccion ?? "").trim();
    if (direccion.length > 200) f.address = "La dirección es demasiado larga (máximo 200 caracteres).";
    const telefono = String(b.phone ?? b.telefono ?? "").trim();
    if (telefono && !PHONE_RE.test(telefono)) f.phone = "Escribe un teléfono válido (solo números, espacios, + ( ) -).";
    let clave = null;
    if (password) {
      clave = String(b.password ?? "");
      if (clave.length < 8 || !/[A-Za-z]/.test(clave) || !/\d/.test(clave)) f.password = "Usa al menos 8 caracteres, con letras y números.";
    }
    if (Object.keys(f).length) throw new HttpError("Revisa los datos del formulario.", 422, "VALIDATION", f);
    return { id, nombre, correo, idCiudad, direccion, telefono: telefono || null, clave };
  }

  const list = async (_req, res) => { try { res.json(await persona.listar()); } catch (e) { handleError(res, e, "GET /accounts"); } };

  const get = async (req, res) => {
    try {
      if (!isId(req.params.id)) throw new HttpError("Identificador inválido.", 400);
      const p = await persona.obtener(req.params.id);
      if (!p) throw new HttpError("La cuenta no existe.", 404);
      res.json(p);
    } catch (e) { handleError(res, e, "GET /accounts/:id"); }
  };

  /** Registro público de un Cliente (nunca se acepta un rol desde afuera). */
  const register = async (req, res) => {
    try {
      const b = req.body || {};
      const d = await validar(b, { password: true });
      await persona.crear({ id: d.id, nombre: d.nombre, correo: d.correo, clave: d.clave, direccion: d.direccion, idCiudad: d.idCiudad, rol: "cliente", telefono: d.telefono });
      res.status(201).json({ success: true, id: d.id, account: await persona.obtener(d.id) });
    } catch (e) { handleError(res, e, "POST /personas"); }
  };

  /** El Administrador crea una cuenta con cualquier rol. */
  const create = async (req, res) => {
    try {
      const b = req.body || {};
      const rolApi = String(b.role || "agent");
      if (!persona.ROL_ER[rolApi]) throw new HttpError("Rol inválido.", 400);
      const d = await validar(b);
      const datos = rolApi === "agent" ? { experiencia: b.experiencia ? String(b.experiencia).slice(0, 200) : null }
        : rolApi === "admin" ? { salario: Number(b.salario) || 0, horario: String(b.horario || "Por definir").slice(0, 100) }
        : { visualizacion_publicidad: b.show_ads !== false };
      await persona.crear({ id: d.id, nombre: d.nombre, correo: d.correo, clave: b.password || DEFAULT_PASSWORD, direccion: d.direccion, idCiudad: d.idCiudad, rol: persona.ROL_ER[rolApi], telefono: d.telefono, datos });
      res.status(201).json({ success: true, id: d.id });
    } catch (e) { handleError(res, e, "POST /accounts"); }
  };

  const updateProfile = async (req, res) => {
    try {
      const id = req.params.id;
      if (!isId(id)) throw new HttpError("Identificador inválido.", 400);
      const actual = await persona.obtener(id);
      if (!actual) throw new HttpError("La cuenta no existe.", 404);
      const b = req.body || {};
      const d = await validar({ ...b, id, cityId: b.cityId ?? b.city_id ?? actual.city_id });      // sin ciudad nueva se conserva la actual
      await persona.actualizarPerfil({ id, nombre: d.nombre, correo: d.correo, direccion: d.direccion, idCiudad: d.idCiudad, telefono: b.phone === undefined && b.telefono === undefined ? null : (d.telefono ?? "") });
      res.json({ success: true });
    } catch (e) { handleError(res, e, "PUT /accounts/:id/profile"); }
  };

  const changeRole = async (req, res) => {
    try {
      if (!isId(req.params.id)) throw new HttpError("Identificador inválido.", 400);
      const rol = persona.ROL_ER[req.body && req.body.role];
      if (!rol || rol === "administrador") throw new HttpError("Rol inválido: usa user o agent.", 400);
      await persona.cambiarRol(req.params.id, rol);
      res.json({ success: true });
    } catch (e) { handleError(res, e, "PUT /accounts/:id/role"); }
  };

  /** PATCH /api/accounts/:id/status   body: { adminId, activo? }
   *  Sin `activo` conmuta el estado (activa ↔ desactiva); con `activo: true|false` lo fija (idempotente).
   *  NO borra nada: la cuenta conserva reservas, eventos y teléfonos. Responde con el estado resultante. */
  const setStatus = async (req, res) => {
    try {
      const b = req.body || {};
      if (!isId(req.params.id) || !isId(b.adminId)) throw new HttpError("Identificador inválido.", 400);
      if (b.activo !== undefined && typeof b.activo !== "boolean") throw new HttpError("«activo» debe ser verdadero o falso.", 400);
      const activo = await persona.cambiarEstado(b.adminId, req.params.id, b.activo === undefined ? null : b.activo);
      res.json({ success: true, id: req.params.id, active: activo, status: activo ? "Activo" : "Inactivo" });
    } catch (e) { handleError(res, e, "PATCH /accounts/:id/status"); }
  };

  return { list, get, register, create, updateProfile, changeRole, setStatus };
};
