/* ==========================================================
   components/auth/auth-modal.js — AuthModal: contenedor que alterna Login / Registro / Recuperar
   Lo dibuja PublicLayout encima del Home (igual que EventModal). Diseño dividido: foto de fiesta
   universitaria + formulario; en móvil la foto se reduce a una cabecera.

   Estado propio (independiente de la sesión y del modal de evento):
     view      "login" | "register" | "forgot"
     pending   { eventId } si el visitante venía de «Inscribirse» / «Ver detalles»
     values    lo escrito en los campos (se conserva al cambiar de vista, salvo contraseñas)
     errors    mensajes por campo   ·   formError  aviso general   ·   busy  petición en curso

   Los tres onSubmit (onLogin, onRegister, onForgot) siguen el mismo patrón:
     1. validar en el cliente → si hay errores, mostrarlos y detenerse
     2. busy = true (botón con spinner)
     3. await Session.login / Session.register / AuthApi.forgot  ← AQUÍ se hace la petición HTTP
     4. éxito → AuthFlow.enter(user, pending)   ·   error → handleError(err)
   ========================================================== */

const AuthModal = {
  isOpen: false,
  view: "login",
  pending: null,
  reason: null,
  values: { identificacion: "", name: "", email: "", password: "", confirm: "", cityId: "", address: "", phone: "" },
  errors: {},
  formError: "",
  notice: "",
  busy: false,
  dirty: false,
  _focus: null,                    // a dónde llevar el foco tras dibujar: "first" | "invalid" | "password" | "alert"

  blank() { return { identificacion: "", name: "", email: "", password: "", confirm: "", cityId: "", address: "", phone: "" }; },

  /** Deja el modal cerrado y limpio, sin volver a dibujar (login, logout) */
  reset() {
    Object.assign(this, { isOpen: false, view: "login", pending: null, reason: null, values: this.blank(),
      errors: {}, formError: "", notice: "", busy: false, dirty: false, _focus: null });
  },

  /* ----- abrir / cerrar / cambiar de vista ----- */
  open({ view = "login", pending = null, reason = null } = {}) {
    this.reset();
    Object.assign(this, { isOpen: true, view, pending, reason, _focus: "first" });
    rerender();
  },

  close() {
    if (this.busy) return;                                   // no cerrar a mitad de una petición
    this.reset();
    rerender();
  },

  /** Clic en el fondo: solo cierra si el usuario aún no escribió nada (evita perder datos) */
  backdropClose() { if (!this.dirty) this.close(); },

  switchView(view) {
    if (this.busy) return;
    Object.assign(this, { view, errors: {}, formError: "", notice: "", _focus: "first" });
    this.values.password = ""; this.values.confirm = "";     // las contraseñas nunca viajan entre vistas
    rerender();
  },

  /* ----- onSubmit: un punto de entrada y tres manejadores ----- */
  submit() {
    if (this.busy) return;
    if (this.view === "login") return this.onLogin();
    if (this.view === "register") return this.onRegister();
    return this.onForgot();
  },

  async onLogin() {
    const { email, password } = this.values;
    const errors = AuthValidators.login({ email, password });
    if (Object.keys(errors).length) return this.fail(errors);

    this.setBusy(true);
    try {
      const user = await Session.login({ email, password });          // → POST /api/auth/login  { email, password }
      this.succeed(user);
    } catch (err) {
      this.handleError(err, { clearPassword: err.status === 401 });
    }
  },

  async onRegister() {
    const errors = AuthValidators.register(this.values);
    if (Object.keys(errors).length) return this.fail(errors);

    this.setBusy(true);
    try {
      const user = await Session.register(this.values);              // el rol NO se envía: el servidor crea siempre un CLIENTE
                                                                      // → POST /api/personas  { identificacion, name, email, password, cityId, address, phone }
      this.succeed(user);
    } catch (err) {
      this.handleError(err);
    }
  },

  async onForgot() {
    const e = AuthValidators.email(this.values.email);
    if (e) return this.fail({ email: e });

    this.setBusy(true);
    try {
      const res = await AuthApi.forgot(this.values.email.trim());      // → POST /api/auth/forgot-password  { email }
      this.busy = false;
      this.notice = (res && res.message) || "Si ese correo está registrado, te enviamos instrucciones.";
      this.errors = {}; this.formError = "";
      rerender();
    } catch (err) {
      this.handleError(err);
    }
  },

  /* ----- resultados ----- */
  succeed(user) {
    const pending = this.pending;
    this.reset();                                                     // cierra y borra contraseñas de la memoria
    AuthFlow.enter(user, pending);                                    // redirige según el rol (y reabre el evento si venía de uno)
  },

  fail(errors) {
    this.errors = errors; this.formError = ""; this._focus = "invalid";
    rerender();
  },

  /** Convierte un AuthError del backend en mensajes de la interfaz */
  handleError(err, { clearPassword = false } = {}) {
    this.busy = false;
    const fields = err && err.fields ? { ...err.fields } : {};
    const hasFields = Object.keys(fields).length > 0;
    this.errors = fields;
    // Con errores por campo (409/422) el mensaje ya está bajo cada campo; si no, aviso general
    this.formError = hasFields ? "" : (err && err.message) || "No se pudo completar la solicitud.";
    if (clearPassword) { this.values.password = ""; this.values.confirm = ""; }
    this._focus = hasFields ? "invalid" : (clearPassword ? "password" : "alert");
    rerender();
  },

  /** Estado "cargando" sin volver a dibujar (el foco y el texto escrito no se pierden) */
  setBusy(b) {
    this.busy = b;
    const form = document.querySelector(".auth form.af");
    if (!form) return;
    form.setAttribute("aria-busy", String(b));
    form.querySelectorAll("input").forEach((i) => { i.readOnly = b; });
    form.querySelectorAll("button").forEach((btn) => { btn.disabled = b; });
    const sub = form.querySelector(".af-submit");
    if (sub && b) sub.innerHTML = `<span class="af-spin" aria-hidden="true"></span>${esc(sub.dataset.busy || "Cargando…")}`;
  },

  /* ----- edición de campos (sin redibujar) ----- */
  onField(el) {
    const key = el.dataset.key;
    this.values[key] = el.value;
    this.dirty = true;
    if (this.errors[key]) {                                           // quita el error de ese campo al corregirlo
      delete this.errors[key];
      const ctl = el.closest(".af-control"); if (ctl) ctl.classList.remove("is-invalid");
      el.setAttribute("aria-invalid", "false"); el.removeAttribute("aria-describedby");
      const msg = document.getElementById(`${el.id}-err`); if (msg) msg.remove();
    }
    if (key === "password" && this.view === "register") this.updateMeter();
  },

  updateMeter() {
    const box = document.getElementById("af-meter"); if (!box) return;
    const lvl = AuthValidators.strength(this.values.password);
    box.dataset.level = String(lvl);
    const labels = ["", "Débil", "Aceptable", "Buena", "Fuerte"];
    const lab = document.getElementById("af-meter-label");
    if (lab) lab.textContent = this.values.password ? `Seguridad: ${labels[lvl] || "Débil"}` : "";
  },

  togglePassword(btn) {
    const input = document.getElementById(btn.dataset.target); if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.setAttribute("aria-pressed", String(show));
    btn.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
    btn.innerHTML = icon(show ? "eyeoff" : "eye", 18, { width: 1.8 });
    input.focus();
  },

  /* ----- vista ----- */
  copy() {
    return {
      login:    { title: "Iniciar sesión",          sub: "Ingresa con tu correo y contraseña.",
                  aside: "Qué bueno verte de nuevo", asideText: "Entra y sigue con tu agenda de fiestas, conciertos y torneos del campus." },
      register: { title: "Crear cuenta",             sub: "Únete gratis y reserva tu cupo en segundos.",
                  aside: "Únete a la fiesta",        asideText: "Crea tu cuenta y no te pierdas ningún plan universitario." },
      forgot:   { title: "Recupera tu contraseña",  sub: "Escribe tu correo y te enviaremos las instrucciones.",
                  aside: "Te ayudamos a volver",     asideText: "En un minuto estarás de regreso en la pista." },
    }[this.view];
  },

  demoBox() {
    if (!AuthConfig.USE_MOCK || this.view !== "login") return "";
    const rows = MOCK_CREDENTIALS.map((c) => `<tr><td>${esc(c.role === "agent" ? "Agente" : c.role === "admin" ? "Administrador" : "Usuario")}</td><td><code>${esc(c.email)}</code></td><td><code>${esc(c.password)}</code></td></tr>`).join("");
    return `
      <details class="af-demo">
        <summary>Modo demo · cuentas de prueba</summary>
        <table><thead><tr><th>Rol</th><th>Correo</th><th>Clave</th></tr></thead><tbody>${rows}</tbody></table>
        <p>Cualquier cuenta de Admin → Gestión de cuentas también entra con <code>${esc(MOCK_DEFAULT_PASSWORD)}</code>. Este recuadro desaparece con <code>USE_MOCK = false</code>.</p>
      </details>`;
  },

  render() {
    if (!this.isOpen) return "";
    const c = this.copy();
    const ev = this.pending && Data.events.find((e) => e.id === this.pending.eventId);
    const state = { values: this.values, errors: this.errors, formError: this.formError, notice: this.notice, busy: this.busy };
    const form = this.view === "register" ? RegisterForm.render(state) : this.view === "forgot" ? ForgotForm.render(state) : LoginForm.render(state);
    const perks = ["Inscripción en segundos", "Cupos y precios al instante", "Tu historial en un solo lugar"]
      .map((p) => `<li>${icon("check", 16, { width: 3 })}<span>${p}</span></li>`).join("");

    return `
      <div class="modal-backdrop auth-backdrop" data-click="auth:backdrop" data-backdrop>
        <div class="auth" role="dialog" aria-modal="true" aria-labelledby="auth-title" tabindex="-1">
          <aside class="auth-aside">
            <img class="auth-aside-img" src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1100&q=80" alt="" onerror="this.remove()">
            <div class="auth-brand"><div class="brand-logo"><span>E</span></div><div class="brand-name">EventPro</div></div>
            <div class="auth-aside-body">
              <h2>${c.aside}</h2>
              <p>${c.asideText}</p>
              <ul class="auth-perks">${perks}</ul>
            </div>
          </aside>
          <section class="auth-main">
            <button type="button" class="auth-x" data-click="auth:close" aria-label="Cerrar">${icon("x", 18, { width: 2.4 })}</button>
            <h3 class="auth-title" id="auth-title">${c.title}</h3>
            <p class="auth-sub">${esc(this.reason || c.sub)}</p>
            ${ev ? `<div class="auth-event">${icon("ticket", 16, { width: 2 })}<span>Para inscribirte en <b>${esc(ev.name)}</b></span></div>` : ""}
            ${form}
            ${this.demoBox()}
          </section>
        </div>
      </div>`;
  },

  /** Lleva el foco al lugar correcto tras dibujar (teclado y lectores de pantalla) */
  afterRender() {
    if (!this.isOpen || !this._focus) return;
    const dlg = document.querySelector(".auth"); if (!dlg) return;
    const target = {
      first: () => dlg.querySelector("input"),
      invalid: () => dlg.querySelector('[aria-invalid="true"]'),
      password: () => dlg.querySelector("#af-password"),
      alert: () => dlg.querySelector("#af-form-error"),
    }[this._focus];
    const el = (target && target()) || dlg;
    el.focus({ preventScroll: true });
    this._focus = null;
  },
};

registerClick({
  "auth:open":     (el) => AuthModal.open({ view: el.dataset.view || "login", reason: el.dataset.reason || null }),
  "auth:close":    () => AuthModal.close(),
  "auth:backdrop": () => AuthModal.backdropClose(),
  "auth:switch":   (el) => AuthModal.switchView(el.dataset.view),
  "auth:togglePw": (el) => AuthModal.togglePassword(el),
});
registerInput({ "auth:field": (el) => AuthModal.onField(el) });
registerSubmit({ "auth:submit": () => AuthModal.submit() });

document.addEventListener("keydown", (e) => {
  if (!AuthModal.isOpen) return;
  if (e.key === "Escape") { AuthModal.close(); return; }
  if (e.key !== "Tab") return;                                        // atrapa el foco dentro del diálogo
  const dlg = document.querySelector(".auth"); if (!dlg) return;
  const items = [...dlg.querySelectorAll('button, input, summary, a[href], [tabindex]:not([tabindex="-1"])')].filter((n) => !n.disabled && n.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === dlg)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
