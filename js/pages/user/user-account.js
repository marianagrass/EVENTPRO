/* ==========================================================
   pages/user/user-account.js — «Mi cuenta / Panel general»
   Se abre desde el avatar del Navbar. Pestañas:
     Panel general · Mis inscripciones · Historial · Perfil y configuración · Asistente
   Siempre tiene un botón claro para volver a explorar el Home.
   Se dibuja con PublicLayout (mismo Navbar que el Home), con header sólido.
   ========================================================== */
const ACCOUNT_TABS = [
  { id: "panel",         label: "Panel general",          icon: "home" },
  { id: "inscripciones", label: "Mis inscripciones",      icon: "ticket" },
  { id: "historial",     label: "Historial",              icon: "history" },
  { id: "perfil",        label: "Perfil y configuración", icon: "settings" },
  { id: "asistente",     label: "Asistente",              icon: "chat" },
];

const AccountPage = {
  saved: false,          // aviso «Cambios guardados»
  savedTimer: null,
  formError: "",

  /* ----- piezas ----- */
  dateBadge(ev, size = 56) {
    const d = parseDate(ev.date);
    return `
      <div class="date-badge" style="width:${size}px;height:${size}px;border-radius:14px;background:${TYPE_STYLE[ev.type].gradient}">
        <span class="date-badge-day" style="font-weight:800">${String(d.getDate()).padStart(2, "0")}</span>
        <span class="date-badge-month">${d.toLocaleString("es-CO", { month: "short" })}</span>
      </div>`;
  },

  registrationRow(ev) {
    const d = parseDate(ev.date);
    const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
    const soon = daysLeft <= 7 && daysLeft >= 0;
    return `
      <div class="card acct-row">
        ${this.dateBadge(ev)}
        <div class="acct-row-main">
          <div class="acct-chips">
            <span class="chip acct-type" style="--c:${TYPE_COLOR[ev.type]}">${esc(TYPE_LABEL[ev.type])}</span>
            <span class="chip acct-price">${esc(priceLabel(ev))}</span>
            ${soon ? `<span class="chip acct-soon">${daysLeft === 0 ? "Hoy" : `En ${daysLeft} día${daysLeft !== 1 ? "s" : ""}`}</span>` : ""}
          </div>
          <div class="acct-row-title">${esc(ev.name)}</div>
          <div class="acct-row-meta">
            <span>${icon("clock", 14)} ${esc(ev.time)}</span>
            <span>${icon("pin", 14)} ${esc(ev.location)}</span>
          </div>
        </div>
        <div class="acct-row-actions">
          <button class="btn btn-outline btn-sm" data-click="event:details" data-id="${ev.id}">Ver detalles</button>
          <button class="btn btn-danger btn-sm" data-click="user:unregister" data-id="${ev.id}">Cancelar</button>
        </div>
      </div>`;
  },

  emptyState(title, text) {
    return `
      <div class="card acct-empty">
        <div class="empty-icon">${icon("calendar", 26, { color: "var(--lilac)", width: 1.5 })}</div>
        <h3>${title}</h3>
        <p>${text}</p>
        <button class="btn btn-primary" data-click="user:home">Explorar eventos</button>
      </div>`;
  },

  /* ----- pestañas ----- */
  tabPanel() {
    const up = UserApp.upcoming(), past = UserApp.past();
    const next = up[0];
    const nextDays = next ? Math.max(0, Math.ceil((parseDate(next.date).getTime() - Date.now()) / 86400000)) : null;
    const stats = [
      { label: "Inscripciones activas", value: up.length,   icon: "ticket",        color: "var(--primary-fg)" },
      { label: "Eventos a los que fuiste", value: past.length, icon: "history",    color: "var(--text)" },
      { label: next ? "Días para tu próximo evento" : "Próximo evento", value: next ? nextDays : "—", icon: "calendar-days", color: "var(--muted)" },
    ].map(StatCard).join("");

    return `
      <div class="grid-3 acct-stats">${stats}</div>

      <div class="acct-split">
        <div>
          <div class="section-head">
            <h2>Mis próximos eventos</h2>
            ${up.length ? `<button class="btn btn-light" style="font-weight:600" data-click="nav:user" data-view="inscripciones">Ver todos</button>` : ""}
          </div>
          ${up.length ? `<div class="col-stack" style="gap:12px">${up.slice(0, 3).map((e) => this.registrationRow(e)).join("")}</div>`
                      : this.emptyState("Aún no tienes inscripciones activas", "Explora los eventos del campus y reserva tu cupo.")}
        </div>

        <aside class="col-stack" style="gap:16px">
          <div class="card acct-explore">
            <h3>¿Buscas más planes?</h3>
            <p>Hay fiestas, conciertos y torneos esperándote en el Home.</p>
            <button class="btn btn-accent" data-click="user:home">Explorar eventos ${icon("right", 16, { width: 2.8 })}</button>
          </div>
          <div class="card acct-mini">
            <div class="acct-mini-head"><span class="g-avatar g-avatar-lg">${esc(initials(Session.user.name))}</span>
              <div><strong>${esc(Session.user.name)}</strong><small>${esc(UserApp.profile.correo)}</small></div></div>
            <button class="btn btn-outline btn-block" data-click="nav:user" data-view="perfil">${icon("settings", 16)} Editar perfil</button>
          </div>
        </aside>
      </div>`;
  },

  tabInscripciones() {
    const up = UserApp.upcoming();
    return up.length
      ? `<div class="col-stack" style="gap:12px">${up.map((e) => this.registrationRow(e)).join("")}</div>`
      : this.emptyState("Aún no te has inscrito a ningún evento", "Explora el catálogo y encuentra algo que te interese.");
  },

  tabHistorial() {
    const past = UserApp.past();
    if (!past.length) return this.emptyState("Todavía no tienes historial", "Cuando termine un evento en el que estés inscrito, aparecerá aquí.");
    const rows = past.map((ev) => {
      const att = Data.attendees.find((a) => a.id === `au-${ev.id}`);
      const went = !!(att && att.checkedInAt);
      return `
        <div class="card acct-row is-past">
          ${this.dateBadge(ev, 52)}
          <div class="acct-row-main">
            <div class="acct-row-title">${esc(ev.name)}</div>
            <div class="acct-row-meta"><span>${icon("pin", 14)} ${esc(ev.location)}</span><span>${icon("calendar", 14)} ${parseDate(ev.date).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}</span></div>
          </div>
          <span class="badge ${went ? "st-confirmado" : "st-completado"}">${went ? "Asististe" : "Completado"}</span>
        </div>`;
    }).join("");
    return `<div class="col-stack" style="gap:10px">${rows}</div>`;
  },

  tabPerfil() {
    const p = UserApp.profile;
    const f = (label, key, type = "text") => `
      <div><label class="field-label field-label-sm">${label}</label>
        <input class="input" type="${type}" value="${esc(p[key])}" data-input="account:field" data-key="${key}"></div>`;
    const fullName = `${p.nombre} ${p.apellido}`.trim();
    return `
      <div class="acct-profile">
        <div class="card" style="padding:28px">
          <div class="row" style="gap:20px;margin-bottom:28px">
            <span class="g-avatar" style="width:72px;height:72px;font-size:24px">${esc(initials(fullName || "U"))}</span>
            <div>
              <div style="font-family:var(--font-title);font-size:22px;font-weight:700">${esc(fullName)}</div>
              <div style="font-size:14px;color:var(--muted);margin-top:4px">${esc(p.correo)}</div>
              <span class="badge acct-role">Usuario</span>
            </div>
          </div>
          <div class="form-grid-2" style="gap:16px;margin-bottom:20px">
            ${f("Nombre", "nombre")}${f("Apellido", "apellido")}${f("Correo", "correo", "email")}
            ${f("Teléfono", "telefono", "tel")}${f("Ciudad", "ciudad")}${f("Institución", "institucion")}
          </div>
          ${this.formError ? `<div class="auth-error" role="alert" style="text-align:left">${esc(this.formError)}</div>` : ""}
          ${this.saved ? `<div class="acct-saved" role="status">${icon("check", 16, { width: 3 })} Cambios guardados</div>` : ""}
          <button class="btn btn-primary" style="padding:10px 24px" data-click="account:save">Guardar cambios</button>
        </div>

        <div class="col-stack" style="gap:20px">
          <div class="card" style="padding:24px">
            <h3 class="card-title" style="margin-bottom:6px">Apariencia</h3>
            <p style="font-size:13px;color:var(--muted);margin-bottom:16px">Elige entre modo claro y oscuro.</p>
            <div class="theme-row" style="margin:0"><span>Modo oscuro</span>${ThemeToggle.render()}</div>
          </div>
          <div class="card" style="padding:24px">
            <h3 class="card-title" style="margin-bottom:16px">Cambiar contraseña</h3>
            <div class="form-stack" style="gap:12px;margin-bottom:16px">
              <div><label class="field-label field-label-sm">Contraseña actual</label><input class="input" type="password" value="••••••••"></div>
              <div><label class="field-label field-label-sm">Nueva contraseña</label><input class="input" type="password" placeholder="Mínimo 8 caracteres"></div>
            </div>
            <button class="btn btn-outline">Actualizar contraseña</button>
          </div>
        </div>
      </div>`;
  },

  /* ----- vista ----- */
  render() {
    const tab = ACCOUNT_TABS.find((t) => t.id === UserApp.view) || ACCOUNT_TABS[0];
    const tabs = ACCOUNT_TABS.map((t) => {
      const count = t.id === "inscripciones" ? UserApp.upcoming().length : 0;
      return `
        <button type="button" role="tab" class="acct-tab ${t.id === tab.id ? "is-active" : ""}" aria-selected="${t.id === tab.id}"
                data-click="nav:user" data-view="${t.id}">
          ${icon(t.icon, 17, { width: 2 })}<span>${t.label}</span>${count ? `<b class="acct-count">${count}</b>` : ""}
        </button>`;
    }).join("");

    const bodies = {
      panel: () => this.tabPanel(), inscripciones: () => this.tabInscripciones(), historial: () => this.tabHistorial(),
      perfil: () => this.tabPerfil(), asistente: () => `<div class="acct-chat">${AgentPage.render()}</div>`,
    };

    const content = `
      <section class="acct" aria-label="Mi cuenta">
        <div class="acct-head">
          <div>
            <div class="eyebrow">Mi cuenta</div>
            <h1 class="page-title">Hola, ${esc(Session.firstName)}</h1>
            <p class="page-subtitle">Administra tus inscripciones, tu historial y tus datos.</p>
          </div>
          <button class="btn btn-primary btn-xl" data-click="user:home">${icon("left", 18, { width: 2.6 })} Volver a explorar eventos</button>
        </div>
        <div class="acct-tabs scroll-x" role="tablist" aria-label="Secciones de mi cuenta">${tabs}</div>
        <div class="acct-body" role="tabpanel">${bodies[tab.id]()}</div>
      </section>`;
    return PublicLayout.render(content, { overHero: false });
  },

  afterRender() {
    if (UserApp.view === "asistente") AgentPage.afterRender();
  },
};

registerInput({
  // Escribir no redibuja: solo guarda el valor en el borrador del perfil
  "account:field": (el) => { UserApp.profile[el.dataset.key] = el.value; AccountPage.saved = false; },
});

registerClick({
  "account:save": () => {
    const p = UserApp.profile;
    if (!p.nombre.trim()) { AccountPage.formError = "Escribe tu nombre."; AccountPage.saved = false; rerender(); return; }
    if (!/^\S+@\S+\.\S+$/.test(p.correo.trim())) { AccountPage.formError = "Escribe un correo válido."; AccountPage.saved = false; rerender(); return; }
    AccountPage.formError = "";
    Session.user.name = `${p.nombre.trim()} ${p.apellido.trim()}`.trim();
    const acc = Data.accounts.find((a) => a.id === Session.user.id);
    if (acc) { acc.name = Session.user.name; acc.email = p.correo.trim(); }
    AccountPage.saved = true;
    rerender();
    clearTimeout(AccountPage.savedTimer);
    AccountPage.savedTimer = setTimeout(() => { AccountPage.saved = false; if (UserApp.view === "perfil") rerender(); }, 3000);
  },
});
