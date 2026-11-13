/* ==========================================================
   components/search-bar.js — Barra de búsqueda amplia (con lupa)
   Es genérica: recibe los nombres de las acciones, no sabe nada del Home.
     SearchBar.render({ id, value, placeholder, input, clear, submit })
       input  → acción data-input que se dispara al escribir (recibe el <input>)
       clear  → acción data-click del botón ✕ (borrar)
       submit → acción del botón "Buscar" y de la tecla Enter
   Para no perder el foco al escribir, la página debe actualizar solo sus
   resultados (no redibujarse entera) y llamar a SearchBar.syncClear().
   ========================================================== */
const SearchBar = {
  render({ id, value = "", placeholder = "Buscar…", label = "Buscar", buttonLabel = "Buscar", input, clear, submit }) {
    return `
      <div class="sb" role="search">
        <div class="sb-field">
          <label class="sr-only" for="${id}">${esc(label)}</label>
          ${icon("search", 22, { cls: "sb-icon", width: 2.2 })}
          <input id="${id}" class="sb-input" type="text" inputmode="search" enterkeyhint="search" autocomplete="off" spellcheck="false"
                 placeholder="${esc(placeholder)}" value="${esc(value)}" data-input="${input}" data-enter="${submit}">
          <button type="button" class="sb-clear" data-click="${clear}" aria-label="Borrar búsqueda" ${value ? "" : "hidden"}>${icon("x", 16, { width: 2.6 })}</button>
        </div>
        <button type="button" class="btn btn-accent sb-submit" data-click="${submit}">${esc(buttonLabel)}</button>
      </div>`;
  },

  /** Muestra u oculta el botón ✕ según haya texto (sin tocar el input) */
  syncClear(id) {
    const input = document.getElementById(id);
    const clear = input && input.parentElement.querySelector(".sb-clear");
    if (clear) clear.hidden = !input.value;
  },
};
