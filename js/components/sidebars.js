/* ==========================================================
   components/sidebars.js — Menús laterales (admin y usuario)
   ========================================================== */

const ADMIN_NAV = [
  { id: "dashboard", label: "Inicio",       icon: "home" },
  { id: "events",    label: "Eventos",      icon: "calendar" },
  { id: "calendar",  label: "Calendario",   icon: "clock" },
  { id: "attendees", label: "Asistentes",   icon: "users", adminOnly: true },
  { id: "tasks",     label: "Tareas",       icon: "tasks" },
  { id: "agente",    label: "Asistente IA", icon: "chat", badge: "IA" },
  { id: "profile",   label: "Mi perfil",    icon: "user" },
];

const USER_NAV = [
  { id: "inicio",      label: "Inicio",            icon: "home" },
  { id: "eventos",     label: "Explorar eventos",  icon: "search" },
  { id: "mis-eventos", label: "Mis inscripciones", icon: "tasks" },
  { id: "agente",      label: "Asistente IA",      icon: "chat" },
  { id: "perfil",      label: "Mi perfil",         icon: "user" },
];

const AdminSidebar = {
  render() {
    const items = ADMIN_NAV.filter((i) => !i.adminOnly || App.role === "admin");
    const nav = items.map((item) => {
      const active = App.adminView === item.id;
      const isAgent = item.id === "agente";
      return `
        <button class="nav-item ${active ? "active" : ""} ${isAgent ? "agent" : ""}" data-click="nav:admin" data-view="${item.id}">
          ${icon(item.icon, 20, { width: 1.8 })}
          <span class="nav-label">${item.label}</span>
          ${item.badge && !active ? `<span class="nav-badge">${item.badge}</span>` : ""}
          ${active && !isAgent ? `<span class="nav-dot"></span>` : ""}
        </button>`;
    }).join("");

    return `
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="brand">
            <div class="brand-logo"><span>E</span></div>
            <div>
              <div class="brand-name">EventPro</div>
              <div class="brand-sub">Panel administrativo</div>
            </div>
          </div>
        </div>

        <div class="role-box">
          <div class="role-chip">${icon("shield", 14, { color: "#354024" })} ${App.role === "admin" ? "Administrador" : "Usuario"}</div>
        </div>

        <nav class="nav">
          <div class="nav-title">Menú</div>
          ${nav}
        </nav>

        <div class="sidebar-footer">
          <button class="btn btn-outline switch-btn" data-click="app:logout">
            ${icon("user", 16, { color: "#889063" })} Cerrar sesión
          </button>
          <div class="me">
            <div class="me-avatar" style="background:#cfbb99;color:#4c3d19">SN</div>
            <div>
              <div class="me-name">Sofía Navarro</div>
              <div class="me-role">Administradora</div>
            </div>
          </div>
        </div>
      </aside>`;
  },
};

const UserSidebar = {
  render() {
    const count = UserApp.registrations.length;
    const nav = USER_NAV.map((item) => {
      const active = UserApp.view === item.id;
      const isAgent = item.id === "agente";
      return `
        <button class="nav-item ${active ? "active" : ""} ${isAgent ? "agent" : ""}" data-click="nav:user" data-view="${item.id}">
          ${icon(item.icon, 20, { width: 1.8 })}
          <span class="nav-label">${item.label}</span>
          ${item.id === "mis-eventos" && count > 0 ? `<span class="nav-count">${count}</span>` : ""}
          ${isAgent && !active ? `<span class="nav-badge">IA</span>` : ""}
          ${active && item.id !== "mis-eventos" && !isAgent ? `<span class="nav-dot"></span>` : ""}
        </button>`;
    }).join("");

    return `
      <aside class="sidebar sidebar-user">
        <div class="sidebar-brand">
          <div class="brand">
            <div class="brand-logo" style="background:linear-gradient(135deg,#354024,#889063)"><span>E</span></div>
            <div>
              <div class="brand-name">EventPro</div>
              <div class="brand-sub">Portal de eventos</div>
            </div>
          </div>
        </div>

        <div class="role-box">
          <div class="role-chip" style="background:var(--cream);color:var(--olive)">
            <span class="dot" style="background:#889063"></span> Modo Usuario
          </div>
        </div>

        <nav class="nav">${nav}</nav>

        <div class="sidebar-footer">
          <button class="btn btn-outline switch-btn" data-click="app:logout">
            ${icon("shield", 15, { color: "#889063" })} Cerrar sesión
          </button>
          <div class="me">
            <div class="me-avatar" style="background:linear-gradient(135deg,#889063,#cfbb99);color:#fff">CM</div>
            <div>
              <div class="me-name" style="font-weight:600">Carlos Mejía</div>
              <div class="me-role" style="color:#cfbb99">Usuario</div>
            </div>
          </div>
        </div>
      </aside>`;
  },
};

/* ---------- Agente (Event Manager): solo 4 opciones ---------- */
const MANAGER_NAV = [
  { id: "inicio",     label: "Inicio",           icon: "home" },
  { id: "eventos",    label: "Mis Eventos",      icon: "calendar" },
  { id: "aforo",      label: "Control de Aforo", icon: "users" },
  { id: "asistentes", label: "Asistentes",       icon: "check" },
];

const ManagerSidebar = {
  render() {
    const nav = MANAGER_NAV.map((item) => {
      const active = ManagerApp.view === item.id;
      return `
        <button class="nav-item ${active ? "active" : ""}" data-click="nav:manager" data-view="${item.id}">
          ${icon(item.icon, 20, { width: 1.8 })}<span class="nav-label">${item.label}</span>${active ? `<span class="nav-dot"></span>` : ""}
        </button>`;
    }).join("");
    return `
      <aside class="sidebar">
        <div class="sidebar-brand"><div class="brand"><div class="brand-logo"><span>E</span></div>
          <div><div class="brand-name">EventPro</div><div class="brand-sub">Panel del Agente</div></div></div></div>
        <div class="role-box"><div class="role-chip">${icon("shield", 14, { color: "#354024" })} Agente</div></div>
        <nav class="nav"><div class="nav-title">Menú</div>${nav}</nav>
        <div class="sidebar-footer">
          <button class="btn btn-outline switch-btn" data-click="app:logout">${icon("right", 16, { color: "#889063" })} Cerrar sesión</button>
          <div class="me"><div class="me-avatar" style="background:#cfbb99;color:#4c3d19">${esc(initials(Session.user.name))}</div>
            <div><div class="me-name">${esc(Session.user.name)}</div><div class="me-role">Event Manager</div></div></div>
        </div>
      </aside>`;
  },
};
