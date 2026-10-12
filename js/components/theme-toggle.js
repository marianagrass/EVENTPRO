/* ==========================================================
   components/theme-toggle.js — Botón (switch) sol ☀ / luna ☾
   Uso: ${ThemeToggle.render()}  en el Navbar y en los menús laterales.
   Cambiar el tema NO vuelve a dibujar la página (lo hace el CSS), así
   el carrusel y lo que el usuario estaba escribiendo no se interrumpen.
   ========================================================== */
const ThemeToggle = {
  render({ cls = "" } = {}) {
    const dark = Theme.isDark();
    return `
      <button type="button" class="theme-toggle ${cls}" role="switch" aria-checked="${dark}"
              aria-label="${dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}"
              title="${dark ? "Modo claro" : "Modo oscuro"}" data-click="theme:toggle">
        <span class="tt-track">
          <span class="tt-hint tt-hint-sun">${icon("sun", 14, { width: 2.2 })}</span>
          <span class="tt-hint tt-hint-moon">${icon("moon", 14, { width: 2.2 })}</span>
          <span class="tt-knob">
            <span class="tt-ic tt-ic-sun">${icon("sun", 15, { width: 2.4 })}</span>
            <span class="tt-ic tt-ic-moon">${icon("moon", 15, { width: 2.4 })}</span>
          </span>
        </span>
      </button>`;
  },
};
