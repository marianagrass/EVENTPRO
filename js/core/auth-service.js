/* ==========================================================
   core/auth-service.js — Capa de autenticación (HTTP real + simulación)

   PARA CONECTAR TU BACKEND (Node/Express + PostgreSQL):
     1. Pon  AuthConfig.USE_MOCK = false.
     2. Ajusta AuthConfig.API_BASE (ej. "http://localhost:3000/api" o "/api" si Express sirve el front).
     3. Implementa las rutas de abajo con EXACTAMENTE estas respuestas. No hay que tocar ningún componente.
        Hay una guía con un ejemplo de Express en docs/CONTRATO_API_AUTH.md.

   ┌─ CONTRATO ───────────────────────────────────────────────────────────────────────────────┐
   │ POST /api/auth/login            body: { email, password }                                  │
   │     200 → { token, user: { id, name, email, role } }                                       │
   │     401 → { error: "Correo o contraseña incorrectos." }       (mismo mensaje si el correo  │
   │                                                                no existe: no revelar cuál) │
   │ POST /api/auth/register         body: { identificacion, name, email, password, cityId,     │
   │                                         address?, phone? }          ← NUNCA se envía rol   │
   │     201 → { token, user }       (crea PERSONA + CLIENTE; el servidor FUERZA role = "user")  │
   │     409 → { error: "...", fields: { email: "Ya existe una cuenta con este correo." } }     │
   │     422 → { error: "...", fields: { name?: "...", email?: "...", password?: "..." } }      │
   │ POST /api/auth/forgot-password  body: { email }                                            │
   │     200 → { message }           (siempre 200, exista o no el correo)                       │
   │ GET  /api/auth/me               header: Authorization: Bearer <token>                      │
   │     200 → { user }              401 → sesión vencida                                       │
   │ POST /api/auth/logout           200 → { ok: true }                                         │
   └────────────────────────────────────────────────────────────────────────────────────────────┘
   role (en la respuesta): "user" | "agent" | "admin"  (el front muestra "agent" como "manager").
   Cualquier otro valor se RECHAZA en el front (ver Session.normalizeUser).
   El front solo decide qué pantalla mostrar; los permisos reales los aplica el backend.
   ========================================================== */

const AuthConfig = {
  USE_MOCK: true,                  // ← false cuando conectes el backend
  API_BASE: "/api",
  ENDPOINTS: {
    login: "/auth/login",
    register: "/auth/register",
    forgot: "/auth/forgot-password",
    me: "/auth/me",
    logout: "/auth/logout",
  },
  // Dónde viaja la sesión:
  //   false → el token (JWT) se guarda en sessionStorage y se envía en "Authorization: Bearer".
  //   true  → el backend usa una cookie httpOnly (más segura): el front no toca el token.
  USE_COOKIES: false,
  STORAGE_KEY: "eventpro.auth",
  MOCK_LATENCY_MS: 650,            // retraso simulado para ver el estado "cargando"
  RULES: { minPassword: 8, minNameWords: 2 },
};

/** Error de autenticación con datos útiles para la interfaz */
class AuthError extends Error {
  constructor(message, status = 0, code = null, fields = null) {
    super(message);
    this.name = "AuthError";
    this.status = status;        // código HTTP (0 = sin conexión)
    this.code = code;            // ej. "ACCOUNT_SUSPENDED", "NETWORK"
    this.fields = fields;        // errores por campo que manda el servidor: { email: "..." }
  }
}

