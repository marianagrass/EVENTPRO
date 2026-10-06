/* ==========================================================
   pages/user/user-app.js — Portal de usuario: estado e inscripciones
   ========================================================== */

const UserApp = {
  view: "inicio",                       // pantalla activa del portal
  registrations: [...Data.userRegistrations],   // ids de eventos inscritos
  cuposAdjust: {},                      // cupos tomados/liberados en esta sesión

  register(eventId) {
    if (this.registrations.includes(eventId)) return;
    this.registrations.push(eventId);
    this.cuposAdjust[eventId] = (this.cuposAdjust[eventId] ?? 0) + 1;
  },

  unregister(eventId) {
    this.registrations = this.registrations.filter((id) => id !== eventId);
    this.cuposAdjust[eventId] = (this.cuposAdjust[eventId] ?? 0) - 1;
  },

  /* Cupos libres = capacidad - inscritos - ajuste de esta sesión */
  getSpots(eventId) {
    const ev = Data.events.find((e) => e.id === eventId);
    if (!ev) return 0;
    if (ev.availability && ev.availability !== "open") return 0;   // pausado/cerrado por el Agente
    return ev.capacity - ev.registered - (this.cuposAdjust[eventId] ?? 0);
  },

  pages() {
    return {
      "inicio":      UserDashboardPage,
      "eventos":     UserEventsPage,
      "mis-eventos": UserMyEventsPage,
      "agente":      AgentPage,
      "perfil":      UserProfilePage,
    };
  },

  currentPage() { return this.pages()[this.view]; },

  render() {
    return `
      <div class="app">
        ${UserSidebar.render()}
        <main class="main">${this.currentPage().render()}</main>
      </div>`;
  },
};

registerClick({
  "user:register":   (el) => { UserApp.register(el.dataset.id);   rerender(); },
  "user:unregister": (el) => { UserApp.unregister(el.dataset.id); rerender(); },
});
