/* ==========================================================
   pages/public/guest-home.js — Home público (visitantes sin sesión)
   Secciones: Hero → estadísticas → Cómo funciona → Categorías →
   Eventos → FAQ → banner de registro. El header, el footer y los
   modales los pone PublicLayout (components/public-layout.js).

   ESTE ES EL HOME DE TODOS: visitantes y usuarios con sesión.
   - Visitante: "Inscribirse" y "Ver detalles" llevan data-requires-auth; el guard global
     (utils.js) abre el login y, al entrar, se abre el modal del evento (core/session.js).
   - Usuario: los mismos botones abren directamente EventModal; la tarjeta marca «Inscrito».
   ========================================================== */

const GUEST_STEPS = [
  ["calendar", "Descubre", "Fiestas, conciertos, torneos y eventos de tu universidad, siempre actualizados.", "#6a2cff", "#8f5bff"],
  ["check",    "Inscríbete en segundos", "Reserva tu cupo, consulta tu agenda y recibe confirmación al instante.", "#ff6a1a", "#ff9a3d"],
  ["shield",   "Vive sin complicaciones", "Equipos de gestión dedicados cuidan aforo, acceso y asistencia de cada evento.", "#f0287f", "#ff5fa8"],
];

const GUEST_FAQ = [
  ["¿Necesito una cuenta para ver los eventos?", "No. Puedes explorar libremente todos los eventos públicos. Para inscribirte o ver el detalle de un evento sí necesitas iniciar sesión."],
  ["¿Cómo me inscribo a un evento?", "Inicia sesión, elige el evento y pulsa «Inscribirse». Confirma tu cupo y lo verás en la sección «Mis inscripciones»."],
  ["¿Qué pasa si un evento se queda sin cupos?", "Aparece como «Agotado». Si alguien cancela su inscripción, el cupo se libera y vuelve a estar disponible."],
  ["¿Puedo cancelar mi inscripción?", "Sí. Desde «Mis inscripciones» puedes cancelarla cuando quieras y tu cupo queda libre para otra persona."],
  ["¿Cómo gestiono los eventos que organizo?", "Con el portal de organizadores (Agentes) se crean y editan los eventos, se controla el aforo y se hace el check-in de los asistentes."],
];

