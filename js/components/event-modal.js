/* ==========================================================
   components/event-modal.js — Modal de evento (detalles + confirmar inscripción)
   Es el ÚNICO modal de evento de la app. Lo dibuja PublicLayout encima del Home,
   así que funciona igual para el usuario que ya tenía sesión y para el visitante
   que acaba de iniciarla.

   Estado propio y mínimo (independiente de Guard / login):
     EventModal.eventId  → id del evento abierto (null = cerrado)
     EventModal.done     → true tras confirmar: muestra la pantalla de éxito
     EventModal.error    → mensaje si la inscripción no se pudo completar
   El evento se lee SIEMPRE de Data.events con el id (no se guarda una copia),
   por eso los datos nunca quedan "viejos" ni incompletos tras el login.

   Dark mode: la caja de cupos usa la clase .evm-info (css/panels.css), que cambia
   con el tema; no lleva colores fijos en línea.
   ========================================================== */
const EventModal = {
  eventId: null,
  done: false,
  error: "",
  _focus: false,

  get event() { return this.eventId ? Data.events.find((e) => e.id === this.eventId) || null : null; },
  get isOpen() { return !!this.eventId; },

  /** Cierra y limpia sin volver a dibujar (para login / logout) */
  reset() { this.eventId = null; this.done = false; this.error = ""; this._focus = false; },

  open(id) {
    // Sin sesión de usuario no hay inscripción: se recuerda el evento y se abre el login (vuelve aquí al entrar)
    if (!Session.isUser) { AuthModal.open({ view: "login", pending: { eventId: id } }); return; }
    if (!Data.events.some((e) => e.id === id)) return;
    this.eventId = id; this.done = false; this.error = ""; this._focus = false;
    rerender();
  },

  close() { this.reset(); rerender(); },

  /** «Confirmar inscripción» abre el Checkout: ahí se elige zona, puntos y método de pago (la inscripción se guarda al pagar). */
  confirm() {
    const ev = this.event;
    if (!ev) return;
    const id = ev.id;
    this.reset();
    CheckoutModal.open(id);
  },

  async cancelRegistration() {
    const ev = this.event;
    if (!ev) return;
    this.error = "";
    CancelReserva.open(ev.id);               // pide la causa antes de cancelar la reserva
  },

  /* ----- vista ----- */
  metaRow(ic, text) {
    return `<div class="evm-meta">${icon(ic, 16, { width: 2 })}<span>${text}</span></div>`;
  },

  infoBox(spots, state, state_ = "disponible") {
    // state: open | paused | closed
    if (state !== "open") {
      return `<div class="evm-info is-full" role="status">${icon("clock", 16)}<span>${state === "paused" ? "Las inscripciones están pausadas por ahora" : "Las inscripciones están cerradas"}</span></div>`;
    }
    if (spots <= 0) return `<div class="evm-info is-full" role="status">${icon("users", 16)}<span><strong>Agotado</strong>: ya no quedan cupos</span></div>`;
    const low = spots <= 20 || state_ === "ultimos_cupos";
    return `<div class="evm-info ${low ? "is-low" : ""}" role="status">${icon(low ? "zap" : "users", 16)}<span>${state_ === "ultimos_cupos" ? "<strong>¡Últimos cupos!</strong> " : ""}Quedan <strong>${spots} cupos</strong> disponibles</span></div>`;
  },

  render() {
    const ev = this.event;
    if (!ev) { if (this.eventId) this.reset(); return ""; }

    const tc = TYPE_STYLE[ev.type] || TYPE_STYLE.academico;
    const spots = UserApp.getSpots(ev.id);
    const registered = UserApp.registrations.includes(ev.id);
    const state = ev.availability || "open";
    const whenRaw = parseDate(ev.date).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const when = whenRaw.charAt(0).toUpperCase() + whenRaw.slice(1);
    const price = ev.price > 0 ? cop(ev.price) : "Gratis";
    const fromZone = ev.price > 0 ? `Desde <strong>${esc(price)}</strong> (zona general) · preferencial ×1,5 · VIP ×2,5` : `<strong>Gratis</strong>`;

    const head = `
      <div class="evm-hero" style="background:${tc.gradient}">
        ${ev.image ? `<img src="${esc(bigImage(ev.image, 900))}" alt="" onerror="this.remove()">` : ""}
        <div class="evm-shade"></div>
        <button type="button" class="evm-x" data-click="event:close" aria-label="Cerrar">${icon("x", 18, { width: 2.4 })}</button>
        <div class="evm-hero-in">
          <div class="row" style="gap:8px;flex-wrap:wrap">
            <span class="img-badge img-badge-lg" style="background:${tc.gradient};color:#fff">${esc(TYPE_LABEL[ev.type])}</span>
            <span class="img-badge img-badge-lg evm-price">${esc(price)}</span>
          </div>
          <h3 class="evm-title" id="evm-title">${esc(ev.name)}</h3>
        </div>
      </div>`;

    let body, actions;
    if (this.done) {
      body = `
        <div class="evm-done">
          <span class="evm-done-ic">${icon("check", 26, { color: "#fff", width: 3 })}</span>
          <h4>¡Inscripción confirmada!</h4>
          <p>Ya tienes tu cupo en <strong>${esc(ev.name)}</strong>. Lo encuentras en «Mis inscripciones».</p>
        </div>`;
      actions = `
        <button class="btn btn-outline btn-block" data-click="event:close">Seguir explorando</button>
        <button class="btn btn-primary btn-block" data-click="event:goInscripciones">Ver mis inscripciones</button>`;
    } else {
      body = `
        <div class="evm-metas">
          ${this.metaRow("calendar", `${esc(when)} · ${esc(ev.time)}`)}
          ${this.metaRow("pin", esc(ev.location))}
          ${this.metaRow("ticket", `Valor de la boleta: ${fromZone}`)}
        </div>
        ${ev.description ? `<p class="evm-desc">${esc(ev.description)}</p>` : ""}
        ${this.infoBox(spots, state, ev.salesState)}
        ${this.error ? `<div class="auth-error" role="alert">${esc(this.error)}</div>` : ""}`;

      if (registered) {
        actions = `
          <button class="btn btn-danger btn-block" data-click="event:cancelReg">Cancelar inscripción</button>
          <button class="btn btn-outline btn-block" data-click="event:close">Cerrar</button>`;
        body = `<div class="evm-registered">${icon("check", 16, { width: 3 })} Ya estás inscrito en este evento</div>` + body;
      } else {
        const blocked = spots <= 0 || state !== "open";
        actions = `
          <button class="btn btn-outline btn-block" data-click="event:close">Cancelar</button>
          <button class="btn btn-block evm-confirm" ${blocked ? "disabled" : `style="background:${tc.gradient}"`} data-click="event:confirm">
            ${blocked ? (state !== "open" ? "Inscripciones cerradas" : "Sin cupos") : "Confirmar inscripción"}
          </button>`;
      }
    }

    return `
      <div class="modal-backdrop evm-backdrop" data-click="event:close" data-backdrop>
        <div class="modal evm" role="dialog" aria-modal="true" aria-labelledby="evm-title" tabindex="-1">
          ${head}
          <div class="evm-body">
            ${body}
            <div class="modal-actions evm-actions">${actions}</div>
          </div>
        </div>
      </div>`;
  },

  /** Pone el foco dentro del modal una sola vez por apertura (teclado / lectores de pantalla) */
  afterRender() {
    if (!this.isOpen || this._focus) return;
    const dlg = document.querySelector(".evm");
    if (dlg) { dlg.focus({ preventScroll: true }); this._focus = true; }
  },
};

registerClick({
  "event:details":  (el) => EventModal.open(el.dataset.id),
  "event:register": (el) => EventModal.open(el.dataset.id),
  "event:close":    () => EventModal.close(),
  "event:confirm":  () => EventModal.confirm(),
  "event:cancelReg": () => EventModal.cancelRegistration(),
  "event:goInscripciones": () => { EventModal.reset(); UserApp.view = "inscripciones"; App.render({ resetScroll: true }); },
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && EventModal.isOpen) EventModal.close(); });
