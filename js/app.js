/* ==========================================================
   app.js — Estado global, navegación y dibujado de la página
   Se carga al final, cuando ya existen todas las páginas.
   ========================================================== */
const App = {
  mode: "guest", adminView: "dashboard", offline: false,
  adminPages() { return { dashboard: DashboardPage, accounts: AccountsPage, profile: ProfilePage }; },
  currentPage() {
    if (this.mode === "guest") return GuestHome;
    if (this.mode === "manager") return ManagerApp.currentPage();
    if (this.mode === "user") return UserApp.currentPage();
    return this.adminPages()[this.adminView];
  },
  html() {
    if (!Guard.canAccess(this.mode)) this.mode = "guest";
    const banner = this.offline ? OfflineBanner.render() : "";
    if (this.mode === "guest") return banner + GuestHome.render();
    if (this.mode === "manager") return banner + ManagerApp.render();
    if (this.mode === "user") return banner + UserApp.render();
    return banner + AppShell.render({ sidebar: AdminSidebar.render(), page: this.currentPage().render(), title: navTitle(ADMIN_NAV, this.adminView) });
  },
  render({ resetScroll = false } = {}) {
    const root = document.getElementById("root");
    const oldMain = root.querySelector(".main");
    const scrollTop = oldMain ? oldMain.scrollTop : 0;
    const active = document.activeElement;
    const focus = active && active.id ? { id: active.id, start: active.selectionStart, end: active.selectionEnd } : null;
    root.innerHTML = this.html();
    const newMain = root.querySelector(".main");
    if (newMain && !resetScroll) newMain.scrollTop = scrollTop;
    if (focus) {
      const el = document.getElementById(focus.id);
      if (el) { el.focus(); try { el.setSelectionRange(focus.start, focus.end); } catch (_) { } }
    }
    const page = this.currentPage();
    if (page && page.afterRender) page.afterRender();
  },
};
function rerender() { App.render(); }
registerClick({ "nav:admin": (el) => { App.adminView = el.dataset.view; App.render({ resetScroll: true }); } });

/* ----- Datos desde la API ----- */
const OfflineBanner = {
  retrying: false,
  render() {
    return `<div class="offline-banner" role="alert">
      <span>${icon("wifiOff", 18, { width: 2 })}</span>
      <div><strong>No pudimos conectar con el servidor.</strong> Revisa que el backend esté encendido (<code>npm start</code>) y vuelve a intentar.</div>
      <button class="btn btn-sm btn-light" data-click="app:retry" ${this.retrying ? "disabled" : ""}>${this.retrying ? "Reintentando…" : "Reintentar"}</button>
    </div>`;
  },
};

/** Descarga eventos, cuentas, asistentes y tareas y las deja en Data. Devuelve true si salió bien. */
async function refreshData() {
  try {
    const [events, accounts, attendees, ciudades] = await Promise.all([api.get("/events"), api.get("/accounts"), api.get("/attendees"), api.get("/ciudades")]);
    Data.events = events.map((ev) => ({
      ...ev,
      date: String(ev.event_date).split("T")[0], time: ev.start_time, type: ev.type_code, price: ev.price_cop, image: ev.image_url || TYPE_IMAGES[ev.type_code],
      basePrice: ev.base_price_cop, salesState: ev.sales_state,
    }));
    // PERSONA + subclase: el rol viene deducido de la herencia (cliente → user, agente → manager, administrador → admin)
    Data.accounts = accounts.map((acc) => ({ ...acc, role: acc.role === "agent" ? "manager" : acc.role, cityId: acc.city_id, loyaltyPoints: acc.loyalty_points }));
    Data.cities = ciudades.map((c) => ({ id: c.id_ciudad ?? c.id, name: c.nombre_ciudad ?? c.name, department: c.nombre_departamento ?? c.department }));
    // RESERVA (antes INSCRIBE_RESERVA): una fila por reserva, con número de entradas, valor total y causa de cancelación
    Data.attendees = attendees.map((a) => ({
      id: a.id, userId: a.user_id, name: a.name, email: a.email, phone: a.phone, eventId: a.event_id, eventName: a.event_name,
      status: a.status, zone: a.zone_code, tickets: a.tickets || 1, total: a.total_paid ?? 0, paymentCode: a.payment_code || "",
      registeredAt: a.registered_at, cancelReason: a.cancel_reason || "",
    }));
    Data.tasks = [];                                       // el módulo de tareas ya no existe en el modelo ER
    App.offline = false;
    if (typeof MgrCommission !== "undefined") MgrCommission.invalidate();
    if (typeof RevenueReport !== "undefined") RevenueReport.invalidate();
    return true;
  } catch (error) {
    console.error("No se pudo cargar la información desde el backend:", error);
    App.offline = true;
    return false;
  }
}

/** Vuelve a pedir los datos y redibuja SIN tocar la sesión ni la pantalla actual (se usa tras cada cambio). */
async function syncData() {
  await refreshData();
  App.render();
}

/** Arranque de la página: datos → dibujo → recuperar sesión guardada (solo aquí se vuelve a "entrar") */
async function iniciarApp() {
  await refreshData();
  App.render();
  Session.restore().then((user) => { if (user) AuthFlow.enter(user); });
}
registerClick({
  "app:retry": async () => {
    OfflineBanner.retrying = true; App.render();
    const ok = await refreshData();
    OfflineBanner.retrying = false;
    App.render();
    if (ok && !Session.isAuthenticated) Session.restore().then((user) => { if (user) AuthFlow.enter(user); });
  },
});
document.addEventListener("DOMContentLoaded", iniciarApp);