const GuestHome = {
  query: "",               // texto de la barra de búsqueda
  category: "todos",       // categoría activa ("todos" = sin filtro). Ids en HOME_CATEGORIES (js/data.js)
  faqOpen: new Set(),      // preguntas abiertas (se conservan al volver a dibujar)

  /* ----- datos ----- */
  events() {
    return Data.events
      .filter((e) => e.is_public !== false && !["completado", "cancelado"].includes(e.status))
      .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a.date.localeCompare(b.date));
  },

  /* ----- búsqueda y filtros ----- */
  catLabel(id) { const c = HOME_CATEGORIES.find((x) => x.id === id); return c ? c.label : ""; },

  // La búsqueda ignora tildes y mayúsculas; todas las palabras escritas deben aparecer (nombre, lugar, tipo, categoría…)
  matchesQuery(ev) {
    const q = normalize(this.query).trim();
    if (!q) return true;
    const hay = normalize([ev.name, ev.location, ev.coordinator, ev.description, TYPE_LABEL[ev.type],
                           ...eventCategories(ev).map((id) => this.catLabel(id))].join(" "));
    return q.split(/\s+/).every((t) => hay.includes(t));
  },
  inCategory(ev, cat) { return cat === "todos" || eventCategories(ev).includes(cat); },
  filtered() { return this.events().filter((e) => this.matchesQuery(e) && this.inCategory(e, this.category)); },
  isFiltering() { return !!this.query.trim() || this.category !== "todos"; },

  // Número que muestra cada píldora: eventos que coinciden con la búsqueda actual en esa categoría
  counts() {
    const base = this.events().filter((e) => this.matchesQuery(e));
    const counts = { todos: base.length };
    HOME_CATEGORIES.forEach((c) => { counts[c.id] = base.filter((e) => eventCategories(e).includes(c.id)).length; });
    return counts;
  },

  /* ----- piezas ----- */
  card(ev) {
    const tc = TYPE_STYLE[ev.type], d = parseDate(ev.date);
    const spots = UserApp.getSpots(ev.id), full = spots <= 0;
    const mine = Session.isUser && UserApp.isRegistered(ev.id);
    // Visitante: el guard pide login. Usuario con sesión: abre el modal directamente.
    const auth = Session.isAuthenticated ? "" : "data-requires-auth";
    const imgBg = `background-image:url('${esc(ev.image)}'),${tc.gradient}`;      // si la foto no carga, queda el degradado
    const cta = mine
      ? `<button class="btn btn-outline" style="flex:1" data-click="event:details" data-id="${ev.id}">Ver detalles</button>
         <div class="registered-tag" style="flex:1;justify-content:center">${icon("check", 14, { width: 3 })}<span>Inscrito</span></div>`
      : `<button class="btn btn-outline" style="flex:1" ${auth} data-click="event:details" data-id="${ev.id}">Ver detalles</button>
         <button class="cta-btn" style="flex:1;background:${tc.gradient}" ${auth} data-click="event:register" data-id="${ev.id}" ${full ? "disabled" : ""}>${full ? "Agotado" : "Inscribirse"}</button>`;
    return `
      <article class="card card-hover g-card">
        <div class="g-img" style="${imgBg}">
          <span class="img-badge img-badge-lg" style="background:${tc.gradient}">${TYPE_LABEL[ev.type]}</span>
          ${ev.featured ? `<span class="g-star">★ Destacado</span>` : ""}
          <span class="g-price ${ev.price > 0 ? "" : "is-free"}">${esc(priceLabel(ev))}</span>
          <div class="g-date"><b>${String(d.getDate()).padStart(2, "0")}</b><small>${d.toLocaleString("es-CO", { month: "short" })}</small></div>
        </div>
        <div class="g-body">
          <h3 class="g-title">${esc(ev.name)}</h3>
          <div class="g-meta">${esc(ev.time)} · ${esc(ev.location)}</div>
          <div class="row" style="gap:8px;margin:14px 0 16px">
            <div class="bar bar-thin" style="flex:1"><div class="bar-fill" style="width:${percent(ev.registered, ev.capacity)}%;background:${tc.gradient}"></div></div>
            <span class="dash-count">${full ? "Agotado" : spots + " cupos"}</span>
          </div>
          <div class="g-buttons">${cta}</div>
        </div>
      </article>`;
  },

  collage() {
    const img = (type) => `background-image:url('${esc(bigImage(TYPE_IMAGES[type], 900))}'),${TYPE_STYLE[type].gradient}`;
    return `
      <div class="g-collage" aria-hidden="true">
        <div class="g-photo g-photo-a" style="${img("cultural")}"></div>
        <div class="g-photo g-photo-b" style="${img("deportivo")}"></div>
        <div class="g-photo g-photo-c" style="${img("academico")}"></div>
        <div class="g-float g-float-1"><span style="background:var(--teal)">${icon("check", 18, { color: "#fff", width: 3 })}</span>Inscripción confirmada</div>
        <div class="g-float g-float-2"><span style="background:var(--primary)">${icon("users", 18, { color: "#fff" })}</span>+1.5K asistentes</div>
      </div>`;
  },

  steps() {
    return GUEST_STEPS.map(([ic, t, p, c1, c2]) => `
      <li style="--c1:${c1};--c2:${c2}">
        <div class="g-step-ic">${icon(ic, 24, { color: "#fff", width: 2.2 })}</div>
        <div><h3>${t}</h3><p>${p}</p></div>
      </li>`).join("");
  },

  categoryImage(c) {
    const ev = c.imageEvent ? Data.events.find((e) => e.id === c.imageEvent) : null;
    return bigImage(ev ? ev.image : TYPE_IMAGES[c.imageType], 700);
  },

  categories() {
    const all = this.events();
    const tiles = HOME_CATEGORIES.map((c) => {
      const n = all.filter((e) => eventCategories(e).includes(c.id)).length;
      return `
        <button class="g-cat ${this.category === c.id ? "is-active" : ""}" data-click="home:tile" data-value="${c.id}" aria-pressed="${this.category === c.id}"
                style="--c:${c.color};background-image:url('${esc(this.categoryImage(c))}'),${c.gradient}">
          <span class="g-cat-n">${n} evento${n === 1 ? "" : "s"}</span>
          <span class="g-cat-t">${esc(c.label)}</span>
        </button>`;
    }).join("");
    return tiles + `
      <button class="g-cat g-cat-all ${this.category === "todos" ? "is-active" : ""}" data-click="home:tile" data-value="todos" aria-pressed="${this.category === "todos"}">
        <span class="g-cat-n">${all.length} eventos</span>
        <span class="g-cat-t">Ver todos ${icon("right", 20, { width: 2.8 })}</span>
      </button>`;
  },

  /* ----- resultados (se repintan al buscar / filtrar, sin redibujar el resto de la página) ----- */
  resultsInfo() {
    const n = this.filtered().length;
    const q = this.query.trim();
    const parts = [`<span><b>${n}</b> ${n === 1 ? "evento" : "eventos"}${q ? ` para «${esc(q)}»` : ""}${this.category !== "todos" ? ` en <b>${esc(this.catLabel(this.category))}</b>` : ""}</span>`];
    if (this.isFiltering()) parts.push(`<button class="g-link" data-click="home:reset">Limpiar filtros</button>`);
    return parts.join("");
  },

  resultsHtml() {
    const list = this.filtered();
    if (list.length) return `<div class="g-grid">${list.map((e) => this.card(e)).join("")}</div>`;
    return `
      <div class="g-noresults">
        <h3>No encontramos eventos</h3>
        <p>Prueba con otra palabra o cambia de categoría.</p>
        <button class="btn btn-primary" data-click="home:reset">Ver todos los eventos</button>
      </div>`;
  },

  /** Repinta solo lo que cambia: píldoras, contador, resultados, tarjetas de categoría y botón ✕ */
  paint() {
    const set = (sel, html) => { const el = document.querySelector(sel); if (el) el.innerHTML = html; };
    set("#g-filters", CategoryFilters.pills({ categories: HOME_CATEGORIES, active: this.category, counts: this.counts(), action: "home:category" }));
    set("#g-results-info", this.resultsInfo());
    set("#g-results", this.resultsHtml());
    document.querySelectorAll(".g-cat").forEach((el) => {
      const on = el.dataset.value === this.category;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-pressed", String(on));
    });
    SearchBar.syncClear("home-search");
  },

  faq() {
    return GUEST_FAQ.map(([q, a], i) => `
      <details class="g-q" data-i="${i}" ${this.faqOpen.has(i) ? "open" : ""}>
        <summary>${esc(q)}</summary>
        <p>${esc(a)}</p>
      </details>`).join("");
  },

  /* ----- vista ----- */
  render() {
    const stats = LANDING_STATS.map((s) => `<div><div class="g-stat-v">${s.value}</div><div class="g-stat-l">${s.label}</div></div>`).join("");

    const content = `
      ${HeroCarousel.render()}

      <!-- Búsqueda + filtros: flota sobre el borde inferior del hero -->
      <section class="g-search-wrap" id="g-search" aria-label="Buscar eventos">
        <div class="g-search-card">
          <div class="g-search-head"><h2>${Session.isUser ? `Hola, ${esc(Session.firstName)}. ` : ""}¿Qué quieres vivir hoy?</h2><p>Busca por nombre, lugar o categoría.</p></div>
          ${SearchBar.render({ id: "home-search", value: this.query, placeholder: "Busca eventos, lugares…", label: "Buscar eventos",
                               input: "home:search", clear: "home:clear", submit: "home:submit" })}
          <div class="g-search-cats">
            <span class="g-search-label">Categorías</span>
            ${CategoryFilters.render({ id: "g-filters", categories: HOME_CATEGORIES, active: this.category, counts: this.counts(), action: "home:category" })}
          </div>
        </div>
      </section>

      <!-- Resultados -->
      <section class="g-band g-band-white g-band-results" id="g-events">
        <div class="g-head">
          <div><div class="g-eyebrow">Próximos y destacados</div><h2 class="g-h2">Eventos que no te puedes perder</h2></div>
          <div class="g-results-info" id="g-results-info" aria-live="polite">${this.resultsInfo()}</div>
        </div>
        <div id="g-results">${this.resultsHtml()}</div>
      </section>

      <section class="g-band-stats" aria-label="EventPro en cifras"><div class="g-stats-in">${stats}</div></section>

      <!-- Cómo funciona: collage de fotos + pasos -->
      <section class="g-band g-band-tint" id="g-how">
        <div class="g-split">
          ${this.collage()}
          <div>
            <div class="g-eyebrow">Cómo funciona</div>
            <h2 class="g-h2">Vive el campus sin perderte nada</h2>
            <p class="g-lead">Todo lo que pasa en tu universidad, en un solo lugar y a un par de clics.</p>
            <ol class="g-steps">${this.steps()}</ol>
            <div class="row" style="gap:12px;flex-wrap:wrap">
              ${Session.isUser
                ? `<button class="btn btn-primary btn-xl" data-click="footer:scroll" data-target="g-events">Explorar eventos</button>
                   <button class="btn btn-outline btn-xl" data-click="nav:user" data-view="inscripciones">Mis inscripciones</button>`
                : `<button class="btn btn-primary btn-xl" data-click="auth:open">Crear cuenta</button>
                   <button class="btn btn-outline btn-xl" data-click="footer:scroll" data-target="g-events">Explorar eventos</button>`}
            </div>
          </div>
        </div>
      </section>

      <!-- Categorías: atajos que aplican el mismo filtro de las píldoras -->
      <section class="g-band g-band-white" id="g-categories">
        <div class="g-head">
          <div><div class="g-eyebrow">Explora por categoría</div><h2 class="g-h2">Encuentra tu plan ideal</h2></div>
          <p class="g-head-note">Elige una categoría y te mostramos los eventos que van contigo.</p>
        </div>
        <div class="g-cats">${this.categories()}</div>
      </section>

      <!-- FAQ + banner final -->
      <section class="g-band g-band-tint g-band-faq" id="g-faq">
        <div class="g-faq">
          <div>
            <div class="g-eyebrow">Preguntas frecuentes</div>
            <h2 class="g-h2">Resolvemos tus dudas</h2>
            <p class="g-lead">Lo básico para empezar a vivir los eventos de tu universidad.</p>
            <div class="g-helpcard">
              <strong>¿Sigues con dudas?</strong>
              <span>Nuestro equipo de soporte te ayuda.</span>
              <button class="btn btn-accent" data-click="notice:open" data-key="help">Contactar soporte</button>
            </div>
          </div>
          <div>${this.faq()}</div>
        </div>

        <div class="g-cta-in">
          ${Session.isUser ? `
          <div>
            <h2>Tu agenda, siempre a la mano</h2>
            <p>Revisa tus inscripciones, tu historial y tus datos desde tu panel.</p>
          </div>
          <button class="btn btn-accent btn-xl" data-click="nav:user" data-view="panel">Ir a mi panel ${icon("right", 16, { width: 2.8 })}</button>` : `
          <div>
            <h2>¿Listo para vivir tu próximo evento?</h2>
            <p>Crea tu cuenta gratis, inscríbete en segundos y lleva tu agenda siempre contigo.</p>
          </div>
          <button class="btn btn-accent btn-xl" data-click="auth:open">Crear cuenta ${icon("right", 16, { width: 2.8 })}</button>`}
        </div>
      </section>`;

    return PublicLayout.render(content, { overHero: true });
  },

  /* Después de dibujar: header transparente/sólido y arranque del carrusel */
  afterRender() {
    PublicLayout.afterRender({ overHero: true });
    HeroCarousel.mount();
    EventModal.afterRender();
  },
};

