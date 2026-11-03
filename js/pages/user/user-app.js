/* ==========================================================
   pages/user/user-app.js — Estado del usuario con sesión
   ========================================================== */
const UserApp = {
  view: "home",
  profile: { nombre: "", apellido: "", correo: "", telefono: "", ciudad: "", institucion: "" },

  get registrations() {
    const uid = Session.user && Session.user.id;
    return uid ? Data.attendees.filter((a) => a.userId === uid && a.status !== "cancelado").map((a) => a.eventId) : [];
  },

  loadFor(user) {
    const acc = Data.accounts.find((a) => a.id === user.id) || {};
    const [nombre, ...rest] = user.name.trim().split(/\s+/);
    this.profile = { nombre, apellido: rest.join(" "), correo: user.email, telefono: acc.phone || "", ciudad: acc.city || "", institucion: acc.institution || "" };
    this.view = "home";
  },

  eventsOf(list) { return Data.events.filter((e) => list.includes(e.id)); },
  upcoming() { return this.eventsOf(this.registrations).filter((e) => e.status !== "completado" && e.status !== "cancelado").sort((a, b) => a.date.localeCompare(b.date)); },
  past()     { return this.eventsOf(this.registrations).filter((e) => e.status === "completado").sort((a, b) => b.date.localeCompare(a.date)); },
  isRegistered(id) { return this.registrations.includes(id); },

  getSpots(eventId) {
    const ev = Data.events.find((e) => e.id === eventId);
    if (!ev) return 0;
    if (ev.availability && ev.availability !== "open") return 0;
    return Math.max(0, ev.capacity - ev.registered);
  },

  /** Cancela la inscripción (y su pago, con reembolso simulado). Espera la respuesta del servidor: la pantalla
      solo cambia si la base de datos realmente la canceló. Devuelve true/false. */
  async unregister(eventId) {
    if (!this.isRegistered(eventId)) return true;
    try {
      await api.post("/unregister", { eventId, userId: Session.user.id });
    } catch (e) {
      Toast.show(e.message, "error");
      return false;
    }
    await syncData();
    return true;
  },

  currentPage() { return this.view === "home" ? GuestHome : AccountPage; },
  render() { return this.currentPage().render(); },
};

registerClick({
  "user:unregister": async (el) => { await UserApp.unregister(el.dataset.id); rerender(); },
  "user:home":       () => { UserApp.view = "home"; App.render({ resetScroll: true }); },
  "nav:user":        (el) => { UserApp.view = el.dataset.view; App.render({ resetScroll: true }); },
});