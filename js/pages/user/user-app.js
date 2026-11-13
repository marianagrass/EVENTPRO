/* ==========================================================
   pages/user/user-app.js — Estado del usuario con sesión
   ========================================================== */
const UserApp = {
  view: "home",
  profile: { nombre: "", apellido: "", correo: "", telefono: "", cityId: "", direccion: "" },

  get registrations() {
    const uid = Session.user && Session.user.id;
    return uid ? Data.attendees.filter((a) => a.userId === uid && a.status !== "cancelado").map((a) => a.eventId) : [];
  },

  loadFor(user) {
    const acc = Data.accounts.find((a) => a.id === user.id) || {};
    const [nombre, ...rest] = user.name.trim().split(/\s+/);
    this.profile = { nombre, apellido: rest.join(" "), correo: user.email, telefono: acc.phone || "", cityId: acc.city_id || "", direccion: acc.address || "" };
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
  async unregister(eventId, causa) {
    if (!this.isRegistered(eventId)) return true;
    try {
      await api.post("/unregister", { eventId, userId: Session.user.id, causa });
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

/* Cancelar una inscripción (RESERVA) pide la causa: se guarda en RESERVA.causa_cancelacion */
const CancelReserva = {
  eventId: null, causa: "", error: "", busy: false,
  get isOpen() { return !!this.eventId; },
  open(eventId) {
    Object.assign(this, { eventId, causa: "", error: "", busy: false });
    rerender();
    const t = document.getElementById("cr-causa"); if (t) t.focus();
  },
  close() { if (this.busy) return; this.eventId = null; rerender(); },
  async save() {
    if (this.busy || !this.eventId) return;
    const causa = this.causa.trim();
    if (causa.length < 3) { this.error = "Cuéntanos por qué cancelas (mínimo 3 caracteres)."; rerender(); return; }
    this.busy = true; this.error = ""; rerender();
    try {
      await api.post("/unregister", { eventId: this.eventId, userId: Session.user.id, causa });
      this.eventId = null; this.busy = false;
      Toast.show("Inscripción cancelada. Tu pago será reembolsado.", "ok", 3500);
      await syncData();
    } catch (e) { this.busy = false; this.error = e.message; rerender(); }
  },
  render() {
    const ev = Data.events.find((e) => e.id === this.eventId);
    if (!ev) return "";
    return `<div class="modal-backdrop" data-click="user:cancelClose" data-backdrop><div class="modal modal-confirm" role="dialog" aria-modal="true" aria-labelledby="cr-title">
        <h3 class="modal-confirm-title" id="cr-title">¿Cancelar tu inscripción?</h3>
        <p class="modal-confirm-text">${esc(ev.name)}. Se libera tu cupo, se reembolsa el pago y se devuelven tus puntos.</p>
        <label class="field-label" for="cr-causa" style="margin-top:12px">Causa de la cancelación</label>
        <textarea id="cr-causa" class="input" rows="3" maxlength="500" placeholder="Ej. Me surgió un compromiso" data-input="user:causaInput" style="resize:vertical;min-height:84px">${esc(this.causa)}</textarea>
        ${this.error ? `<p class="auth-error" role="alert" style="margin-top:10px">${esc(this.error)}</p>` : ""}
        <div class="modal-actions"><button class="btn btn-outline" data-click="user:cancelClose">Volver</button>
          <button class="btn btn-danger" data-click="user:cancelSave" ${this.busy ? "disabled" : ""}>${this.busy ? "Cancelando…" : "Cancelar inscripción"}</button></div></div></div>`;
  },
};
registerInput({ "user:causaInput": (el) => { CancelReserva.causa = el.value; } });

registerClick({
  "user:unregister": (el) => CancelReserva.open(el.dataset.id),
  "user:cancelClose": () => CancelReserva.close(),
  "user:cancelSave": () => CancelReserva.save(),
  "user:home":       () => { UserApp.view = "home"; App.render({ resetScroll: true }); },
  "nav:user":        (el) => { UserApp.view = el.dataset.view; App.render({ resetScroll: true }); },
});