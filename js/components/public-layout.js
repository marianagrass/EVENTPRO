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
   Con sesión de usuario, «Iniciar sesión / Crear cuenta» se reemplaza por el avatar con un menú
   desplegable (Mi panel, Mis inscripciones, Historial, Perfil, Cerrar sesión). El Home sigue siendo
   el mismo para visitantes y usuarios: solo cambia el Navbar y los botones de las tarjetas.
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

  /* Menú del avatar (solo con sesión de usuario). Abrir/cerrar solo cambia clases, no redibuja el Home. */
  userMenu() {
    const u = Session.user;
    const count = UserApp.upcoming().length;
    const item = (ic, label, view, extra = "") => `
      <button type="button" role="menuitem" class="g-user-item" data-click="nav:user" data-view="${view}">
        ${icon(ic, 18, { width: 2 })}<span>${label}</span>${extra}
      </button>`;
    return `
      <div class="g-user" id="g-user">
        <button type="button" class="g-user-btn" data-click="usermenu:toggle" aria-haspopup="menu" aria-expanded="false" aria-controls="g-user-menu" aria-label="Menú de ${esc(u.name)}">
          <span class="g-avatar">${esc(initials(u.name))}</span>
          <span class="g-user-name">${esc(Session.firstName)}</span>
          ${icon("down", 16, { width: 2.6, cls: "g-user-chev" })}
        </button>
        <div class="g-user-menu" id="g-user-menu" role="menu" aria-label="Mi cuenta" hidden>
          <div class="g-user-head">
            <span class="g-avatar g-avatar-lg">${esc(initials(u.name))}</span>
            <div><strong>${esc(u.name)}</strong><small>${esc(UserApp.profile.correo)}</small></div>
          </div>
          ${item("home", "Mi panel", "panel")}
          ${item("ticket", "Mis inscripciones", "inscripciones", count ? `<span class="g-user-count">${count}</span>` : "")}
          ${item("history", "Historial", "historial")}
          ${item("settings", "Perfil y configuración", "perfil")}
          <div class="g-user-sep"></div>
          <button type="button" role="menuitem" class="g-user-item is-danger" data-click="app:logout">${icon("logout", 18, { width: 2 })}<span>Cerrar sesión</span></button>
        </div>
      </div>`;
  },

  setUserMenu(open) {
    const box = document.getElementById("g-user");
    if (!box) return;
    const btn = box.querySelector(".g-user-btn"), menu = box.querySelector(".g-user-menu");
    box.classList.toggle("is-open", !!open);
    btn.setAttribute("aria-expanded", String(!!open));
    menu.hidden = !open;
    if (open) { const first = menu.querySelector(".g-user-item"); if (first) first.focus({ preventScroll: true }); }
  },
  userMenuIsOpen() { const b = document.getElementById("g-user"); return !!b && b.classList.contains("is-open"); },

  header(overHero) {
    return `
      <header class="g-header ${overHero ? "" : "is-solid is-static"}" id="g-header">
        <button type="button" class="g-brand g-brand-btn" data-click="brand:home" aria-label="EventPro: ir al inicio"><div class="brand-logo"><span>E</span></div><div class="brand-name">EventPro</div></button>
        <nav class="g-nav" aria-label="Secciones">${this.navButtons()}</nav>
        <div class="g-actions">
          ${ThemeToggle.render()}
          ${Session.isUser ? this.userMenu() : `
          <button class="btn g-btn-ghost" data-click="auth:open">Iniciar sesión</button>
          <button class="btn btn-accent" data-click="auth:open">Crear cuenta</button>`}
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
        ${Session.isUser ? `
        <div class="g-drawer-cta">
          <div class="g-drawer-user"><span class="g-avatar g-avatar-lg">${esc(initials(Session.user.name))}</span><div><strong>${esc(Session.user.name)}</strong><small>${esc(UserApp.profile.correo)}</small></div></div>
          <button class="btn btn-outline" data-click="nav:user" data-view="panel">Mi panel</button>
          <button class="btn btn-outline" data-click="nav:user" data-view="inscripciones">Mis inscripciones</button>
          <button class="btn btn-accent" data-click="app:logout">Cerrar sesión</button>
        </div>` : `
        <div class="g-drawer-cta">
          <button class="btn btn-outline" data-click="auth:open">Iniciar sesión</button>
          <button class="btn btn-accent" data-click="auth:open">Crear cuenta</button>
        </div>`}
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
        ${EventModal.render()}
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
    main.querySelectorAll(".hero-carousel, .g-search-wrap, .g-band, .g-cta, .acct, .pf").forEach((el) => {
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
  "usermenu:toggle": () => PublicLayout.setUserMenu(!PublicLayout.userMenuIsOpen()),

  // Logo: el usuario vuelve al Home; en el Home sube al inicio
  "brand:home": () => {
    if (Session.isUser && UserApp.view !== "home") { UserApp.view = "home"; App.render({ resetScroll: true }); return; }
    const main = document.querySelector(".main.guest");
    if (main) main.scrollTo({ top: 0, behavior: "smooth" });
  },
});

// El menú del avatar se cierra al hacer clic fuera
document.addEventListener("click", (e) => {
  if (PublicLayout.userMenuIsOpen() && !e.target.closest("#g-user")) PublicLayout.setUserMenu(false);
});

// Elegir una opción del drawer lo cierra (la acción de la opción ya se ejecutó antes: este escuchador se registra después)
document.addEventListener("click", (e) => {
  const el = e.target.closest && e.target.closest(".g-drawer [data-click]");
  if (el && !["menu:toggle", "menu:close", "theme:toggle"].includes(el.dataset.click)) PublicLayout.setMenu(false);
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (PublicLayout.menuOpen) PublicLayout.setMenu(false);
  if (PublicLayout.userMenuIsOpen()) { PublicLayout.setUserMenu(false); const b = document.querySelector(".g-user-btn"); if (b) b.focus(); }
});

if (window.matchMedia) {
  const desktop = window.matchMedia("(min-width: 1024px)");
  const onChange = (e) => { if (e.matches) PublicLayout.setMenu(false); };
  if (desktop.addEventListener) desktop.addEventListener("change", onChange);
}
