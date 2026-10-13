/* ==========================================================
   pages/manager/events.js — Gestión de eventos (herramienta del Agente)
   Crear, editar, eliminar, cambiar PRECIO y DISPONIBILIDAD de inscripción.
   El precio (cover/boleta) alimenta el recaudo que ve el Admin en Finanzas.
   ========================================================== */

const eventBlank = () => ({
  name: "", type: "fiesta", date: "", time: "20:00",
  location: "", capacity: 200, registered: 0,
  status: "planificado", price: 0, availability: "open",
  coordinator: Session.user ? Session.user.name : "", description: "", image: "",
});

const MgrEventsPage = {
  /* ----- estado de la pantalla ----- */
  filter: "todos",
  typeFilter: "todos",
  search: "",
  modal: false,
  editingId: null,
  form: eventBlank(),
  formError: "",
  deleteId: null,

  filtered() {
    return Data.events.filter((e) => {
      const okStatus = this.filter === "todos" || e.status === this.filter;
      const okType   = this.typeFilter === "todos" || e.type === this.typeFilter;
      const okSearch = !this.search || matches(e.name, this.search) || matches(e.location, this.search);
      return okStatus && okType && okSearch;
    });
  },

  openNew() { this.editingId = null; this.form = eventBlank(); this.formError = ""; this.modal = true; },

  /* ----- vista ----- */
  renderCard(ev) {
    const d = parseDate(ev.date);
    const color = TYPE_COLOR[ev.type];
    const bars = [
      { label: "Inscritos",       pct: percent(ev.registered, ev.capacity), val: `${ev.registered} / ${ev.capacity}`, color },
      { label: "Recaudo estimado", pct: null,                               val: ev.price > 0 ? cop(eventRevenue(ev)) : "Gratuito", color: "#6b678f" },
    ].map((b) => `
      <div>
        <div class="ev-bar-label">${b.label}</div>
        <div class="ev-bar-value">${esc(b.val)}</div>
        ${b.pct === null ? "" : `<div class="bar"><div class="bar-fill" style="width:${b.pct}%;background:${b.color}"></div></div>`}
      </div>`).join("");

    const avail = Object.entries(AVAIL).map(([k, l]) =>
      `<button class="pill pill-sm ${ev.availability === k ? "active" : ""}" data-click="manager:avail" data-id="${ev.id}" data-value="${k}">${l}</button>`).join("");

    return `
      <div class="card ev-card">
        <div style="height:6px;background:${color}"></div>
        <div class="ev-body">
          <div class="ev-head">
            <div style="flex:1;min-width:0">
              <div class="ev-title">${esc(ev.name)}</div>
              <div class="ev-sub">${esc(TYPE_LABEL[ev.type])} · ${esc(ev.coordinator)}</div>
            </div>
            ${statusBadge(ev.status)}
          </div>
          <div class="ev-meta">
            <div class="ev-meta-row">${icon("calendar", 13)} ${d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })} · ${esc(ev.time)}</div>
            <div class="ev-meta-row">${icon("pin", 13)} <span class="ellipsis">${esc(ev.location)}</span></div>
            <div class="ev-meta-row">${icon("ticket", 13)} <strong>${esc(priceLabel(ev))}</strong> por persona</div>
          </div>
          <div class="form-grid-2" style="margin-bottom:14px">${bars}</div>
          <div class="field-label" style="margin-bottom:6px">Inscripciones</div>
          <div class="row" style="gap:6px;flex-wrap:wrap;margin-bottom:16px">${avail}</div>
          <div class="ev-actions">
            <button class="btn btn-outline btn-sm" style="flex:1" data-click="events:openEdit" data-id="${ev.id}">${icon("edit", 14)} Editar</button>
            <button class="btn btn-danger btn-sm" style="flex:1" data-click="events:askDelete" data-id="${ev.id}">${icon("trash", 14)} Eliminar</button>
          </div>
        </div>
      </div>`;
  },

  renderModal() {
    if (!this.modal) return "";
    const f = this.form;
    const H = "events:form";
    const statusOptions = { planificado: "Planificado", en_progreso: "En progreso", completado: "Completado", cancelado: "Cancelado" };

    return `
      <div class="modal-backdrop" data-click="events:closeModal" data-backdrop>
        <div class="modal" style="--w:540px" role="dialog" aria-modal="true" aria-label="${this.editingId ? "Editar evento" : "Crear evento"}">
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
              ${field("Tipo",   selectInput({ key: "type",   options: TYPE_LABEL,   value: f.type,   handler: H }))}
              ${field("Estado", selectInput({ key: "status", options: statusOptions, value: f.status, handler: H }))}
            </div>
            <div class="form-grid-2">
              ${field("Aforo (cupos)", textInput({ key: "capacity", type: "number", value: f.capacity, handler: H, number: true, extra: 'min="1"' }),
                      this.editingId ? `Mínimo ${f.registered} (inscritos actuales)` : "Máximo de personas que pueden inscribirse")}
              ${field("Precio por persona (COP)", textInput({ key: "price", type: "number", value: f.price, handler: H, number: true, extra: 'min="0" step="1000"' }),
                      "0 = evento gratuito")}
            </div>
            ${field("Inscripciones", selectInput({ key: "availability", options: AVAIL, value: f.availability, handler: H }))}
            ${field("Imagen (URL, opcional)", textInput({ key: "image", value: f.image, handler: H }))}
          </div>
          ${this.formError ? `<p class="auth-error" role="alert" style="margin-top:14px">${esc(this.formError)}</p>` : ""}
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

    const createBtn = `<button class="btn btn-primary" data-click="events:openNew">${icon("plus", 16, { width: 2.5 })} Crear evento</button>`;

    const closing = ManagerApp.find(ManagerApp.closeId);
    return `
      <div class="page" style="--w:1680px">
        ${pageHeader({ eyebrow: "Operación", title: "Gestión de eventos", subtitle: "Crea, edita y elimina eventos; cambia su precio y si aceptan inscripciones.", action: createBtn })}

        <div class="filters-stack">
          <div class="filters" style="gap:10px">
            ${searchBox({ id: "events-search", placeholder: "Buscar…", value: this.search, handler: "events:search" })}
            <div class="filters scroll-x">${statusPills}</div>
          </div>
          <div class="filters scroll-x">
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
        ${closing ? mgrModal({ title: "¿Cerrar inscripciones?", body: `<p class="modal-confirm-text">“${esc(closing.name)}” dejará de aceptar inscripciones. Puedes reabrirlas cuando quieras.</p>`, cancel: "manager:cancelClose", confirm: "manager:confirmClose", label: "Sí, cerrar" }) : ""}
      </div>`;
  },
};

/* ----- acciones ----- */
bindForm("events:form", () => MgrEventsPage.form);

registerInput({
  "events:search": (el) => { MgrEventsPage.search = el.value; rerender(); },
});

registerClick({
  "events:filter": (el) => { MgrEventsPage.filter = el.dataset.value; rerender(); },
  "events:type":   (el) => { MgrEventsPage.typeFilter = el.dataset.value; rerender(); },

  "events:openNew": () => { MgrEventsPage.openNew(); rerender(); },
  "events:openEdit": (el) => {
    const ev = ManagerApp.find(el.dataset.id);
    if (!ev) return;
    const { id, ...rest } = ev;
    MgrEventsPage.editingId = id;
    MgrEventsPage.form = { ...rest };
    MgrEventsPage.formError = "";
    MgrEventsPage.modal = true;
    rerender();
  },
  "events:closeModal": () => { MgrEventsPage.modal = false; rerender(); },

  "events:save": () => {
    const f = MgrEventsPage.form;
    const fail = (msg) => { MgrEventsPage.formError = msg; rerender(); };
    if (!f.name.trim() || !f.date) return fail("El nombre y la fecha son obligatorios.");
    if (!(f.capacity >= 1)) return fail("El aforo debe ser de al menos 1 cupo.");
    if (f.capacity < f.registered) return fail(`El aforo no puede ser menor a los ${f.registered} inscritos.`);
    if (!(f.price >= 0)) return fail("El precio no puede ser negativo.");

    const data = { ...f, name: f.name.trim(), image: f.image.trim() || TYPE_IMAGES[f.type] };
    if (MgrEventsPage.editingId) {
      Data.events = Data.events.map((e) => (e.id === MgrEventsPage.editingId ? { ...e, ...data, id: e.id } : e));
      // Mantiene el nombre del evento en la lista de asistentes
      Data.attendees.forEach((a) => { if (a.eventId === MgrEventsPage.editingId) a.eventName = data.name; });
    } else {
      Data.events = [...Data.events, { ...data, id: "e" + Date.now(), registered: 0, is_public: true, featured: false }];
    }
    MgrEventsPage.modal = false;
    rerender();
  },

  "events:askDelete":     (el) => { MgrEventsPage.deleteId = el.dataset.id; rerender(); },
  "events:cancelDelete":  () => { MgrEventsPage.deleteId = null; rerender(); },
  "events:confirmDelete": () => {
    const id = MgrEventsPage.deleteId;
    Data.events = Data.events.filter((e) => e.id !== id);
    Data.attendees = Data.attendees.filter((a) => a.eventId !== id);          // sus asistentes ya no existen
    UserApp.registrations = UserApp.registrations.filter((x) => x !== id);    // ni las inscripciones del usuario
    MgrEventsPage.deleteId = null;
    rerender();
  },

  /* disponibilidad de inscripción (cerrar pide confirmación) */
  "manager:avail": (el) => {
    const ev = ManagerApp.find(el.dataset.id); if (!ev) return;
    if (el.dataset.value === "closed" && ev.availability !== "closed") ManagerApp.closeId = ev.id; else ev.availability = el.dataset.value;
    rerender();
  },
  "manager:confirmClose": () => { const ev = ManagerApp.find(ManagerApp.closeId); if (ev) ev.availability = "closed"; ManagerApp.closeId = null; rerender(); },
  "manager:cancelClose":  () => { ManagerApp.closeId = null; rerender(); },
});
