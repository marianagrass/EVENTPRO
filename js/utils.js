/* ==========================================================
   utils.js — Funciones auxiliares, iconos y manejo de eventos
   ========================================================== */

/* ---------- Formato ---------- */
function cop(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(value);
}

// Convierte "2026-09-15" en un Date a medianoche local
function parseDate(str) { return new Date(str + "T00:00:00"); }

function percent(part, total) { return total ? Math.round((part / total) * 100) : 0; }

// Escapa texto para insertarlo de forma segura dentro de HTML
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function matches(text, query) { return String(text).toLowerCase().includes(query.toLowerCase()); }

function initials(name) { return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase(); }

const AVATAR_COLORS = ["#354024", "#4c3d19", "#889063", "#6b5626", "#4a5a33"];
function avatarColor(name) { return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]; }

/* ---------- Iconos SVG ---------- */
const ICON_PATHS = {
  home:     '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  clock:    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  users:    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  tasks:    '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  chat:     '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  user:     '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  shield:   '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  search:   '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  plus:     '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  right:    '<polyline points="9 18 15 12 9 6"/>',
  left:     '<polyline points="15 18 9 12 15 6"/>',
  pin:      '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  check:    '<polyline points="20 6 9 17 4 12"/>',
  send:     '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  // Iconos de las tarjetas de resumen (estilo Lucide: trazo 2, sin relleno)
  compass:  '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
  ticket:   '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="m9 12 2 2 4-4"/>',
  "calendar-days": '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/>',
};

/**
 * icon("home", 20)  ->  <svg> listo para insertar.
 * opciones: color (por defecto currentColor), width (grosor del trazo), cls, style
 */
function icon(name, size = 16, opts = {}) {
  const { color = "currentColor", width = 2, cls = "", style = "" } = opts;
  return `<svg class="${cls}" style="${style}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name]}</svg>`;
}

/* ---------- Componentes HTML reutilizables ---------- */

/**
 * StatCard({ label, value, icon, color })
 * Tarjeta de métrica del dashboard. El icono es un SVG (ver ICON_PATHS),
 * dentro de un contenedor con fondo suave del mismo tono de la métrica.
 */
function StatCard({ label, value, icon: iconName, color }) {
  return `
    <div class="stat-pill">
      <span class="stat-icon" style="--stat-color:${color}">${icon(iconName, 20, { color, width: 1.75 })}</span>
      <div>
        <div class="stat-pill-value" style="color:${color}">${value}</div>
        <div class="stat-pill-label">${esc(label)}</div>
      </div>
    </div>`;
}
function statusBadge(status) {
  return `<span class="badge st-${esc(status)}">${esc(STATUS_TEXT[status] || status)}</span>`;
}

function pageHeader({ eyebrow, title, subtitle = "", action = "" }) {
  return `
    <div class="page-header">
      <div>
        <div class="eyebrow">${eyebrow}</div>
        <h1 class="page-title">${title}</h1>
        ${subtitle ? `<p class="page-subtitle">${subtitle}</p>` : ""}
      </div>
      ${action}
    </div>`;
}

function searchBox({ id, placeholder, value, handler, maxWidth = 360, large = false }) {
  return `
    <div class="search" style="max-width:${maxWidth}px">
      ${icon("search", 16, { color: "#cfbb99", cls: "search-icon" })}
      <input id="${id}" type="text" class="input ${large ? "input-lg" : ""}" placeholder="${esc(placeholder)}"
             value="${esc(value)}" data-input="${handler}" autocomplete="off">
    </div>`;
}

function field(label, controlHtml, hint = "") {
  return `<div><label class="field-label">${label}</label>${controlHtml}${hint ? `<p class="field-hint">${hint}</p>` : ""}</div>`;
}

function textInput({ key, type = "text", value, handler, number = false, extra = "" }) {
  return `<input class="input" type="${type}" value="${esc(value)}" data-input="${handler}" data-key="${key}" ${number ? "data-number" : ""} ${extra}>`;
}

function selectInput({ key, options, value, handler }) {
  const opts = Object.entries(options)
    .map(([k, label]) => `<option value="${esc(k)}" ${k === value ? "selected" : ""}>${esc(label)}</option>`)
    .join("");
  return `<select class="input" data-input="${handler}" data-key="${key}">${opts}</select>`;
}

function confirmModal({ title, cancelAction, confirmAction, confirmLabel = "Sí, eliminar" }) {
  return `
    <div class="modal-backdrop" data-click="${cancelAction}" data-backdrop>
      <div class="modal modal-confirm">
        <h3 class="modal-confirm-title">${title}</h3>
        <p class="modal-confirm-text">Esta acción no se puede deshacer.</p>
        <div class="modal-actions">
          <button class="btn btn-outline btn-block" data-click="${cancelAction}">Cancelar</button>
          <button class="btn btn-danger btn-block" data-click="${confirmAction}">${confirmLabel}</button>
        </div>
      </div>
    </div>`;
}

/* ---------- Eventos del DOM (delegación) ----------
   En el HTML usamos atributos:  data-click="pagina:accion"   data-input="pagina:campo"
   y registramos las funciones con registerClick / registerInput.            */
const Handlers = { click: {}, input: {}, enter: {} };
function registerClick(map) { Object.assign(Handlers.click, map); }
function registerInput(map) { Object.assign(Handlers.input, map); }
function registerEnter(map) { Object.assign(Handlers.enter, map); }

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-click]");
  if (!el || el.disabled) return;
  // Guard: acciones marcadas data-requires-auth exigen sesión (Home público)
  if (el.hasAttribute("data-requires-auth") && !Session.isAuthenticated) { Guard.promptLogin(el); return; }
  // Los fondos de modal solo reaccionan si el clic fue en el fondo, no dentro de la tarjeta
  if (el.hasAttribute("data-backdrop") && e.target !== el) return;
  const fn = Handlers.click[el.dataset.click];
  if (fn) fn(el, e);
});

document.addEventListener("input", (e) => {
  const el = e.target.closest("[data-input]");
  if (!el) return;
  const fn = Handlers.input[el.dataset.input];
  if (fn) fn(el, e);
});

document.addEventListener("keydown", (e) => {
  const el = e.target.closest("[data-enter]");
  if (!el || e.key !== "Enter" || e.shiftKey) return;
  const fn = Handlers.enter[el.dataset.enter];
  if (fn) { e.preventDefault(); fn(el, e); }
});

// Actualiza un campo de formulario (modal) sin volver a dibujar la página
function bindForm(handlerName, getForm) {
  registerInput({
    [handlerName]: (el) => {
      getForm()[el.dataset.key] = el.hasAttribute("data-number") ? +el.value : el.value;
    },
  });
}
