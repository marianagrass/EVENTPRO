/* ==========================================================
   components/footer.js — Footer público de EventPro
   4 columnas en escritorio (marca · enlaces rápidos · soporte y
   contacto · legal), 2 en tablet y 1 apilada en móvil.
   Se integra UNA sola vez, en PublicLayout (components/public-layout.js),
   y así aparece en todas las vistas públicas.
   ========================================================== */

/* ---------- Contenido (edítalo aquí) ---------- */
const FOOTER_LINKS = {
  quick: [
    { label: "Explorar eventos", href: "#g-events", click: "footer:scroll", target: "g-events" },
    // "Calendario" es solo para cuentas: el guard pide iniciar sesión y muestra este mensaje
    { label: "Calendario", href: "#", click: "guest:calendar", requiresAuth: true, reason: "Inicia sesión para ver el calendario de eventos." },
    { label: "Crear cuenta", href: "#", click: "auth:open" },
    { label: "Portal de organizadores (Agentes)", href: "#", click: "auth:open", suggest: "manager",
      reason: "El portal de organizadores es para Agentes. Elige «Agente» para continuar." },
  ],
  support: [
    { label: "Preguntas frecuentes (FAQ)", href: "#g-faq", click: "footer:scroll", target: "g-faq" },
    { label: "Ayuda", href: "#", click: "notice:open", key: "help" },
  ],
  legal: [
    { label: "Términos y condiciones", href: "#", click: "notice:open", key: "terms" },
    { label: "Política de privacidad", href: "#", click: "notice:open", key: "privacy" },
  ],
};

// Redes sociales (enlaces de ejemplo: reemplázalos por las cuentas reales de EventPro)
const FOOTER_SOCIAL = [
  { name: "Instagram", url: "https://www.instagram.com/",
    svg: '<rect x="2.5" y="2.5" width="19" height="19" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.6" cy="6.4" r=".6" fill="currentColor"/>' },
  { name: "TikTok", url: "https://www.tiktok.com/",
    svg: '<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>' },
  { name: "X", url: "https://x.com/", fill: true,
    svg: '<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>' },
];

// Textos de los enlaces simulados que abren un aviso (modal)
const NOTICES = {
  help:    { title: "Centro de ayuda", text: "Estamos preparando el centro de ayuda. Mientras tanto, revisa las preguntas frecuentes o escríbenos a ayuda@eventpro.example (correo de ejemplo)." },
  terms:   { title: "Términos y condiciones", text: "Este documento está en construcción. Aquí publicaremos las reglas de uso de la plataforma." },
  privacy: { title: "Política de privacidad", text: "Este documento está en construcción. Aquí explicaremos cómo se usan y protegen tus datos." },
};

/* ---------- Modal de avisos (Ayuda, Términos, Privacidad) ---------- */
const Notice = {
  key: null,
  modal() {
    if (!this.key) return "";
    const n = NOTICES[this.key];
    return `
      <div class="modal-backdrop" data-click="notice:close" data-backdrop>
        <div class="modal modal-confirm" style="max-width:440px" role="dialog" aria-modal="true" aria-label="${esc(n.title)}">
          <h3 class="modal-confirm-title">${esc(n.title)}</h3>
          <p class="modal-confirm-text" style="margin-bottom:22px">${esc(n.text)}</p>
          <button class="btn btn-primary btn-block" data-click="notice:close">Entendido</button>
        </div>
      </div>`;
  },
};

/* ---------- Footer ---------- */
const PublicFooter = {
  link(l) {
    const attrs = [
      `href="${esc(l.href || "#")}"`,
      `data-click="${l.click}"`,
      l.target ? `data-target="${l.target}"` : "",
      l.key ? `data-key="${l.key}"` : "",
      l.reason ? `data-reason="${esc(l.reason)}"` : "",
      l.suggest ? `data-suggest="${l.suggest}"` : "",
      l.requiresAuth ? "data-requires-auth" : "",
    ].filter(Boolean).join(" ");
    return `<li><a ${attrs}>${esc(l.label)}</a></li>`;
  },

  column(id, title, links, extra = "") {
    return `
      <nav class="pf-col" aria-labelledby="${id}">
        <h3 id="${id}">${title}</h3>
        <ul>${links.map((l) => this.link(l)).join("")}</ul>
        ${extra}
      </nav>`;
  },

  render() {
    const social = FOOTER_SOCIAL.map((s) => `
      <a href="${s.url}" target="_blank" rel="noopener noreferrer" aria-label="${s.name}" title="${s.name}">
        <svg width="20" height="20" viewBox="0 0 24 24" ${s.fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"'}>${s.svg}</svg>
      </a>`).join("");

    return `
      <footer class="pf" id="g-footer">
        <div class="pf-glow" aria-hidden="true"></div>
        <div class="pf-inner">
          <div class="pf-grid">

            <div class="pf-col pf-brand">
              <div class="g-brand"><div class="brand-logo"><span>E</span></div><div class="brand-name">EventPro</div></div>
              <p>EventPro es la plataforma central para descubrir y vivir los mejores eventos universitarios:
                 conciertos, torneos, congresos y todo lo que pasa en tu campus, en un solo lugar.</p>
            </div>

            ${this.column("pf-h-quick", "Enlaces rápidos", FOOTER_LINKS.quick)}
            ${this.column("pf-h-support", "Soporte y contacto", FOOTER_LINKS.support,
                `<div class="pf-social" aria-label="Redes sociales">${social}</div>`)}
            ${this.column("pf-h-legal", "Legal", FOOTER_LINKS.legal)}

          </div>

          <div class="pf-bottom">
            <span>© ${new Date().getFullYear()} EventPro. Todos los derechos reservados.</span>
            <a href="#" class="pf-top" data-click="footer:top">Volver arriba ${icon("right", 14, { width: 2.6, style: "transform:rotate(-90deg)" })}</a>
          </div>
        </div>
      </footer>`;
  },
};

registerClick({
  "footer:scroll": (el, e) => {
    e.preventDefault();
    const t = document.getElementById(el.dataset.target);
    if (t) t.scrollIntoView({ behavior: "smooth", block: "start" });
  },
  "footer:top": (el, e) => {
    e.preventDefault();
    const main = document.querySelector(".main.guest");
    if (main) main.scrollTo({ top: 0, behavior: "smooth" });
  },
  "notice:open": (el, e) => { e.preventDefault(); Notice.key = el.dataset.key; rerender(); },
  "notice:close": () => { Notice.key = null; rerender(); },

  // "Calendario": el guard ya pidió login; si hay sesión, llevamos a la pantalla que corresponda
  "guest:calendar": (el, e) => {
    e.preventDefault();
    if (Session.role === "admin") { App.mode = "admin"; App.adminView = "calendar"; }
    else if (Session.role !== "guest") App.mode = Session.role;
    App.render({ resetScroll: true });
  },
});
