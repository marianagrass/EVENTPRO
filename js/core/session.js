/* ==========================================================
   core/session.js — Sesión (simulada) y Guard de acceso
   Roles: "user" | "manager" (Agente) | "admin". Sin sesión = guest.
   La seguridad real va en el backend (ver /backend/middleware.js).

   Flujo "visitante → login → evento":
     1. El visitante pulsa «Inscribirse» / «Ver detalles» (data-requires-auth).
     2. Guard.promptLogin guarda la intención: Guard.pending = { eventId }.
     3. Al iniciar sesión, Guard.resume(role) entra a la sesión, vuelve a dibujar el Home y
        recién entonces abre EventModal con ese evento. Las dos piezas de estado
        (Guard = autenticación, EventModal = evento abierto) son independientes.
   ========================================================== */
const Session = {
  user: null,
  role: "guest",
  USERS: {
    user:    { id: "u-user",  name: "Carlos Mejía",  role: "user" },
    manager: { id: "u-agent", name: "Carmen López",  role: "manager" },
    admin:   { id: "u-admin", name: "Sofía Navarro", role: "admin" },
  },
  get isAuthenticated() { return !!this.user; },
  get isUser() { return this.role === "user"; },
  get firstName() { return this.user ? this.user.name.split(" ")[0] : ""; },

  /** Estado de la cuenta en la tabla de cuentas del Admin: "activo" | "suspendido" | "eliminada" */
  accountState(role) {
    const u = this.USERS[role];
    if (role === "admin") return "activo";
    const acc = Data.accounts.find((a) => a.id === u.id);
    return acc ? acc.status : "eliminada";
  },

  login(role) { this.user = this.USERS[role]; this.role = role; },
  logout() { this.user = null; this.role = "guest"; },
};

const Guard = {
  open: false,
  pending: null,                         // intención del visitante: { eventId } (si venía de un evento)
  reason: null,                          // mensaje opcional del modal (data-reason)
  suggest: null,                         // rol a resaltar en el modal (data-suggest)
  error: null,                           // aviso si la cuenta está suspendida o eliminada
  canAccess(mode) { return mode === "guest" || Session.role === mode; },

  promptLogin(el) {
    this.pending = el.dataset.id ? { eventId: el.dataset.id } : null;
    this.reason = el.dataset.reason || null;
    this.suggest = el.dataset.suggest || null;
    this.error = null;
    this.open = true; rerender();
  },
  close() { this.open = false; this.pending = null; this.reason = null; this.suggest = null; this.error = null; rerender(); },

  resume(role) {
    // Las cuentas suspendidas o eliminadas por el Admin no pueden entrar
    const state = Session.accountState(role);
    if (state !== "activo") {
      this.error = state === "suspendido"
        ? "Esta cuenta está suspendida. Contacta al administrador de la plataforma."
        : "Esta cuenta ya no existe.";
      rerender();
      return;
    }

    const pending = this.pending;
    this.open = false; this.pending = null; this.reason = null; this.suggest = null; this.error = null;
    Session.login(role);
    App.mode = role;
    if (role === "user") UserApp.view = "home";           // el usuario sigue en el MISMO Home
    if (role === "manager") ManagerApp.view = "inicio";
    if (role === "admin") App.adminView = "dashboard";
    EventModal.reset();                                     // parte siempre de un modal limpio
    App.render({ resetScroll: !(role === "user" && pending) });

    // Retoma la acción que el visitante había intentado: abre el evento ya con sesión iniciada
    if (role === "user" && pending && pending.eventId) EventModal.open(pending.eventId);
  },

  modal() {
    if (!this.open) return "";
    const opt = (role, ic, title, text) => `
      <button class="btn btn-outline btn-block ${this.suggest === role ? "is-suggested" : ""}" style="justify-content:flex-start;gap:12px;padding:14px 16px;text-align:left" data-click="auth:login" data-role="${role}">
        ${icon(ic, 20)}<span><strong style="display:block">${title}</strong><small style="color:var(--muted)">${text}</small></span>
      </button>`;
    return `
      <div class="modal-backdrop" data-click="auth:close" data-backdrop>
        <div class="modal modal-confirm" style="max-width:420px" role="dialog" aria-modal="true" aria-label="Iniciar sesión">
          <h3 class="modal-confirm-title">Inicia sesión para continuar</h3>
          <p class="modal-confirm-text">${esc(this.reason || "Para inscribirte o ver el detalle de un evento necesitas una cuenta.")}</p>
          ${this.error ? `<div class="auth-error" role="alert">${esc(this.error)}</div>` : ""}
          <div style="display:grid;gap:10px;margin:18px 0">
            ${opt("user", "user", "Usuario", "Explora e inscríbete a eventos")}
            ${opt("manager", "tasks", "Agente", "Opera los eventos: crea, edita y controla asistentes")}
            ${opt("admin", "shield", "Administrador", "Finanzas de la plataforma y gestión de cuentas")}
          </div>
          <button class="btn btn-outline btn-block" data-click="auth:close">Ahora no</button>
        </div>
      </div>`;
  },
};

registerClick({
  "auth:open":  (el) => { Guard.reason = el.dataset.reason || null; Guard.suggest = el.dataset.suggest || null; Guard.error = null; Guard.open = true; rerender(); },
  "auth:close": () => Guard.close(),
  "auth:login": (el) => Guard.resume(el.dataset.role),
  "app:logout": () => {
    Session.logout(); EventModal.reset(); UserApp.view = "home";
    App.mode = "guest"; App.render({ resetScroll: true });
  },
});
