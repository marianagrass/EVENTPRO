/* ==========================================================
   components/category-filters.js — Píldoras de categorías (chips clickeables)
     CategoryFilters.render({ id, categories, active, counts, action })
       categories → [{ id, label, color, gradient }]   (ej. HOME_CATEGORIES)
       active     → id de la categoría activa ("todos" = ninguna)
       counts     → { todos: 7, academico: 3, … }  (número que se muestra en cada píldora)
       action     → acción data-click; recibe data-value = id de la píldora
   La píldora activa se resalta con el degradado de su categoría.
   CategoryFilters.pills(...) devuelve solo las píldoras: sirve para
   repintarlas sin volver a dibujar el contenedor.
   ========================================================== */
const CategoryFilters = {
  pill({ id, label, color, gradient }, active, count, action) {
    const on = active === id;
    return `
      <button type="button" class="cf-pill ${on ? "is-active" : ""}" aria-pressed="${on}" data-click="${action}" data-value="${id}"
              ${count === 0 && !on ? 'data-empty="true"' : ""} style="--c:${color};--g:${gradient}">
        <span class="cf-dot"></span>${esc(label)}<span class="cf-count">${count}</span>
      </button>`;
  },

  pills({ categories, active = "todos", counts = {}, action }) {
    const all = { id: "todos", label: "Todos", color: "#6a2cff", gradient: "var(--grad-primary)" };
    return [all, ...categories].map((c) => this.pill(c, active, counts[c.id] ?? 0, action)).join("");
  },

  render({ id, label = "Filtrar por categoría", ...rest }) {
    return `<div class="cf" id="${id}" role="group" aria-label="${esc(label)}">${this.pills(rest)}</div>`;
  },
};
