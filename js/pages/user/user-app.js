/* ==========================================================
   pages/user/user-app.js — Estado del usuario con sesión
   El usuario NO tiene un "Inicio" aparte: su pantalla principal es el mismo Home público
   (GuestHome), con el Navbar de usuario. «Mi panel» (AccountPage) es una vista secundaria
   a la que se llega desde el avatar del Navbar.

   UserApp.view:  "home" | "panel" | "inscripciones" | "historial" | "perfil" | "asistente"
   ========================================================== */
const UserApp = {
  view: "home",
  registrations: [...Data.userRegistrations],     // ids de eventos en los que está inscrito
  profile: { nombre: "Carlos", apellido: "Mejía", correo: "carlos.mejia@correo.co", telefono: "315 678 9012", ciudad: "Tuluá", institucion: "UCEVA" },

  /* ----- consultas ----- */
  eventsOf(list) { return Data.events.filter((e) => list.includes(e.id)); },
  upcoming() { return this.eventsOf(this.registrations).filter((e) => e.status !== "completado" && e.status !== "cancelado").sort((a, b) => a.date.localeCompare(b.date)); },
  past()     { return this.eventsOf(this.registrations).filter((e) => e.status === "completado").sort((a, b) => b.date.localeCompare(a.date)); },
  isRegistered(id) { return this.registrations.includes(id); },

  /* cupos_restantes = capacidad_total - inscritos_actuales (ev.registered ya incluye las inscripciones
     hechas en la app: register / unregister lo actualizan, y el Agente ve el mismo número). */
  getSpots(eventId) {
    const ev = Data.events.find((e) => e.id === eventId);
    if (!ev) return 0;
    if (ev.availability && ev.availability !== "open") return 0;   // pausado/cerrado por el Agente
    return Math.max(0, ev.capacity - ev.registered);
  },

  /* ----- inscribirse / cancelar -----
     Devuelve true si salió bien, o un texto con el motivo si no se pudo. */
  register(eventId) {
    const ev = Data.events.find((e) => e.id === eventId);
    if (!ev) return "Este evento ya no está disponible.";
    if (this.isRegistered(eventId)) return true;
    if (ev.availability !== "open") return "Las inscripciones de este evento no están abiertas.";
    if (this.getSpots(eventId) <= 0) return "Este evento se quedó sin cupos.";

    ev.registered += 1;
    this.registrations.push(eventId);
    // El Agente ve la inscripción en su lista de asistentes
    Data.attendees = Data.attendees.filter((a) => a.id !== `au-${eventId}`);
    Data.attendees.push({
      id: `au-${eventId}`, name: Session.user.name, email: this.profile.correo, phone: this.profile.telefono,
      eventId, eventName: ev.name, status: "confirmado", registeredAt: new Date().toISOString().slice(0, 10), checkedInAt: null,
    });
    return true;
  },

  unregister(eventId) {
    if (!this.isRegistered(eventId)) return;
    const ev = Data.events.find((e) => e.id === eventId);
    this.registrations = this.registrations.filter((id) => id !== eventId);
    if (ev) ev.registered = Math.max(0, ev.registered - 1);
    Data.attendees = Data.attendees.filter((a) => a.id !== `au-${eventId}`);
  },

  /* ----- pantalla ----- */
  currentPage() { return this.view === "home" ? GuestHome : AccountPage; },
  render() { return this.currentPage().render(); },
};

registerClick({
  "user:unregister": (el) => { UserApp.unregister(el.dataset.id); rerender(); },
  "user:home":       () => { UserApp.view = "home"; App.render({ resetScroll: true }); },
  "nav:user":        (el) => { UserApp.view = el.dataset.view; App.render({ resetScroll: true }); },
});
