/* ==========================================================
   pages/public/hero-carousel.js — Carrusel Hero del Home público
   Sin librerías. Incluye: autoplay con barra de progreso, flechas,
   puntos, pausa/play, teclado (← →), swipe en pantallas táctiles,
   pausa al pasar el mouse / con el modal abierto / con la pestaña
   oculta, y respeta "reducir movimiento" del sistema.
   Los slides se configuran en HERO_SLIDES (js/data.js).
   ========================================================== */

// Pide la versión grande de una foto de Unsplash (…?w=600 → …?w=1600)
function bigImage(url, w = 1600) {
  return String(url || "").replace(/([?&])w=\d+/, `$1w=${w}`);
}

const HERO_FALLBACK = {
  tag: "EventPro 2026", title: "Conecta con los eventos que importan", highlight: "eventos que importan",
  text: "Descubre, gestiona y vive los mejores eventos académicos, culturales y deportivos de tu institución.",
  accent: "#6a2cff", image: "", ev: null,
};

const HeroCarousel = {
  DURATION: 6500,            // milisegundos por slide
  index: 0,                  // slide visible (se conserva cuando la página se vuelve a dibujar)
  root: null,

  // Motivos por los que el autoplay está detenido: "user" | "hover" | "focus" | "tab" | "modal"
  holds: new Set(
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) ? ["user"] : []
  ),
  timer: null,
  startedAt: 0,              // cuándo arrancó el temporizador actual
  remaining: 6500,           // tiempo que le falta al slide actual

  /* ----- datos ----- */
  slides() {
    const list = HERO_SLIDES.map((cfg) => {
      const ev = cfg.eventId ? Data.events.find((e) => e.id === cfg.eventId) : null;
      if (cfg.eventId && !ev) return null;                    // el evento fue eliminado: se omite el slide
      const type = ev ? ev.type : (cfg.type || "academico");
      return { ...cfg, ev, accent: TYPE_STYLE[type].bg, image: cfg.image || (ev ? bigImage(ev.image) : "") };
    }).filter(Boolean);
    return list.length ? list : [HERO_FALLBACK];
  },

  /* ----- vista ----- */
  titleHtml(title, highlight) {
    const t = esc(title);
    if (!highlight) return t;
    const h = esc(highlight);
    return t.replace(h, `<span>${h}</span>`);
  },

  renderSlide(s, i) {
    const active = i === this.index;
    const meta = s.ev ? `
      <div class="hero-meta">
        <span>${icon("calendar", 16)} ${parseDate(s.ev.date).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })} · ${esc(s.ev.time)}</span>
        <span>${icon("pin", 16)} ${esc(s.ev.location)}</span>
      </div>` : "";

    // Con evento: Inscribirme / Ver detalles (piden login). Sin evento: Crear cuenta / Ver eventos.
    const actions = s.ev ? `
      <button class="btn btn-accent btn-xl" data-requires-auth data-click="guest:register" data-id="${esc(s.ev.id)}">Inscribirme ${icon("right", 16, { width: 2.8 })}</button>
      <button class="btn btn-glass btn-xl" data-requires-auth data-click="guest:details" data-id="${esc(s.ev.id)}">Ver detalles</button>` : `
      <button class="btn btn-accent btn-xl" data-click="auth:open">Crear cuenta ${icon("right", 16, { width: 2.8 })}</button>
      <button class="btn btn-glass btn-xl" data-click="guest:toEvents">Ver eventos</button>`;

    return `
      <article class="hero-slide ${active ? "is-active" : ""}" style="--slide:${esc(s.accent)}"
               role="group" aria-roledescription="slide" aria-label="${i + 1} de ${this.count}" aria-hidden="${!active}">
        ${s.image ? `<img class="hero-img" src="${esc(s.image)}" alt="" decoding="async" ${i === 0 ? 'fetchpriority="high"' : ""} onerror="this.remove()">` : ""}
        <div class="hero-shade"></div>
        <div class="hero-glow"></div>
        <div class="hero-content">
          <span class="hero-tag"><i></i>${esc(s.tag)}</span>
          <h2 class="hero-title">${this.titleHtml(s.title, s.highlight)}</h2>
          <p class="hero-text">${esc(s.text)}</p>
          ${meta}
          <div class="hero-actions">${actions}</div>
        </div>
      </article>`;
  },

  render() {
    const slides = this.slides();
    this.count = slides.length;
    this.index = Math.min(this.index, slides.length - 1);
    const pad = (n) => String(n).padStart(2, "0");
    const stopped = this.holds.has("user");

    const dots = slides.map((_, i) => `
      <button class="hero-dot ${i === this.index ? "is-active" : ""}" data-click="hero:goto" data-i="${i}"
              aria-label="Ir al slide ${i + 1}" ${i === this.index ? 'aria-current="true"' : ""}><b><i></i></b></button>`).join("");

    return `
      <section class="hero-carousel ${stopped ? "is-paused" : ""}" style="--dur:${this.DURATION}ms"
               aria-roledescription="carousel" aria-label="Eventos destacados">
        <h1 class="sr-only">EventPro: eventos universitarios, culturales y deportivos</h1>
        <div class="hero-slides" aria-live="off">${slides.map((s, i) => this.renderSlide(s, i)).join("")}</div>

        <div class="hero-ui">
          <div class="hero-ui-in">
            <div class="hero-dots" role="group" aria-label="Elegir slide">${dots}</div>
            <div class="hero-controls">
              <span class="hero-count" aria-hidden="true">${pad(this.index + 1)} / ${pad(slides.length)}</span>
              <button class="hero-arrow" data-click="hero:toggle" aria-pressed="${stopped}"
                      aria-label="${stopped ? "Reanudar carrusel" : "Pausar carrusel"}">${icon(stopped ? "play" : "pause", 18, { width: 2.4 })}</button>
              <button class="hero-arrow" data-click="hero:prev" aria-label="Slide anterior">${icon("left", 20, { width: 2.6 })}</button>
              <button class="hero-arrow" data-click="hero:next" aria-label="Slide siguiente">${icon("right", 20, { width: 2.6 })}</button>
            </div>
          </div>
        </div>
      </section>`;
  },

  /* ----- comportamiento ----- */

  /** Se llama después de cada render() de la página: conecta eventos y arranca el autoplay */
  mount() {
    clearTimeout(this.timer);
    this.root = document.querySelector(".hero-carousel");
    if (!this.root) return;
    const root = this.root;

    // Estado que no sobrevive a un nuevo dibujado
    this.holds.delete("hover");
    this.holds.delete("focus");
    if (Guard.open || Notice.key) this.holds.add("modal"); else this.holds.delete("modal");
    if (document.hidden) this.holds.add("tab"); else this.holds.delete("tab");

    if (!this._bound) {            // se registra una sola vez
      document.addEventListener("visibilitychange", () => (document.hidden ? this.hold("tab") : this.release("tab")));
      this._bound = true;
    }

    // Pausa con el mouse encima (no con el dedo: en táctil el "hover" se queda pegado)
    root.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") this.hold("hover"); });
    root.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") this.release("hover"); });

    // Pausa si el teclado entra al carrusel (pero no al hacer clic en una flecha)
    root.addEventListener("focusin", (e) => {
      let kb = false;
      try { kb = e.target.matches(":focus-visible"); } catch (_) { /* navegador sin :focus-visible */ }
      if (kb) this.hold("focus");
    });
    root.addEventListener("focusout", () => this.release("focus"));

    // Teclado: ← →
    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft")  { e.preventDefault(); this.go(this.index - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); this.go(this.index + 1); }
    });

    // Swipe en pantallas táctiles
    let startX = null;
    root.addEventListener("pointerdown", (e) => {
      startX = (e.pointerType !== "mouse" && !e.target.closest("button")) ? e.clientX : null;
    });
    root.addEventListener("pointerup", (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 50) this.go(this.index + (dx < 0 ? 1 : -1));
    });

    this.schedule(this.DURATION);
  },

  /** Muestra el slide i (circular). Actualiza el DOM en el lugar, sin volver a dibujar la página */
  go(i) {
    const root = this.root;
    if (!root || !document.body.contains(root)) return;
    const slides = root.querySelectorAll(".hero-slide");
    const dots = root.querySelectorAll(".hero-dot");
    const n = slides.length;
    this.index = ((i % n) + n) % n;

    slides.forEach((el, k) => {
      el.classList.toggle("is-active", k === this.index);
      el.setAttribute("aria-hidden", String(k !== this.index));
    });
    dots.forEach((el, k) => {
      el.classList.toggle("is-active", k === this.index);
      if (k === this.index) el.setAttribute("aria-current", "true"); else el.removeAttribute("aria-current");
    });
    const count = root.querySelector(".hero-count");
    if (count) count.textContent = `${String(this.index + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`;

    // Reinicia la animación de la barra de progreso del punto activo
    const fill = dots[this.index] && dots[this.index].querySelector("i");
    if (fill) { fill.style.animation = "none"; void fill.offsetWidth; fill.style.animation = ""; }

    this.schedule(this.DURATION);
  },

  /** Programa el cambio automático para dentro de `ms` milisegundos */
  schedule(ms) {
    clearTimeout(this.timer);
    this.remaining = ms;
    this.startedAt = 0;
    this.sync();
  },

  /** Arranca o detiene el temporizador según haya motivos de pausa */
  sync() {
    clearTimeout(this.timer);
    if (this.holds.size) {
      if (this.startedAt) {                         // estaba corriendo: guarda lo que le faltaba
        this.remaining -= Date.now() - this.startedAt;
        this.startedAt = 0;
      }
    } else {
      this.startedAt = Date.now();
      this.timer = setTimeout(() => this.go(this.index + 1), Math.max(this.remaining, 0));
    }
    this.paintState();
  },

  hold(reason)    { if (!this.holds.has(reason)) { this.holds.add(reason); this.sync(); } },
  release(reason) { if (this.holds.delete(reason)) this.sync(); },

  toggleUser() { if (this.holds.has("user")) this.release("user"); else this.hold("user"); },

  /** Refleja el estado (pausado / en reproducción) en la interfaz */
  paintState() {
    const root = this.root;
    if (!root) return;
    root.classList.toggle("is-paused", this.holds.size > 0);
    const slidesEl = root.querySelector(".hero-slides");
    if (slidesEl) slidesEl.setAttribute("aria-live", this.holds.size ? "polite" : "off");
    const btn = root.querySelector('[data-click="hero:toggle"]');
    if (btn) {
      const stopped = this.holds.has("user");
      btn.innerHTML = icon(stopped ? "play" : "pause", 18, { width: 2.4 });
      btn.setAttribute("aria-pressed", String(stopped));
      btn.setAttribute("aria-label", stopped ? "Reanudar carrusel" : "Pausar carrusel");
    }
  },
};

registerClick({
  "hero:next":   () => HeroCarousel.go(HeroCarousel.index + 1),
  "hero:prev":   () => HeroCarousel.go(HeroCarousel.index - 1),
  "hero:goto":   (el) => HeroCarousel.go(+el.dataset.i),
  "hero:toggle": () => HeroCarousel.toggleUser(),
});
