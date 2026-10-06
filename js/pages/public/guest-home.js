/* ==========================================================
   pages/public/guest-home.js — Home público (visitantes sin sesión)
   "Inscribirse" y "Ver detalles" llevan data-requires-auth: el guard
   global (utils.js) los intercepta y abre el modal de login.
   ========================================================== */
const GuestHome = {
  events() {
    return Data.events
      .filter((e) => e.is_public !== false && !["completado", "cancelado"].includes(e.status))
      .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a.date.localeCompare(b.date));
  },

  card(ev) {
    const tc = TYPE_STYLE[ev.type], d = parseDate(ev.date);
    const spots = UserApp.getSpots(ev.id), full = spots <= 0;
    return `
      <article class="card card-hover g-card">
        <div class="g-img" style="background-image:url('${esc(ev.image)}')">
          <span class="img-badge img-badge-lg" style="background:${tc.gradient};color:#e5d7c4">${TYPE_LABEL[ev.type]}</span>
          ${ev.featured ? `<span class="g-star">★ Destacado</span>` : ""}
        </div>
        <div class="g-body">
          <h3 class="g-title">${esc(ev.name)}</h3>
          <div class="g-meta">${d.toLocaleDateString("es-CO", { day: "numeric", month: "long" })} · ${esc(ev.time)}</div>
          <div class="g-meta">${esc(ev.location)}</div>
          <div class="row" style="gap:8px;margin:12px 0 14px">
            <div class="bar bar-thin" style="flex:1"><div class="bar-fill" style="width:${percent(ev.registered, ev.capacity)}%;background:${tc.gradient}"></div></div>
            <span class="dash-count">${full ? "Agotado" : spots + " cupos"}</span>
          </div>
          <div class="row" style="gap:8px">
            <button class="btn btn-outline" style="flex:1" data-requires-auth data-click="guest:details" data-id="${ev.id}">Ver detalles</button>
            <button class="cta-btn" style="flex:1;background:${tc.gradient}" data-requires-auth data-click="guest:register" data-id="${ev.id}">Inscribirse</button>
          </div>
        </div>
      </article>`;
  },

  render() {
    const stats = LANDING_STATS.map((s) => `<div><div class="g-stat-v">${s.value}</div><div class="g-stat-l">${s.label}</div></div>`).join("");
    const props = [
      ["calendar", "Todo en un solo lugar", "Eventos académicos, culturales y deportivos de tu institución, siempre actualizados."],
      ["check", "Inscripción en segundos", "Reserva tu cupo, consulta tu agenda y recibe confirmación al instante."],
      ["shield", "Organización confiable", "Equipos de gestión dedicados cuidan aforo, acceso y asistencia de cada evento."],
    ].map(([ic, t, p]) => `<div class="g-prop"><div class="g-prop-ic">${icon(ic, 22, { color: "#cfbb99" })}</div><h3>${t}</h3><p>${p}</p></div>`).join("");

    return `
      <div class="main guest">
        <header class="g-header">
          <div class="row" style="gap:12px"><div class="brand-logo"><span>E</span></div><div class="brand-name">EventPro</div></div>
          <button class="btn btn-primary" data-click="auth:open">Iniciar sesión</button>
        </header>

        <section class="g-hero">
          <div class="g-hero-in">
            <div class="eyebrow" style="color:#cfbb99">Bienvenido a EventPro 2026</div>
            <h1 class="g-hero-title">Conecta con los <span>eventos que importan</span></h1>
            <p class="g-hero-text">Descubre, gestiona y vive los mejores eventos académicos, culturales y deportivos de tu institución.</p>
            <div class="row" style="gap:12px">
              <button class="btn btn-primary" data-click="guest:toEvents">Ver eventos ${icon("right", 14, { width: 2.5 })}</button>
              <button class="btn g-btn-ghost" data-click="auth:open">Crear cuenta / Entrar</button>
            </div>
            <div class="g-stats">${stats}</div>
          </div>
        </section>

        <section class="g-section"><div class="g-props">${props}</div></section>

        <section class="g-section" id="g-events">
          <div class="row" style="justify-content:space-between;margin-bottom:20px">
            <div><div class="eyebrow">Próximos y destacados</div><h2 class="g-h2">Eventos que no te puedes perder</h2></div>
            <div class="row" style="gap:8px">
              <button class="btn btn-outline btn-sm" data-click="guest:scroll" data-dir="-1">‹</button>
              <button class="btn btn-outline btn-sm" data-click="guest:scroll" data-dir="1">›</button>
            </div>
          </div>
          <div class="g-track">${this.events().map((e) => this.card(e)).join("")}</div>
        </section>

        <footer class="g-footer">© 2026 EventPro · Plataforma de gestión de eventos</footer>
        ${Guard.modal()}
      </div>`;
  },
};

registerClick({
  "guest:toEvents": () => document.getElementById("g-events")?.scrollIntoView({ behavior: "smooth" }),
  "guest:scroll": (el) => document.querySelector(".g-track")?.scrollBy({ left: +el.dataset.dir * 340, behavior: "smooth" }),
});
