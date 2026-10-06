/* ==========================================================
   pages/admin/events.js — Gestión de eventos (crear, editar, eliminar, filtrar)
   ========================================================== */

const eventBlank = () => ({
  name: "", type: "academico", date: "", time: "09:00",
  location: "", capacity: 100, registered: 0,
  status: "planificado", budget: 0, spent: 0,
  coordinator: "", description: "", image: "",
});

const EventsPage = {
  /* ----- estado de la pantalla ----- */
  filter: "todos",
  typeFilter: "todos",
  search: "",
  modal: false,
  editingId: null,
  form: eventBlank(),
  deleteId: null,

  isAdmin() { return App.role === "admin"; },

  filtered() {
    return Data.events.filter((e) => {
      const okStatus = this.filter === "todos" || e.status === this.filter;
      const okType   = this.typeFilter === "todos" || e.type === this.typeFilter;
      const okSearch = !this.search || matches(e.name, this.search) || matches(e.location, this.search);
      return okStatus && okType && okSearch;
    });
  },

  /* ----- vista ----- */
  renderCard(ev) {
    const d = parseDate(ev.date);
    const color = TYPE_COLOR[ev.type];
    const bars = [
      { label: "Asistentes",  pct: percent(ev.registered, ev.capacity), val: `${ev.registered} / ${ev.capacity}`,    color },
      { label: "Presupuesto", pct: percent(ev.spent, ev.budget),        val: `${cop(ev.spent)} / ${cop(ev.budget)}`, color: "#889063" },
    ].map((b) => `
      <div>
        <div class="ev-bar-label">${b.label}</div>
        <div class="ev-bar-value">${esc(b.val)}</div>
        <div class="bar"><div class="bar-fill" style="width:${b.pct}%;background:${b.color}"></div></div>
      </div>`).join("");

    const actions = this.isAdmin()
      ? `<button class="btn btn-outline btn-sm" style="flex:1" data-click="events:openEdit" data-id="${ev.id}">Editar</button>
         <button class="btn btn-danger btn-sm" style="flex:1" data-click="events:askDelete" data-id="${ev.id}">Eliminar</button>`
      : `<span class="readonly">Solo lectura</span>`;

    return `
      <div class="card ev-card">
        <div style="height:6px;background:${color}"></div>
        <div class="ev-body">
          <div class="ev-head">
            <div style="flex:1;min-width:0">
              <div class="ev-title">${esc(ev.name)}</div>
              <div class="ev-sub">${TYPE_LABEL[ev.type]} · ${esc(ev.coordinator)}</div>
            </div>
            ${statusBadge(ev.status)}
          </div>
          <div class="ev-meta">
            <div class="ev-meta-row">${icon("calendar", 13)} ${d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })} · ${esc(ev.time)}</div>
            <div class="ev-meta-row">${icon("pin", 13)} <span class="ellipsis">${esc(ev.location)}</span></div>
          </div>
          <div class="form-grid-2" style="margin-bottom:16px">${bars}</div>
          <div class="ev-actions">${actions}</div>
        </div>
      </div>`;
  },

  renderModal() {
    if (!this.modal) return "";
    const f = this.form;
    const H = "events:form";
    const typeOptions = TYPE_LABEL;
    const statusOptions = { planificado: "Planificado", en_progreso: "En progreso", completado: "Completado", cancelado: "Cancelado" };

    return `
      <div class="modal-backdrop" data-click="events:closeModal" data-backdrop>
        <div class="modal" style="--w:540px">
          <h2 class="modal-title">${this.editingId ? "Editar evento" : "Crear evento"}</h2>
          <div class="form-stack">
            ${field("Nombre del evento", textInput({ key: "name", value: f.name, handler: H }))}
            ${field("Coordinador",       textInput({ key: "coordinator", value: f.coordinator, handler: H }))}
            ${field("Ubicación",         textInput({ key: "location", value: f.location, handler: H }))}
            ${field("Descripción",       textInput({ key: "description", value: f.description, handler: H }))}
            <div class="form-grid-2">
              ${field("Fecha", textInput({ key: "date", type: "date", value: f.date, handler: H }))}
              ${field("Hora",  textInput({ key: "time", type: "time", value: f.time, handler: H }))}
            </div>
            <div class="form-grid-2">
              ${field("Tipo",   selectInput({ key: "type",   options: typeOptions,   value: f.type,   handler: H }))}
              ${field("Estado", selectInput({ key: "status", options: statusOptions, value: f.status, handler: H }))}
            </div>
            ${field("Límite de asistentes",
                    textInput({ key: "capacity", type: "number", value: f.capacity, handler: H, number: true, extra: 'min="1"' }),
                    "Máximo de personas que pueden inscribirse al evento")}
            <div class="form-grid-2">
              ${field("Presupuesto (COP $)", textInput({ key: "budget", type: "number", value: f.budget, handler: H, number: true }))}
              ${field("Gastado (COP $)",     textInput({ key: "spent",  type: "number", value: f.spent,  handler: H, number: true }))}
            </div>
          </div>
          <div class="modal-form-actions">
            <button class="btn btn-outline btn-block" data-click="events:closeModal">Cancelar</button>
            <button class="btn btn-primary btn-block" data-click="events:save">${this.editingId ? "Guardar cambios" : "Crear evento"}</button>
          </div>
        </div>
      </div>`;
  },

  render() {
    const list = this.filtered();

    const statusPills = ["todos", "planificado", "en_progreso", "completado"].map((f) => `
      <button class="pill ${this.filter === f ? "active" : ""}" data-click="events:filter" data-value="${f}">
        ${f === "todos" ? "Todos" : STATUS_TEXT[f]}
      </button>`).join("");

    const typePills = Object.entries(TYPE_LABEL).map(([k, label]) => {
      const active = this.typeFilter === k;
      return `
        <button class="pill pill-sm ${active ? "active" : ""}" data-click="events:type" data-value="${k}"
                ${active ? `style="background:${TYPE_COLOR[k]}"` : ""}>
          <span class="pill-dot" style="background:${active ? "rgba(255,255,255,.5)" : TYPE_COLOR[k]}"></span>${label}
        </button>`;
    }).join("");

    const createBtn = this.isAdmin()
      ? `<button class="btn btn-primary" data-click="events:openNew">${icon("plus", 16, { width: 2.5 })} Crear evento</button>`
      : "";

    return `
      <div class="page" style="--w:1200px">
        ${pageHeader({ eyebrow: "Gestión", title: "Eventos", action: createBtn })}

        <div class="filters-stack">
          <div class="filters" style="gap:10px">
            ${searchBox({ id: "events-search", placeholder: "Buscar…", value: this.search, handler: "events:search" })}
            <div class="filters">${statusPills}</div>
          </div>
          <div class="filters">
            <button class="pill pill-sm pill-brown ${this.typeFilter === "todos" ? "active" : ""}" data-click="events:type" data-value="todos">Todos los tipos</button>
            ${typePills}
          </div>
        </div>

        <div class="grid-cards">${list.map((ev) => this.renderCard(ev)).join("")}</div>

        ${list.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-title">Sin resultados</div>
            <div class="empty-state-text">Prueba con otro filtro o crea un evento nuevo</div>
          </div>` : ""}

        ${this.renderModal()}
        ${this.deleteId ? confirmModal({ title: "¿Eliminar evento?", cancelAction: "events:cancelDelete", confirmAction: "events:confirmDelete" }) : ""}
      </div>`;
  },
};

/* ----- acciones ----- */
bindForm("events:form", () => EventsPage.form);

registerInput({
  "events:search": (el) => { EventsPage.search = el.value; rerender(); },
});

registerClick({
  "events:filter": (el) => { EventsPage.filter = el.dataset.value; rerender(); },
  "events:type":   (el) => { EventsPage.typeFilter = el.dataset.value; rerender(); },

  "events:openNew": () => {
    EventsPage.editingId = null;
    EventsPage.form = eventBlank();
    EventsPage.modal = true;
    rerender();
  },
  "events:openEdit": (el) => {
    const ev = Data.events.find((e) => e.id === el.dataset.id);
    const { id, ...rest } = ev;
    EventsPage.editingId = id;
    EventsPage.form = rest;
    EventsPage.modal = true;
    rerender();
  },
  "events:closeModal": () => { EventsPage.modal = false; rerender(); },

  "events:save": () => {
    const f = EventsPage.form;
    if (!f.name || !f.date) return;
    const data = { ...f, image: f.image || TYPE_IMAGES[f.type] };
    if (EventsPage.editingId) {
      Data.events = Data.events.map((e) => (e.id === EventsPage.editingId ? { ...data, id: e.id } : e));
    } else {
      Data.events = [...Data.events, { ...data, id: "e" + Date.now() }];
    }
    EventsPage.modal = false;
    rerender();
  },

  "events:askDelete":     (el) => { EventsPage.deleteId = el.dataset.id; rerender(); },
  "events:cancelDelete":  () => { EventsPage.deleteId = null; rerender(); },
  "events:confirmDelete": () => {
    Data.events = Data.events.filter((e) => e.id !== EventsPage.deleteId);
    EventsPage.deleteId = null;
    rerender();
  },
});
