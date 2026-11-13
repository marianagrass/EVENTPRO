/* ==========================================================
   components/app-shell.js — Estructura de los paneles internos (Admin, Usuario, Agente)
   Escritorio (≥ 1024px): menú lateral fijo a la izquierda.
   Móvil / tablet (< 1024px): el menú se oculta y se abre como panel lateral (off-canvas)
   desde el botón ☰ de la barra superior.

   Estado del menú: AppShell.open (true/false).
     AppShell.setOpen(true|false)  → abre / cierra
     AppShell.toggle()             → alterna
   Se cierra con: botón ✕, toque en el fondo oscuro, tecla Esc, elegir una opción
   (la pantalla se vuelve a dibujar) o al agrandar la ventana a ≥ 1024px.
   Abrir/cerrar solo cambia clases del DOM: no redibuja la pantalla ni pierde el scroll.
   ========================================================== */
const AppShell = {
  open: false,

  /** sidebar: HTML del <aside class="sidebar">; page: HTML de la pantalla; title: título de la barra superior */
  render({ sidebar, page, title }) {
    this.open = false;                                  // cualquier redibujado deja el menú cerrado
    const aside = sidebar.replace(
      /<aside class="(sidebar[^"]*)">/,
      `<aside class="$1" id="app-sidebar" aria-label="Menú principal">
         <button type="button" class="sidebar-close" data-click="shell:close" aria-label="Cerrar menú">${icon("x", 20, { width: 2.4 })}</button>`
    );
    return `
      <div class="app" id="app-shell">
        <div class="shell-backdrop" data-click="shell:close"></div>
        ${aside}
        <main class="main">
          <header class="appbar">
            <button type="button" class="appbar-btn" data-click="shell:toggle" aria-controls="app-sidebar" aria-expanded="false" aria-label="Abrir menú">
              ${icon("menu", 24, { width: 2.2 })}
            </button>
            <div class="brand-logo appbar-logo"><span>E</span></div>
            <div class="appbar-title">${esc(title)}</div>
            ${ThemeToggle.render()}
          </header>
          ${page}
        </main>
      </div>`;
  },

  setOpen(open) {
    this.open = !!open;
    const app = document.getElementById("app-shell");
    if (!app) return;
    app.classList.toggle("nav-open", this.open);

    const btn = app.querySelector(".appbar-btn");
    if (btn) {
      btn.setAttribute("aria-expanded", String(this.open));
      btn.setAttribute("aria-label", this.open ? "Cerrar menú" : "Abrir menú");
    }
    const main = app.querySelector(".main");
    if (main) { if (this.open) main.setAttribute("inert", ""); else main.removeAttribute("inert"); }   // el teclado no entra al contenido de atrás

    if (this.open) {
      const first = app.querySelector(".sidebar .nav-item.active") || app.querySelector(".sidebar .nav-item");
      if (first) first.focus({ preventScroll: true });
    } else if (btn && !app.contains(document.activeElement)) {
      btn.focus({ preventScroll: true });
    }
  },

  toggle() { this.setOpen(!this.open); },
};

/** Texto de la barra superior: etiqueta de la opción activa del menú */
function navTitle(list, id) {
  const item = list.find((i) => i.id === id);
  return item ? item.label : "EventPro";
}

registerClick({
  "shell:toggle": () => AppShell.toggle(),
  "shell:close":  () => AppShell.setOpen(false),
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape" && AppShell.open) AppShell.setOpen(false); });

// Al pasar a escritorio el menú ya es fijo: se cierra el panel móvil
if (window.matchMedia) {
  const desktop = window.matchMedia("(min-width: 1024px)");
  const onChange = (e) => { if (e.matches) AppShell.setOpen(false); };
  if (desktop.addEventListener) desktop.addEventListener("change", onChange);
}