// Recuerda qué preguntas del FAQ están abiertas ("toggle" no sube por el DOM, por eso se escucha en captura)
document.addEventListener("toggle", (e) => {
  if (!e.target.classList || !e.target.classList.contains("g-q")) return;
  const i = +e.target.dataset.i;
  if (e.target.open) GuestHome.faqOpen.add(i); else GuestHome.faqOpen.delete(i);
}, true);

/* ----- Búsqueda y filtros ----- */
registerInput({
  // Escribir repinta solo los resultados: el input conserva el foco y el hero no se reinicia
  "home:search": (el) => { GuestHome.query = el.value; GuestHome.paint(); },
});

const scrollToResults = () => document.getElementById("g-events")?.scrollIntoView({ behavior: "smooth", block: "start" });

registerEnter({ "home:submit": () => scrollToResults() });

registerClick({
  "home:submit": () => scrollToResults(),

  "home:clear": () => {
    GuestHome.query = "";
    const input = document.getElementById("home-search");
    if (input) { input.value = ""; input.focus(); }
    GuestHome.paint();
  },

  // Píldora: al pulsar la activa se quita el filtro (vuelve a "Todos")
  "home:category": (el) => {
    const id = el.dataset.value;
    GuestHome.category = (GuestHome.category === id && id !== "todos") ? "todos" : id;
    GuestHome.paint();
  },

  // Tarjeta de categoría (sección inferior): aplica el filtro y sube a los resultados
  "home:tile": (el) => { GuestHome.category = el.dataset.value; GuestHome.paint(); scrollToResults(); },

  "home:reset": () => {
    GuestHome.query = ""; GuestHome.category = "todos";
    const input = document.getElementById("home-search");
    if (input) input.value = "";
    GuestHome.paint();
  },

  // Navbar → "Buscar": lleva a la barra y deja el cursor listo para escribir
  "guest:focusSearch": () => {
    if (Session.isUser && UserApp.view !== "home") { UserApp.view = "home"; App.render({ resetScroll: true }); }
    document.getElementById("g-search")?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => document.getElementById("home-search")?.focus({ preventScroll: true }), 350);
  },

  "guest:toEvents": () => scrollToResults(),
});
