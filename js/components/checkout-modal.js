/* ==========================================================
   components/checkout-modal.js — Checkout: entradas + zona + puntos + método de pago simulado

   Flujo:  EventModal «Confirmar inscripción» → CheckoutModal.open(eventId)
     loading → (fila virtual si el servidor está saturado) → form → processing → done

   TODOS los números salen del servidor (POST /api/checkout/quote): el front solo los muestra.
   P(x) = (B · x · C) − D(p)
     B  precio base del evento · x  entradas · C  coeficiente de la zona (función a trozos)
     D(p) puntos de fidelización + oferta de «nuevo ingreso»

   Los campos de pago viven en CheckoutModal.pay (memoria): el número completo y el CVV nunca se guardan
   en el navegador ni se muestran después; el servidor solo conserva marca y últimos 4 dígitos.
   ========================================================== */
const CheckoutModal = {
  eventId: null,
  phase: "loading",            // loading | queue | form | processing | done | error
  quote: null,                 // respuesta del servidor (event, zones, user, limits, quote)
  quantity: 1,
  zone: "general",
  usePoints: false,
  method: "tarjeta",           // tarjeta | pse | nequi
  pay: { number: "", name: "", exp: "", cvv: "", bank: "", phone: "" },
  fields: {},                  // errores por campo
  message: "",                 // error general
  receipt: null,
  ticket: null,                // turno de pago (X-Queue-Ticket)
  queue: null,                 // última foto de la fila
  _seq: 0, _timer: null, _poll: null, _focus: false,

  BANKS: ["Bancolombia", "Davivienda", "Banco de Bogotá", "BBVA", "Banco Popular", "Nequi", "Banco Agrario"],
  METHODS: [["tarjeta", "Tarjeta", "card"], ["pse", "PSE", "bank"], ["nequi", "Nequi", "phone"]],

  get isOpen() { return !!this.eventId; },
  get event() { return this.eventId ? Data.events.find((e) => e.id === this.eventId) || null : null; },
  headers() { return this.ticket ? { "X-Queue-Ticket": this.ticket } : undefined; },

  /* ---------- ciclo de vida ---------- */
  open(eventId) {
    if (!Session.isUser) { AuthModal.open({ view: "login", pending: { eventId } }); return; }
    this.stopPolling(); this.leaveQueue(false);
    Object.assign(this, { eventId, phase: "loading", quote: null, quantity: 1, zone: "general", usePoints: false, method: "tarjeta",
      pay: { number: "", name: "", exp: "", cvv: "", bank: "", phone: "" }, fields: {}, message: "", receipt: null, ticket: null, queue: null, _focus: false });
    rerender();
    this.loadQuote();
  },

  reset() { this.stopPolling(); this.leaveQueue(); this.eventId = null; this.quote = null; this.receipt = null; this.ticket = null; this.queue = null; this.phase = "loading"; this._focus = false; },
  close() { this.reset(); rerender(); },

  /** Volver al detalle del evento sin cobrar */
  back() { const id = this.eventId; this.reset(); EventModal.open(id); },

  /** Libera el turno de pago (si lo hay) para no ocupar un lugar que no se va a usar */
  leaveQueue(clear = true) {
    if (this.ticket && this.phase !== "done") api.post("/queue/leave", { ticket: this.ticket }).catch(() => {});
    if (clear) this.ticket = null;
  },

  /* ---------- servidor ---------- */
  async loadQuote() {
    const seq = ++this._seq;
    try {
      const body = { eventId: this.eventId, userId: Session.user.id, quantity: this.quantity, zone: this.zone, usePoints: this.usePoints };
      const { data, headers } = await api.postWithHeaders("/checkout/quote", body, this.headers());
      if (seq !== this._seq || !this.isOpen) return;
      const t = headers.get("X-Queue-Ticket");
      if (t) this.ticket = t;
      this.quote = data;
      // el servidor puede ajustar la cantidad máxima (cupos restantes)
      if (this.quantity > data.limits.maxQuantity) this.quantity = Math.max(1, data.limits.maxQuantity);
      if (this.phase === "loading" || this.phase === "queue" || this.phase === "error") this.stopPolling();
      this.phase = "form"; this.message = "";
    } catch (e) {
      if (seq !== this._seq || !this.isOpen) return;
      this.onError(e, "quote");
    }
    rerender();
  },

  /** Traduce los errores del servidor a lo que ve el usuario */
  onError(e, where) {
    if (e.code === "QUEUE_REQUIRED") { this.enterQueue(e.data); return; }
    this.fields = e.fields || {};
    if (where === "quote" && this.phase !== "form") { this.phase = "error"; this.message = e.message; return; }
    this.phase = this.quote ? "form" : "error";
    this.message = e.fields && Object.keys(e.fields).length ? "Revisa los campos marcados." : e.message;
    if (e.code === "NO_CAPACITY" || e.status === 409) { this.fields = {}; this.message = e.message; if (where === "pay") this.loadQuoteSilently(); }
  },

  async loadQuoteSilently() { const keep = this.message; await this.loadQuote(); this.message = keep; rerender(); },

  /* ---------- fila virtual ---------- */
  enterQueue(snap) {
    this.phase = "queue"; this.queue = snap; this.ticket = snap.ticket || this.ticket;
    VirtualQueue.startPosition = snap.position || 1; VirtualQueue.whyOpen = false;
    this.startPolling();
  },
  startPolling() {
    this.stopPolling();
    this._poll = setInterval(() => this.pollQueue(), 2000);
  },
  stopPolling() { if (this._poll) { clearInterval(this._poll); this._poll = null; } },
  async pollQueue() {
    if (this.phase !== "queue" || !this.ticket) return;
    try {
      const s = await api.get(`/queue/status/${this.ticket}`);
      if (this.phase !== "queue") return;
      if (s.status === "admitted") { this.stopPolling(); this.phase = "loading"; rerender(); this.loadQuote(); return; }
      if (s.status === "unknown") {            // se perdió el turno (reinicio del servidor o turno vencido): volver a entrar
        const again = await api.post("/queue/enter", { userId: Session.user.id });
        this.ticket = again.ticket;
        if (again.status === "admitted") { this.stopPolling(); this.phase = "loading"; rerender(); this.loadQuote(); return; }
        this.queue = again;
      } else this.queue = s;
      rerender();
    } catch (_) { /* sin conexión momentánea: se reintenta en 2 s */ }
  },
  leave() { this.close(); },

  /* ---------- cambios del formulario ---------- */
  schedule() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.loadQuote(), 120);
  },
  setQuantity(n) {
    const max = this.quote ? this.quote.limits.maxQuantity : 1;
    const q = Math.max(1, Math.min(max, n));
    if (q === this.quantity) return;
    this.quantity = q; this.message = ""; this.schedule(); rerender();
  },

  validateLocal() {
    const f = {}, p = this.pay;
    if (this.method === "tarjeta") {
      if (p.number.replace(/\D/g, "").length < 13) f.number = "Escribe el número de tu tarjeta.";
      if (p.name.trim().length < 3) f.name = "Escribe el nombre de la tarjeta.";
      if (!/^\d{2}\/\d{2}$/.test(p.exp)) f.exp = "Usa el formato MM/AA.";
      if (!/^\d{3,4}$/.test(p.cvv)) f.cvv = "3 o 4 dígitos.";
    } else if (this.method === "pse") {
      if (!p.bank) f.bank = "Elige tu banco.";
    } else if (!/^3\d{9}$/.test(p.phone)) f.phone = "Celular de 10 dígitos que empiece por 3.";
    return f;
  },

  async submit() {
    if (this.phase !== "form" || !this.quote) return;
    const q = this.quote.quote;
    if (q.total > 0) {
      this.fields = this.validateLocal();
      if (Object.keys(this.fields).length) { this.message = "Revisa los campos marcados."; rerender(); this.focusFirstError(); return; }
    }
    this.fields = {}; this.message = ""; this.phase = "processing"; rerender();
    const p = this.pay;
    const method = q.total <= 0 ? { type: "gratis" }
      : this.method === "tarjeta" ? { type: "tarjeta", number: p.number, name: p.name, exp: p.exp, cvv: p.cvv }
      : this.method === "pse" ? { type: "pse", bank: p.bank } : { type: "nequi", phone: p.phone };
    try {
      const { data } = await api.postWithHeaders("/checkout",
        { eventId: this.eventId, userId: Session.user.id, quantity: this.quantity, zone: this.zone, usePoints: this.usePoints, method }, this.headers());
      this.pay = { number: "", name: "", exp: "", cvv: "", bank: "", phone: "" };   // no dejar datos de pago en memoria
      this.receipt = data.payment; this.phase = "done"; this.ticket = null;
      await syncData();                                   // la inscripción ya es real: refresca cupos, puntos y «Mis inscripciones»
    } catch (e) {
      this.phase = "form"; this.onError(e, "pay");
      if (this.phase === "queue") { rerender(); return; }
      rerender(); this.focusFirstError();
    }
  },

  focusFirstError() {
    setTimeout(() => { const el = document.querySelector(".co [aria-invalid='true']"); if (el) el.focus(); }, 30);
  },

  /* ---------- vista ---------- */
  err(key) { return this.fields[key] ? `<p class="co-err" role="alert">${esc(this.fields[key])}</p>` : ""; },
  inp(key, label, attrs = {}) {
    const bad = !!this.fields[key];
    return `<div class="co-field"><label class="field-label" for="co-${key}">${label}</label>
      <input id="co-${key}" class="input ${bad ? "is-invalid" : ""}" value="${esc(this.pay[key])}" data-input="checkout:pay" data-key="${key}"
        ${attrs.inputmode ? `inputmode="${attrs.inputmode}"` : ""} ${attrs.max ? `maxlength="${attrs.max}"` : ""}
        ${attrs.ph ? `placeholder="${esc(attrs.ph)}"` : ""} ${attrs.ac ? `autocomplete="${attrs.ac}"` : ""}
        ${bad ? `aria-invalid="true"` : ""} spellcheck="false">${this.err(key)}</div>`;
  },

  methodFields() {
    if (this.method === "tarjeta") return `
      ${this.inp("number", "Número de tarjeta", { inputmode: "numeric", max: 23, ph: "4242 4242 4242 4242", ac: "cc-number" })}
      ${this.inp("name", "Nombre en la tarjeta", { ph: "Como aparece en la tarjeta", ac: "cc-name" })}
      <div class="co-row">
        ${this.inp("exp", "Vence (MM/AA)", { inputmode: "numeric", max: 5, ph: "08/29", ac: "cc-exp" })}
        ${this.inp("cvv", "CVV", { inputmode: "numeric", max: 4, ph: "123", ac: "cc-csc" })}
      </div>
      <p class="co-test">Modo demostración — no se cobra dinero real. Prueba: <code>4242 4242 4242 4242</code> (aprobada) · terminada en <code>0002</code> (rechazada).</p>`;
    if (this.method === "pse") return `
      <div class="co-field"><label class="field-label" for="co-bank">Tu banco</label>
        <select id="co-bank" class="input ${this.fields.bank ? "is-invalid" : ""}" data-input="checkout:pay" data-key="bank" ${this.fields.bank ? `aria-invalid="true"` : ""}>
          <option value="">Selecciona…</option>${this.BANKS.map((b) => `<option ${this.pay.bank === b ? "selected" : ""}>${esc(b)}</option>`).join("")}
        </select>${this.err("bank")}</div>
      <p class="co-test">Modo demostración: no te llevamos a un banco real; el pago se aprueba al instante.</p>`;
    return `
      ${this.inp("phone", "Celular Nequi", { inputmode: "numeric", max: 10, ph: "3001234567", ac: "tel" })}
      <p class="co-test">Modo demostración. Un celular terminado en <code>0000</code> simula un pago rechazado.</p>`;
  },

  summary(q, ev) {
    const row = (l, v, cls = "") => `<div class="co-line ${cls}"><span>${l}</span><strong>${v}</strong></div>`;
    return `
      <div class="co-summary" id="co-summary" aria-live="polite">
        <div class="co-sum-title">Resumen · <span class="co-fx">P(x) = B·x·C − D(p)</span></div>
        ${row(`Precio base B`, cop(q.unitPrice))}
        ${row(`Entradas x`, q.quantity)}
        ${row(`Zona C (${esc(this.zoneLabel(q.zone))})`, `× ${String(q.coefficient).replace(".", ",")}`)}
        ${row(`Subtotal B·x·C`, cop(q.subtotal))}
        ${q.loyaltyDiscount ? row(`Puntos (−${q.pointsUsed} pts)`, `− ${cop(q.loyaltyDiscount)}`, "is-disc") : ""}
        ${q.welcomeDiscount ? row(`Oferta de nuevo ingreso`, `− ${cop(q.welcomeDiscount)}`, "is-disc") : ""}
        ${row(`Total a pagar`, q.total > 0 ? cop(q.total) : "Gratis", "is-total")}
        ${q.pointsEarned > 0 ? `<p class="co-earn">${icon("star", 14, { width: 2 })} Ganarás <strong>${q.pointsEarned} puntos</strong> con esta compra.</p>` : ""}
      </div>`;
  },

  zoneLabel(code) { const z = this.quote && this.quote.zones.find((x) => x.code === code); return z ? z.label : code; },

  formBody() {
    const d = this.quote, q = d.quote, ev = d.event, max = d.limits.maxQuantity;
    const free = ev.unitPriceCop === 0;
    const dyn = ev.unitPriceCop > ev.basePriceCop && ev.basePriceCop > 0;
    return `
      <div class="co-block">
        <div class="co-blockhead"><h5>Entradas</h5><span class="co-hint">Máx. ${max} por compra · quedan ${ev.spotsLeft} cupos</span></div>
        <div class="co-stepper" role="group" aria-label="Cantidad de entradas">
          <button type="button" class="co-step" data-click="checkout:qty" data-delta="-1" ${this.quantity <= 1 ? "disabled" : ""} aria-label="Una entrada menos">${icon("minus", 18, { width: 2.6 })}</button>
          <output class="co-qty" aria-live="polite">${this.quantity}</output>
          <button type="button" class="co-step" data-click="checkout:qty" data-delta="1" ${this.quantity >= max ? "disabled" : ""} aria-label="Una entrada más">${icon("plus", 18, { width: 2.6 })}</button>
        </div>
        ${ev.salesState === "ultimos_cupos" ? `<p class="co-note is-warn">${icon("zap", 14, { width: 2 })} ¡Últimos cupos! Asegura los tuyos.</p>` : ""}
        ${dyn ? `<p class="co-note">${icon("trending", 14, { width: 2 })} Precio ajustado por alta demanda (base ${cop(ev.basePriceCop)}).</p>` : ""}
      </div>
      ${free ? "" : `
      <div class="co-block">
        <div class="co-blockhead"><h5>Zona</h5><span class="co-hint">Cambia el valor por el coeficiente C</span></div>
        <div class="co-zones" role="radiogroup" aria-label="Zona">
          ${d.zones.map((z) => `
            <button type="button" role="radio" aria-checked="${z.code === this.zone}" class="co-zone ${z.code === this.zone ? "is-on" : ""}" data-click="checkout:zone" data-zone="${esc(z.code)}">
              <span class="co-zone-name">${esc(z.label)}</span>
              <span class="co-zone-price">${cop(z.unitPriceCop)}</span>
              <span class="co-zone-c">C = ${String(z.coefficient).replace(".", ",")}</span>
            </button>`).join("")}
        </div>
      </div>`}
      ${d.user.isNewMember && !free ? `<div class="co-promo">${icon("gift", 18, { width: 2 })}<span><strong>¡Bienvenido a EventPro!</strong> Tu primera compra tiene oferta de nuevo ingreso.</span></div>` : ""}
      ${d.user.pointsBalance > 0 && !free ? `
        <label class="co-points"><input type="checkbox" data-click="checkout:points" ${this.usePoints ? "checked" : ""}>
          <span>${icon("star", 16, { width: 2 })} Usar mis puntos <em>(${d.user.pointsBalance} pts disponibles)</em></span></label>` : ""}
      ${this.summary(q, ev)}
      ${q.total > 0 ? `
      <div class="co-block">
        <div class="co-blockhead"><h5>Método de pago</h5><span class="co-hint">${icon("lock", 12, { width: 2.2 })} Simulado</span></div>
        <div class="co-methods" role="tablist" aria-label="Método de pago">
          ${this.METHODS.map(([k, label, ic]) => `
            <button type="button" role="tab" aria-selected="${k === this.method}" class="co-method ${k === this.method ? "is-on" : ""}" data-click="checkout:method" data-method="${k}">${icon(ic, 17, { width: 2 })}<span>${label}</span></button>`).join("")}
        </div>
        <div class="co-methodbody">${this.methodFields()}</div>
      </div>` : `<p class="co-note">${icon("check", 14, { width: 2.4 })} No hay nada que pagar: solo confirma tu inscripción.</p>`}
      ${this.message ? `<div class="auth-error" role="alert">${esc(this.message)}</div>` : ""}`;
  },

  receiptBody() {
    const r = this.receipt;
    const how = r.method === "gratis" ? "Sin cobro" : r.method === "tarjeta" ? `${esc(r.brand)} •••• ${esc(r.last4)}` : r.method === "nequi" ? `Nequi •••• ${esc(r.last4)}` : `PSE · ${esc(r.brand)}`;
    return `
      <div class="evm-done">
        <span class="evm-done-ic">${icon("check", 26, { color: "#fff", width: 3 })}</span>
        <h4>¡Pago exitoso e inscripción confirmada!</h4>
        <p>${r.quantity > 1 ? `Tienes ${r.quantity} cupos` : "Tienes tu cupo"} en <strong>${esc(r.eventName)}</strong>.</p>
      </div>
      <div class="co-receipt">
        <div class="co-line"><span>Recibo</span><strong class="co-code">${esc(r.code)}</strong></div>
        <div class="co-line"><span>Entradas · zona</span><strong>${r.quantity} · ${esc(this.zoneLabel(r.zone) || r.zone)}</strong></div>
        <div class="co-line"><span>Medio de pago</span><strong>${how}</strong></div>
        <div class="co-line is-total"><span>Total pagado</span><strong>${r.totalCop > 0 ? cop(r.totalCop) : "Gratis"}</strong></div>
        <p class="co-formula">${esc(r.formula)}</p>
        <p class="co-earn">${icon("star", 14, { width: 2 })} +${r.pointsEarned} puntos · saldo ${r.pointsBalance} pts</p>
      </div>`;
  },

  render() {
    if (!this.isOpen) return "";
    const ev = this.event;
    if (!ev) { this.reset(); return ""; }
    const busy = this.phase === "processing";
    let body, actions = "";
    if (this.phase === "loading") body = `<div class="co-loading"><span class="co-spin" aria-hidden="true"></span><p>Preparando tu pago…</p></div>`;
    else if (this.phase === "queue") body = VirtualQueue.render(this.queue);
    else if (this.phase === "error") {
      body = `<div class="auth-error" role="alert">${esc(this.message || "No pudimos preparar el pago.")}</div>`;
      actions = `<button type="button" class="btn btn-outline btn-block" data-click="checkout:back">Volver al evento</button>
                 <button type="button" class="btn btn-primary btn-block" data-click="checkout:retry">Reintentar</button>`;
    } else if (this.phase === "done") {
      body = this.receiptBody();
      actions = `<button type="button" class="btn btn-outline btn-block" data-click="checkout:close">Seguir explorando</button>
                 <button type="button" class="btn btn-primary btn-block" data-click="checkout:goInscripciones">Ver mis inscripciones</button>`;
    } else {
      body = this.formBody();
      const total = this.quote.quote.total;
      actions = `<button type="button" class="btn btn-outline btn-block" data-click="checkout:back" ${busy ? "disabled" : ""}>Volver</button>
                 <button type="submit" class="btn btn-primary btn-block co-pay" ${busy ? "disabled" : ""}>${busy ? `<span class="co-spin co-spin-sm" aria-hidden="true"></span> Procesando…` : total > 0 ? `Pagar ${cop(total)}` : "Confirmar inscripción"}</button>`;
    }
    // el formulario envuelve cuerpo+acciones solo cuando hay datos que enviar
    const inner = (this.phase === "form" || busy)
      ? `<form data-submit="checkout:submit" novalidate>${body}<div class="modal-actions evm-actions">${actions}</div></form>`
      : `${body}${actions ? `<div class="modal-actions evm-actions">${actions}</div>` : ""}`;

    return `
      <div class="modal-backdrop evm-backdrop" data-click="checkout:close" data-backdrop>
        <div class="modal evm co" role="dialog" aria-modal="true" aria-labelledby="co-title" tabindex="-1" aria-busy="${busy}">
          <div class="co-head">
            <div><div class="eyebrow">Checkout</div><h3 id="co-title">${esc(ev.name)}</h3></div>
            <button type="button" class="evm-x co-x" data-click="checkout:close" aria-label="Cerrar" ${busy ? "disabled" : ""}>${icon("x", 18, { width: 2.4 })}</button>
          </div>
          <div class="evm-body">${inner}</div>
        </div>
      </div>`;
  },

  afterRender() {
    if (!this.isOpen || this._focus) return;
    const dlg = document.querySelector(".co");
    if (dlg) { dlg.focus({ preventScroll: true }); this._focus = true; }
  },
};

