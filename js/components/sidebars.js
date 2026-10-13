/* ==========================================================
   components/sidebars.js — Menús laterales de los paneles internos
   Admin  → Finanzas y estadísticas · Gestión de cuentas · Mi perfil
   Agente → Dashboard operativo · Eventos · Calendario · Cupos/Aforo · Asistentes · Tareas
   (El usuario NO tiene menú lateral: usa el Home con el Navbar y «Mi panel».)
   ========================================================== */

const ADMIN_NAV = [
  { id: "dashboard", label: "Finanzas y estadísticas", icon: "chart" },
  { id: "accounts",  label: "Gestión de cuentas",      icon: "users" },
  { id: "profile",   label: "Mi perfil",               icon: "user" },
];

const MANAGER_NAV = [
  { id: "inicio",     label: "Dashboard operativo", icon: "home" },
  { id: "eventos",    label: "Gestión de eventos",  icon: "ticket" },
  { id: "calendario", label: "Calendario",          icon: "calendar" },
  { id: "aforo",      label: "Cupos y aforo",       icon: "gauge" },
  { id: "asistentes", label: "Asistentes",          icon: "check" },
  { id: "tareas",     label: "Tareas",              icon: "tasks" },
];

/** Estructura común del menú lateral. cfg: { sub, roleLabel, items, active, click, meName, meRole, meBg } */
function sidebarHtml(cfg) {
  const nav = cfg.items.map((item) => {
    const active = cfg.active === item.id;
    return `
      <button class="nav-item ${active ? "active" : ""}" data-click="${cfg.click}" data-view="${item.id}">
        ${icon(item.icon, 20, { width: 1.8 })}<span class="nav-label">${item.label}</span>${active ? `<span class="nav-dot"></span>` : ""}
      </button>`;
  }).join("");
  return `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand">
          <div class="brand-logo"><span>E</span></div>
          <div><div class="brand-name">EventPro</div><div class="brand-sub">${cfg.sub}</div></div>
        </div>
      </div>
      <div class="role-box"><div class="role-chip">${icon("shield", 14, { color: "var(--primary-fg)" })} ${cfg.roleLabel}</div></div>
      <nav class="nav"><div class="nav-title">Menú</div>${nav}</nav>
      <div class="sidebar-footer">
        <div class="theme-row"><span>Tema</span>${ThemeToggle.render()}</div>
        <button class="btn btn-outline switch-btn" data-click="app:logout">${icon("logout", 16, { color: "var(--muted)" })} Cerrar sesión</button>
        <div class="me">
          <div class="me-avatar" style="background:var(--lilac);color:#16123b">${esc(initials(Session.user.name))}</div>
          <div><div class="me-name">${esc(Session.user.name)}</div><div class="me-role">${cfg.meRole}</div></div>
        </div>
      </div>
    </aside>`;
}

const AdminSidebar = {
  render() {
    return sidebarHtml({ sub: "Panel de administración", roleLabel: "Administrador", items: ADMIN_NAV, active: App.adminView, click: "nav:admin", meRole: "Administradora" });
  },
};

const ManagerSidebar = {
  render() {
    return sidebarHtml({ sub: "Panel del Agente", roleLabel: "Agente", items: MANAGER_NAV, active: ManagerApp.view, click: "nav:manager", meRole: "Event Manager" });
  },
};