/* ---------- Validación (misma lógica que debe repetir el backend) ---------- */
const AuthValidators = {
  email(v) {
    const e = String(v || "").trim();
    if (!e) return "Escribe tu correo electrónico.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return "Escribe un correo válido (ej. nombre@correo.com).";
    return "";
  },
  name(v) {
    const words = String(v || "").trim().split(/\s+/).filter((w) => w.length >= 2);
    if (!words.length) return "Escribe tu nombre completo.";
    if (words.length < AuthConfig.RULES.minNameWords) return "Escribe tu nombre completo (nombre y apellido).";
    return "";
  },
  password(v) {
    const p = String(v || "");
    if (!p) return "Crea una contraseña.";
    if (p.length < AuthConfig.RULES.minPassword) return `Usa al menos ${AuthConfig.RULES.minPassword} caracteres.`;
    if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Incluye letras y números.";
    return "";
  },
  confirm(pw, confirm) {
    if (!confirm) return "Confirma tu contraseña.";
    return pw === confirm ? "" : "Las contraseñas no coinciden.";
  },
  login({ email, password }) {
    const errors = {};
    const e = this.email(email); if (e) errors.email = e;
    if (!password) errors.password = "Escribe tu contraseña.";
    return errors;
  },
  identificacion(v) {
    const id = String(v || "").trim();
    if (!id) return "Escribe tu número de identificación.";
    if (!/^[A-Za-z0-9-]{5,20}$/.test(id)) return "Usa entre 5 y 20 letras, números o guiones.";
    return "";
  },
  cityId(v) { return Number(v) >= 1 ? "" : "Selecciona tu ciudad."; },
  address(v) { return String(v || "").trim().length > 200 ? "La dirección es demasiado larga (máximo 200 caracteres)." : ""; },
  phone(v) {
    const t = String(v || "").trim();
    return !t || /^[0-9+() -]{7,20}$/.test(t) ? "" : "Escribe un teléfono válido (solo números, espacios, + ( ) -).";
  },
  register({ identificacion, name, email, password, confirm, cityId, address, phone }) {
    const errors = {};
    const i = this.identificacion(identificacion); if (i) errors.identificacion = i;
    const ci = this.cityId(cityId);                if (ci) errors.cityId = ci;
    const ad = this.address(address);              if (ad) errors.address = ad;
    const ph = this.phone(phone);                  if (ph) errors.phone = ph;
    const n = this.name(name);         if (n) errors.name = n;
    const e = this.email(email);       if (e) errors.email = e;
    const p = this.password(password); if (p) errors.password = p;
    const c = this.confirm(password, confirm); if (c && !errors.password) errors.confirm = c;
    return errors;
  },
  /** 0 a 4: para el medidor de seguridad de la contraseña */
  strength(p) {
    p = String(p || "");
    let s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
    if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(s, 4);
  },
};

/* ==========================================================
   API REAL — solo cambia AuthConfig.USE_MOCK a false
   ========================================================== */
