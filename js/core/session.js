/* ==========================================================
   core/session.js — Estado de autenticación (el "AuthContext" de EventPro)

   Session guarda QUIÉN es el usuario y su rol; lo llenan los formularios de AuthModal
   al recibir la respuesta de AuthApi (backend real o mock). No hay accesos directos por rol.

   Flujo completo:
     formulario ─► AuthModal.onLogin / onRegister ─► Session.login / Session.register
        ─► AuthApi (POST /api/auth/...) ─► Session.set({ token, user }) ─► AuthFlow.enter(user)
        ─► Admin → Finanzas · Agente → Dashboard operativo · Usuario → Home (+ evento pendiente)

   Visitante que pulsa «Inscribirse»: Guard guarda { eventId } y abre AuthModal. Al autenticarse,
   AuthFlow.enter vuelve a abrir EventModal con ese evento (no se pierde el hilo).
   ========================================================== */

/* Rol que manda el backend → rol que usa la interfaz. Cualquier otro valor se rechaza. */
const ROLE_FROM_API = { user: "user", agent: "manager", admin: "admin" };

const Session = {
  user: null,                       // { id, name, email, role: "user" | "manager" | "admin" }
  role: "guest",
  token: null,

  get isAuthenticated() { return !!this.user; },
  get isUser() { return this.role === "user"; },
  get firstName() { return this.user ? this.user.name.split(" ")[0] : ""; },

  /** Convierte la respuesta del backend en un usuario válido o lanza error (nunca asume un rol) */
  normalizeUser(raw) {
    const role = raw && ROLE_FROM_API[raw.role];
    if (!raw || !raw.id || !raw.name || !raw.email || !role) throw new AuthError("Respuesta inesperada del servidor.", 500, "BAD_RESPONSE");
    return { id: String(raw.id), name: String(raw.name), email: String(raw.email), role };
  },

  /** Guarda la sesión (y el token, si el backend usa token en vez de cookie) */
  set({ token, user }) {
    this.user = this.normalizeUser(user);
    this.role = this.user.role;
    this.token = token || null;
    try {
      if (this.token && !AuthConfig.USE_COOKIES) sessionStorage.setItem(AuthConfig.STORAGE_KEY, this.token);
    } catch (_) { /* almacenamiento bloqueado: la sesión dura hasta recargar */ }
    if (this.role === "user") UserApp.loadFor(this.user);
    return this.user;
  },

  clear() {
    this.user = null; this.role = "guest"; this.token = null;
    try { sessionStorage.removeItem(AuthConfig.STORAGE_KEY); } catch (_) { /* nada */ }
  },

  /* ----- operaciones (devuelven el usuario o lanzan AuthError) ----- */
  async login({ email, password }) {
    const data = await AuthApi.login({ email: String(email).trim().toLowerCase(), password });
    return this.set(data);
  },

  async register({ identificacion, name, email, password, cityId, address, phone }) {
    // El rol NO se envía: el servidor siempre crea un CLIENTE (PERSONA + CLIENTE). Agentes y admins los gestiona el Admin.
    const data = await AuthApi.register({
      identificacion: String(identificacion).trim(), name: String(name).trim(), email: String(email).trim().toLowerCase(), password,
      cityId: Number(cityId), address: String(address || "").trim(), phone: String(phone || "").trim(),
    });
    return this.set(data);
  },

  /** Al abrir la página: si quedó un token guardado, pregunta al backend quién es */
  async restore() {
    let token = null;
    try { token = sessionStorage.getItem(AuthConfig.STORAGE_KEY); } catch (_) { /* nada */ }
    if (!token && !AuthConfig.USE_COOKIES) return null;
    try {
      const { user } = await AuthApi.me(token);
      return this.set({ token, user });
    } catch (_) {
      this.clear();
      return null;
    }
  },

  async logout() {
    const token = this.token;
    this.clear();
    try { await AuthApi.logout(token); } catch (_) { /* aunque falle, la sesión local ya se cerró */ }
  },
};

/* Si el backend responde 401 con sesión iniciada, el token venció: volver a pedir login */
AuthApi.onUnauthorized = () => {
  if (!Session.isAuthenticated) return;
  Session.clear(); EventModal.reset(); CheckoutModal.reset(); App.mode = "guest"; UserApp.view = "home";
  App.render({ resetScroll: true });
  AuthModal.open({ view: "login", reason: "Tu sesión expiró. Inicia sesión de nuevo." });
};

/* ==========================================================
   AuthFlow — a dónde va cada rol tras autenticarse
   ========================================================== */
const AuthFlow = {
  enter(user, pending = null) {
    App.mode = user.role;                                   // "user" | "manager" | "admin"
    if (user.role === "admin")   App.adminView = "dashboard";   // Finanzas y estadísticas
    if (user.role === "manager") ManagerApp.view = "inicio";    // Dashboard operativo
    if (user.role === "user")    UserApp.view = "home";         // el mismo Home, ahora con su avatar
    EventModal.reset(); CheckoutModal.reset();
    const resume = user.role === "user" && pending && pending.eventId;
    App.render({ resetScroll: !resume });                   // si vuelve a un evento, conserva el scroll del Home
    if (resume) EventModal.open(pending.eventId);           // ← "sin perder el hilo"
  },
};

/* ==========================================================
   Guard — intercepta acciones que exigen sesión (data-requires-auth)
   ========================================================== */
const Guard = {
  get open() { return AuthModal.isOpen; },
  canAccess(mode) { return mode === "guest" || Session.role === mode; },
  promptLogin(el) {
    AuthModal.open({
      view: "login",
      pending: el.dataset.id ? { eventId: el.dataset.id } : null,
      reason: el.dataset.reason || null,
    });
  },
};

registerClick({
  "app:logout": () => {
    Session.logout();
    EventModal.reset(); CheckoutModal.reset(); AuthModal.reset();
    UserApp.view = "home"; App.mode = "guest";
    App.render({ resetScroll: true });
  },
});
