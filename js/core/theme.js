/* ==========================================================
   core/theme.js — Estado del tema (claro / oscuro)
   Equivale a un ThemeProvider + useTheme():
     Theme.get()        → "light" | "dark"
     Theme.isDark()     → boolean
     Theme.set("dark")  → cambia, guarda y repinta los toggles
     Theme.toggle()     → alterna
   Cómo funciona:
     1) El tema vive en <html data-theme="light|dark">. Los colores salen de variables CSS
        (css/base.css): en modo oscuro se redefinen las mismas variables.
     2) La elección se guarda en localStorage ("eventpro-theme").
     3) Sin elección guardada se usa la preferencia del sistema (prefers-color-scheme)
        y se sigue si el sistema cambia.
     4) Un script mínimo en <head> (index.html) aplica el tema antes de pintar: sin parpadeo.
   ========================================================== */
const Theme = {
  KEY: "eventpro-theme",
  mq: window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null,
  _timer: null,

  stored() {
    try { const v = localStorage.getItem(this.KEY); return v === "light" || v === "dark" ? v : null; }
    catch (_) { return null; }                       // localStorage bloqueado: seguimos sin guardar
  },
  system() { return this.mq && this.mq.matches ? "dark" : "light"; },
  get()    { return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"; },
  isDark() { return this.get() === "dark"; },

  set(mode, { persist = true, animate = true } = {}) {
    mode = mode === "dark" ? "dark" : "light";
    const root = document.documentElement;

    // Transición suave de colores solo durante el cambio (y solo si el usuario no pidió menos movimiento)
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (animate && !reduce) {
      root.classList.add("theme-anim");
      clearTimeout(this._timer);
      this._timer = setTimeout(() => root.classList.remove("theme-anim"), 450);
    }

    root.setAttribute("data-theme", mode);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", mode === "dark" ? "#121218" : "#6a2cff");
    if (persist) { try { localStorage.setItem(this.KEY, mode); } catch (_) { /* sin almacenamiento */ } }
    this.paintToggles();
  },

  toggle() { this.set(this.isDark() ? "light" : "dark"); },

  /** Mantiene al día el estado accesible de todos los botones de tema que estén en pantalla */
  paintToggles() {
    const dark = this.isDark();
    document.querySelectorAll(".theme-toggle").forEach((btn) => {
      btn.setAttribute("aria-checked", String(dark));
      btn.setAttribute("aria-label", dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
      btn.title = dark ? "Modo claro" : "Modo oscuro";
    });
  },

  init() {
    this.set(this.stored() || this.system(), { persist: false, animate: false });
    if (this.mq && this.mq.addEventListener) {
      this.mq.addEventListener("change", (e) => {
        if (!this.stored()) this.set(e.matches ? "dark" : "light", { persist: false });   // solo si el usuario no eligió
      });
    }
  },
};

registerClick({ "theme:toggle": () => Theme.toggle() });
Theme.init();
