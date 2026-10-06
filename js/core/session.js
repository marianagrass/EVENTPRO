/* ==========================================================
   core/session.js — Sesión (simulada) y Guard de acceso
   Roles: "user" | "manager" (Agente) | "admin". Sin sesión = guest.
   La seguridad real va en el backend (ver /backend/middleware.js).
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
  login(role) { this.user = this.USERS[role]; this.role = role; if (role === "admin") App.role = "admin"; },
  logout() { this.user = null; this.role = "guest"; },
};

const Guard = {
  open: false,
  pending: null,                         // acción que el visitante intentó hacer
  canAccess(mode) { return mode === "guest" || Session.role === mode; },

  promptLogin(el) { this.pending = { action: el.dataset.click, id: el.dataset.id }; this.open = true; rerender(); },
  close() { this.open = false; this.pending = null; rerender(); },

  resume(role) {
    const p = this.pending;
    this.open = false; this.pending = null;
    Session.login(role);
    App.mode = role;
    if (role === "user") UserApp.view = "eventos";
    if (role === "manager") ManagerApp.view = "inicio";
    App.render({ resetScroll: true });
    // Retoma la inscripción que el visitante había intentado
    if (role === "user" && p && p.action === "guest:register" && Handlers.click["userEvents:ask"]) {
      Handlers.click["userEvents:ask"]({ dataset: { id: p.id } });
    }
  },

  modal() {
    if (!this.open) return "";
    const opt = (role, ic, title, text) => `
      <button class="btn btn-outline btn-block" style="justify-content:flex-start;gap:12px;padding:14px 16px;text-align:left" data-click="auth:login" data-role="${role}">
        ${icon(ic, 20)}<span><strong style="display:block">${title}</strong><small style="color:var(--olive)">${text}</small></span>
      </button>`;
    return `
      <div class="modal-backdrop" data-click="auth:close" data-backdrop>
        <div class="modal modal-confirm" style="max-width:420px">
          <h3 class="modal-confirm-title">Inicia sesión para continuar</h3>
          <p class="modal-confirm-text">Para inscribirte o ver el detalle de un evento necesitas una cuenta.</p>
          <div style="display:grid;gap:10px;margin:18px 0">
            ${opt("user", "user", "Usuario", "Explora e inscríbete a eventos")}
            ${opt("manager", "tasks", "Agente", "Opera los eventos que te asignaron")}
            ${opt("admin", "shield", "Administrador", "Gestión completa de la plataforma")}
          </div>
          <button class="btn btn-outline btn-block" data-click="auth:close">Ahora no</button>
        </div>
      </div>`;
  },
};

registerClick({
  "auth:open":  () => { Guard.open = true; rerender(); },
  "auth:close": () => Guard.close(),
  "auth:login": (el) => Guard.resume(el.dataset.role),
  "app:logout": () => { Session.logout(); App.mode = "guest"; App.render({ resetScroll: true }); },
});
