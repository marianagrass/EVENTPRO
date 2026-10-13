/* ==========================================================
   app.js — Estado global, navegación y dibujado de la página
   Se carga al final, cuando ya existen todas las páginas.

   App.mode decide qué se dibuja:
     "guest"   → Home (visitante)
     "user"    → el MISMO Home con Navbar de usuario; «Mi panel» (AccountPage) desde el avatar
     "manager" → Panel del Agente (operación total de eventos)
     "admin"   → Panel del Admin (finanzas y gestión de cuentas)
   ========================================================== */

const App = {
  mode: "guest",        // "guest" | "user" | "manager" | "admin"
  adminView: "dashboard",

  /* Páginas del panel de administrador: solo finanzas y cuentas */
  adminPages() {
    return {
      dashboard: DashboardPage,
      accounts:  AccountsPage,
      profile:   ProfilePage,
    };
  },

  /* Devuelve el objeto página que se está mostrando (para llamar render/afterRender) */
  currentPage() {
    if (this.mode === "guest") return GuestHome;
    if (this.mode === "manager") return ManagerApp.currentPage();
    if (this.mode === "user") return UserApp.currentPage();
    return this.adminPages()[this.adminView];
  },

  html() {
    if (!Guard.canAccess(this.mode)) this.mode = "guest";
    if (this.mode === "guest") return GuestHome.render();
    if (this.mode === "manager") return ManagerApp.render();
    if (this.mode === "user") return UserApp.render();
    return AppShell.render({
      sidebar: AdminSidebar.render(),
      page: this.currentPage().render(),
      title: navTitle(ADMIN_NAV, this.adminView),
    });
  },

  /**
   * Vuelve a dibujar todo. Conserva el scroll y el foco del campo activo
   * para que escribir en un buscador no se sienta "saltón".
   */
  render({ resetScroll = false } = {}) {
    const root = document.getElementById("root");
    const oldMain = root.querySelector(".main");
    const scrollTop = oldMain ? oldMain.scrollTop : 0;

    const active = document.activeElement;
    const focus = active && active.id
      ? { id: active.id, start: active.selectionStart, end: active.selectionEnd }
      : null;

    root.innerHTML = this.html();

    const newMain = root.querySelector(".main");
    if (newMain && !resetScroll) newMain.scrollTop = scrollTop;

    if (focus) {
      const el = document.getElementById(focus.id);
      if (el) {
        el.focus();
        try { el.setSelectionRange(focus.start, focus.end); } catch (_) { /* no aplica a todos los inputs */ }
      }
    }

    const page = this.currentPage();
    if (page && page.afterRender) page.afterRender();
  },
};

function rerender() { App.render(); }

/* ---------- Navegación ---------- */
registerClick({
  "nav:admin": (el) => { App.adminView = el.dataset.view; App.render({ resetScroll: true }); },
  // "nav:user" vive en pages/user/user-app.js y "nav:manager" en pages/manager/manager.js
});

/* ---------- Arranque ---------- */
document.addEventListener("DOMContentLoaded", () => App.render());
