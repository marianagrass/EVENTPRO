/* ==========================================================
   components/public-layout.js — Layout de TODAS las vistas públicas
   Envuelve el contenido de cada página pública con:
     Navbar  →  [contenido de la página]  →  Footer  →  modales (login / avisos)
   Para crear otra vista pública (FAQ, Ayuda…) solo devuelve:
     PublicLayout.render(`<section>…</section>`, { overHero: false })
   y en su afterRender() llama a PublicLayout.afterRender({ overHero: false }).

   Navbar:
     ≥ 1024px  enlaces + botón de tema + «Iniciar sesión» / «Crear cuenta» en una fila.
     < 1024px  solo el logo y el botón ☰: todo lo demás va dentro de un drawer
               (panel lateral desplegable).
   Estado del menú móvil: PublicLayout.menuOpen (true/false)
     PublicLayout.setMenu(true|false) / PublicLayout.toggleMenu()
   Se cierra con: botón ✕, toque en el fondo oscuro, tecla Esc, elegir una opción
   o al agrandar la ventana. Solo cambia clases del DOM (no redibuja el Home).
   ========================================================== */
const PUBLIC_NAV = [
  { label: "Buscar",        icon: "search",   click: "guest:focusSearch" },
  { label: "Eventos",       icon: "calendar", target: "g-events" },
  { label: "Cómo funciona", icon: "tasks",    target: "g-how" },
  { label: "FAQ",           icon: "chat",     target: "g-faq" },
];

const PublicLayout = {
  menuOpen: false,

  navButtons(cls = "") {
    return PUBLIC_NAV.map((n) => {
      const attrs = n.click ? `data-click="${n.click}"` : `data-click="footer:scroll" data-target="${n.target}"`;
      return cls
        ? `<button type="button" class="${cls}" ${attrs}>${icon(n.icon, 20, { width: 2 })}<span>${n.label}</span>${icon("right", 16, { width: 2.4, cls: "g-drawer-chev" })}</button>`
        : `<button type="button" ${attrs}>${n.label}</button>`;
    }).join("");
  },

  header(overHero) {
    return `
      <header class="g-header ${overHero ? "" : "is-solid is-static"}" id="g-header">
        <div class="g-brand"><div class="brand-logo"><span>E</span></div><div class="brand-name">EventPro</div></div>
        <nav class="g-nav" aria-label="Secciones">${this.navButtons()}</nav>
        <div class="g-actions">
          ${ThemeToggle.render()}
          <button class="btn g-btn-ghost" data-click="auth:open">Iniciar sesión</button>
          <button class="btn btn-accent" data-click="auth:open">Crear cuenta</button>
        </div>
        <button type="button" class="g-burger" data-click="menu:toggle" aria-controls="g-drawer" aria-expanded="false" aria-label="Abrir menú">
          ${icon("menu", 26, { width: 2.2 })}
        </button>
      </header>`;
  },

  /* El drawer va FUERA del <header>: el header usa backdrop-filter y eso rompería su posición fija */
  drawer() {
    return `
      <div class="g-drawer-backdrop" data-click="menu:close"></div>
      <aside class="g-drawer" id="g-drawer" role="dialog" aria-modal="true" aria-label="Menú de navegación" aria-hidden="true">
        <div class="g-drawer-head">
          <div class="g-brand"><div class="brand-logo"><span>E</span></div><div class="brand-name">EventPro</div></div>
          <button type="button" class="g-drawer-close" data-click="menu:close" aria-label="Cerrar menú">${icon("x", 22, { width: 2.4 })}</button>
        </div>
        <nav class="g-drawer-nav" aria-label="Secciones">${this.navButtons("g-drawer-link")}</nav>
        <div class="g-drawer-theme"><span>Modo oscuro</span>${ThemeToggle.render()}</div>
        <div class="g-drawer-cta">
          <button class="btn btn-outline" data-click="auth:open">Iniciar sesión</button>
          <button class="btn btn-accent" data-click="auth:open">Crear cuenta</button>
        </div>
      </aside>`;
  },

  /**
   * overHero: true  → el header es transparente sobre un hero y se vuelve sólido al hacer scroll
   *           false → header sólido normal (páginas sin hero)
   */
  render(content, { overHero = true } = {}) {
    this.menuOpen = false;                       // cualquier redibujado deja el menú cerrado
    return `
      <div class="main guest">
        ${this.header(overHero)}
        ${this.drawer()}
        ${content}
        ${PublicFooter.render()}
        ${Guard.modal()}
        ${Notice.modal()}
      </div>`;
  },

  setMenu(open) {
    this.menuOpen = !!open;
    const main = document.querySelector(".main.guest");
    if (!main) return;
    main.classList.toggle("menu-open", this.menuOpen);                  // bloquea el scroll de atrás y muestra el drawer

    const burger = main.querySelector(".g-burger");
    const drawer = main.querySelector(".g-drawer");
    if (burger) { burger.setAttribute("aria-expanded", String(this.menuOpen)); }
    if (drawer) drawer.setAttribute("aria-hidden", String(!this.menuOpen));
    main.querySelectorAll(".hero-carousel, .g-search-wrap, .g-band, .g-cta, .pf").forEach((el) => {
      if (this.menuOpen) el.setAttribute("inert", ""); else el.removeAttribute("inert");   // el teclado no entra al contenido de atrás
    });

    if (this.menuOpen) { const close = main.querySelector(".g-drawer-close"); if (close) close.focus({ preventScroll: true }); }
    else if (burger && drawer && drawer.contains(document.activeElement)) { burger.focus({ preventScroll: true }); }
  },
  toggleMenu() { this.setMenu(!this.menuOpen); },

  afterRender({ overHero = true } = {}) {
    if (!overHero) return;
    const main = document.querySelector(".main.guest");
    const header = document.getElementById("g-header");
    if (!main || !header) return;
    const paint = () => header.classList.toggle("is-solid", main.scrollTop > 40);
    main.addEventListener("scroll", paint, { passive: true });
    paint();
  },
};

registerClick({
  "menu:toggle": () => PublicLayout.toggleMenu(),
  "menu:close":  () => PublicLayout.setMenu(false),
});

// Elegir una opción del drawer lo cierra (la acción de la opción ya se ejecutó antes: este escuchador se registra después)
document.addEventListener("click", (e) => {
  const el = e.target.closest && e.target.closest(".g-drawer [data-click]");
  if (el && !["menu:toggle", "menu:close", "theme:toggle"].includes(el.dataset.click)) PublicLayout.setMenu(false);
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && PublicLayout.menuOpen) PublicLayout.setMenu(false); });

if (window.matchMedia) {
  const desktop = window.matchMedia("(min-width: 1024px)");
  const onChange = (e) => { if (e.matches) PublicLayout.setMenu(false); };
  if (desktop.addEventListener) desktop.addEventListener("change", onChange);
}
