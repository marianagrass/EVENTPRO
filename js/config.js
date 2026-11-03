/* ==========================================================
   config.js — Dirección de la API y utilidades de red (se carga ANTES que todo lo demás)

   API_URL: por defecto el backend local (npm start → http://localhost:3000/api).
   Para otro servidor, define ANTES de los scripts (por ejemplo en index.html):
        <script>window.EVENTPRO_API_URL = "https://mi-api.onrender.com/api";</script>

   api.get / api.post / api.put / api.delete  → devuelven el JSON o lanzan ApiError (con el mensaje del servidor).
   apiSend(método, ruta, cuerpo)              → igual, pero NO lanza: muestra un aviso (Toast) si falla y devuelve true/false.
   ========================================================== */
const API_URL = String(window.EVENTPRO_API_URL || "http://localhost:3000/api").replace(/\/+$/, "");

class ApiError extends Error {
  constructor(message, { status = 0, code = null, fields = null, data = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;          // 0 = sin conexión
    this.code = code;              // "NETWORK" | "QUEUE_REQUIRED" | "VALIDATION" | …
    this.fields = fields;          // errores por campo (formularios)
    this.data = data;              // cuerpo completo de la respuesta
  }
}

async function apiRequest(method, path, body, extraHeaders = {}) {
  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...extraHeaders },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (_) {
    throw new ApiError("No se pudo conectar con el servidor. Revisa que el backend esté encendido e inténtalo de nuevo.", { code: "NETWORK" });
  }
  let data = null;
  try { data = await res.json(); } catch (_) { /* respuesta sin cuerpo */ }
  if (!res.ok) {
    throw new ApiError((data && data.error) || "El servidor no pudo completar la acción.", { status: res.status, code: data && data.code, fields: data && data.fields, data });
  }
  return { data, headers: res.headers };
}

const api = {
  get:    async (path, headers) => (await apiRequest("GET", path, undefined, headers)).data,
  post:   async (path, body, headers) => (await apiRequest("POST", path, body === undefined ? {} : body, headers)).data,
  put:    async (path, body, headers) => (await apiRequest("PUT", path, body === undefined ? {} : body, headers)).data,
  delete: async (path, body, headers) => (await apiRequest("DELETE", path, body, headers)).data,
  /** Igual que post pero también devuelve las cabeceras (el middleware de fila manda X-Queue-Ticket) */
  postWithHeaders: (path, body, headers) => apiRequest("POST", path, body === undefined ? {} : body, headers),
};

/** Aviso flotante, fuera del ciclo de dibujado de la app (no se borra al re-renderizar). */
const Toast = {
  show(message, kind = "error", ms = 5200) {
    let host = document.getElementById("toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "toast-host";
      host.setAttribute("role", "status");
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.className = `toast toast-${kind}`;
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => { el.classList.add("is-out"); setTimeout(() => el.remove(), 260); }, ms);
  },
};

/** Para manejadores que antes hacían `await fetch(...)` sin mirar el resultado. true = salió bien. */
async function apiSend(method, path, body) {
  try {
    await apiRequest(method.toUpperCase(), path, body);
    return true;
  } catch (e) {
    Toast.show(e.message, "error");
    return false;
  }
}