/* ---------- formato de los campos sin volver a dibujar (el cursor no salta) ---------- */
const CO_FORMAT = {
  number: (v) => v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim(),
  exp: (v) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; },
  cvv: (v) => v.replace(/\D/g, "").slice(0, 4),
  phone: (v) => v.replace(/\D/g, "").slice(0, 10),
  name: (v) => v.slice(0, 40),
  bank: (v) => v,
};
registerInput({
  "checkout:pay": (el) => {
    const k = el.dataset.key, fmt = CO_FORMAT[k] || ((v) => v);
    const v = fmt(el.value);
    if (v !== el.value) el.value = v;
    CheckoutModal.pay[k] = v;
    if (CheckoutModal.fields[k]) {                        // al corregir, se quita el error de ese campo
      delete CheckoutModal.fields[k];
      el.classList.remove("is-invalid"); el.removeAttribute("aria-invalid");
      const p = el.parentElement.querySelector(".co-err"); if (p) p.remove();
    }
  },
});
registerClick({
  "checkout:close":  () => { if (CheckoutModal.phase !== "processing") CheckoutModal.close(); },
  "checkout:back":   () => CheckoutModal.back(),
  "checkout:retry":  () => { CheckoutModal.phase = "loading"; rerender(); CheckoutModal.loadQuote(); },
  "checkout:leave":  () => CheckoutModal.leave(),
  "checkout:qty":    (el) => CheckoutModal.setQuantity(CheckoutModal.quantity + Number(el.dataset.delta)),
  "checkout:zone":   (el) => { CheckoutModal.zone = el.dataset.zone; CheckoutModal.schedule(); rerender(); },
  "checkout:points": (el) => { CheckoutModal.usePoints = !!el.checked; CheckoutModal.schedule(); },
  "checkout:method": (el) => { CheckoutModal.method = el.dataset.method; CheckoutModal.fields = {}; CheckoutModal.message = ""; rerender(); },
  "checkout:goInscripciones": () => { CheckoutModal.reset(); UserApp.view = "inscripciones"; App.render({ resetScroll: true }); },
});
registerSubmit({ "checkout:submit": () => CheckoutModal.submit() });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && CheckoutModal.isOpen && CheckoutModal.phase !== "processing") CheckoutModal.close(); });