const AuthApi = {
  /** Se llama cuando el servidor responde 401 a una petición con sesión (token vencido). Lo conecta Session. */
  onUnauthorized: null,

  async request(path, { method = "POST", body, token = null, isPublic = false } = {}) {
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token && !AuthConfig.USE_COOKIES) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(AuthConfig.API_BASE + path, {
        method,
        headers,
        credentials: AuthConfig.USE_COOKIES ? "include" : "same-origin",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (_) {
      throw new AuthError("No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.", 0, "NETWORK");
    }

    let data = null;
    try { data = await res.json(); } catch (_) { /* respuesta sin cuerpo JSON */ }

    if (!res.ok) {
      // 401 con sesión iniciada = el token venció. En login/registro (isPublic) significa "datos incorrectos".
      if (res.status === 401 && !isPublic && typeof AuthApi.onUnauthorized === "function") AuthApi.onUnauthorized();
      throw new AuthError((data && data.error) || AuthApi.defaultMessage(res.status), res.status, data && data.code, data && data.fields);
    }
    return data;
  },

  defaultMessage(status) {
    if (status === 401) return "Correo o contraseña incorrectos.";
    if (status === 403) return "No tienes permiso para realizar esta acción.";
    if (status === 409) return "Ya existe una cuenta con este correo.";
    if (status === 422 || status === 400) return "Revisa los datos del formulario.";
    if (status === 429) return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
    return "Algo salió mal en el servidor. Inténtalo de nuevo en unos minutos.";
  },

  /* ----- Métodos públicos: elige real o mock ----- */
  login(creds)    { return AuthConfig.USE_MOCK ? MockAuthServer.login(creds)    : this.request(AuthConfig.ENDPOINTS.login,    { body: { email: creds.email, password: creds.password }, isPublic: true }); },
  register(data)  { return AuthConfig.USE_MOCK ? MockAuthServer.register(data)  : this.request(AuthConfig.ENDPOINTS.register, { body: { identificacion: data.identificacion, name: data.name, email: data.email, password: data.password, cityId: data.cityId, address: data.address, phone: data.phone }, isPublic: true }); },
  forgot(email)   { return AuthConfig.USE_MOCK ? MockAuthServer.forgot(email)   : this.request(AuthConfig.ENDPOINTS.forgot,   { body: { email }, isPublic: true }); },
  me(token)       { return AuthConfig.USE_MOCK ? MockAuthServer.me(token)       : this.request(AuthConfig.ENDPOINTS.me,       { method: "GET", token }); },
  logout(token)   { return AuthConfig.USE_MOCK ? Promise.resolve({ ok: true })  : this.request(AuthConfig.ENDPOINTS.logout,   { token, isPublic: true }); },
};

/* ==========================================================
   SERVIDOR SIMULADO — responde con el mismo formato que el backend real.
   Valida contra MOCK_CREDENTIALS y Data.accounts (js/data.js). Se elimina al conectar el backend.
   ========================================================== */
const MockAuthServer = {
  passwords: {},                   // contraseñas de cuentas creadas en esta sesión: { accountId: "..." }

  _delay() { return new Promise((r) => setTimeout(r, AuthConfig.MOCK_LATENCY_MS)); },
  _norm(email) { return String(email || "").trim().toLowerCase(); },
  _findAccount(email) { return Data.accounts.find((a) => a.email.toLowerCase() === email) || null; },
  _token(user) { return "mock." + btoa(JSON.stringify({ sub: user.id, role: user.role })); },
  _publicUser(acc) { return { id: acc.id, name: acc.name, email: acc.email, role: acc.role === "manager" ? "agent" : acc.role === "admin" ? "admin" : "user" }; },
  setPassword(accountId, password) { this.passwords[accountId] = password; },

  async login({ email, password }) {
    await this._delay();
    const e = this._norm(email);
    const cred = MOCK_CREDENTIALS.find((c) => c.email === e);
    const acc = this._findAccount(e);

    // ¿Existe y la contraseña coincide? (mismo error para "no existe" y "clave mala")
    let valid = false, user = null;
    if (cred && !cred.accountId) {                       // administrador demo
      valid = password === cred.password;
      user = { id: cred.id, name: (acc && acc.name) || cred.name, email: cred.email, role: "admin" };
    } else if (acc) {                                    // usuario o agente (incluye las cuentas demo)
      const expected = (cred && cred.accountId === acc.id) ? cred.password : (this.passwords[acc.id] || MOCK_DEFAULT_PASSWORD);
      valid = password === expected;
      user = this._publicUser(acc);
    }
    if (!valid) throw new AuthError("Correo o contraseña incorrectos.", 401, "INVALID_CREDENTIALS");

    return { token: this._token(user), user };
  },

  async register(data) {
    await this._delay();
    // El servidor REPITE la validación (nunca confiar en el front) y FUERZA el rol "user" (= CLIENTE)
    const errs = AuthValidators.register({ ...data, confirm: data.password });
    delete errs.confirm;
    if (Object.keys(errs).length) throw new AuthError("Revisa los datos del formulario.", 422, "VALIDATION", errs);

    const clean = this._norm(data.email);
    if (this._findAccount(clean) || MOCK_CREDENTIALS.some((c) => c.email === clean)) {
      throw new AuthError("Ya existe una cuenta con este correo.", 409, "EMAIL_TAKEN", { email: "Ya existe una cuenta con este correo." });
    }
    // Se guarda de verdad en PostgreSQL: PERSONA + CLIENTE (+ TELEFONO_PERSONA) en una sola transacción
    try {
      await api.post("/personas", {
        identificacion: String(data.identificacion).trim(), name: data.name, email: clean, password: data.password,
        cityId: Number(data.cityId), address: data.address || "", phone: data.phone || "",
      });
    } catch (e) {
      const dup = e.status === 409 || e.status === 422;
      throw new AuthError(e.message, e.status || 0, e.code || (dup ? "VALIDATION" : "NETWORK"), e.fields || null);
    }
    await refreshData();                                  // trae la cuenta nueva (el Admin la ve en «Gestión de cuentas»)
    const acc = Data.accounts.find((a) => a.id === String(data.identificacion).trim());
    if (!acc) throw new AuthError("No se pudo cargar tu cuenta recién creada. Inicia sesión.", 500, "SERVER");
    this.setPassword(acc.id, data.password);
    const user = this._publicUser(acc);
    return { token: this._token(user), user };
  },

  async forgot(email) {
    await this._delay();
    // Siempre la misma respuesta, exista o no el correo (evita enumerar cuentas)
    console.info("[mock] Recuperación solicitada para", this._norm(email), "(no se envía ningún correo real)");
    return { message: "Si ese correo está registrado, te enviamos instrucciones para restablecer tu contraseña." };
  },

  async me(token) {
    await this._delay();
    let payload = null;
    try { payload = JSON.parse(atob(String(token || "").replace(/^mock\./, ""))); } catch (_) { /* token inválido */ }
    if (!payload) throw new AuthError("Sesión inválida.", 401, "INVALID_TOKEN");
    const cred = MOCK_CREDENTIALS.find((c) => c.id === payload.sub && !c.accountId);
    if (cred) return { user: { id: cred.id, name: cred.name, email: cred.email, role: "admin" } };
    const acc = Data.accounts.find((a) => a.id === payload.sub);
    if (!acc) throw new AuthError("Sesión inválida.", 401, "INVALID_TOKEN");
    return { user: this._publicUser(acc) };
  },
};
