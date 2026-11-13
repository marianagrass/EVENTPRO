/* ==========================================================
   pages/manager/events.js — Gestión de eventos (herramienta del Agente)
   TABLA de eventos con buscador por nombre y filtro por rango de fechas (Desde / Hasta), más los filtros de estado y tipo.
   Crear, editar, cancelar (con causa), cambiar PRECIO y DISPONIBILIDAD de inscripción.
   El precio (cover/boleta) alimenta el recaudo que ve el Admin en Finanzas.
   ========================================================== */

const eventBlank = () => ({
  name: "", type: "fiesta", date: "", time: "20:00", end_time: "", cityId: "",
  location: "", capacity: 200, registered: 0, price: 0,
  description: "", observaciones: "",
});
/** Lista de ciudades (tabla CIUDAD) como <option>; la primera vacía obliga a elegir */
const cityOptionsHtml = (value) => `<option value="">Selecciona la ciudad…</option>` + (Data.cities || []).map((c) =>
  `<option value="${esc(c.id)}" ${String(c.id) === String(value) ? "selected" : ""}>${esc(c.name)} · ${esc(c.department)}</option>`).join("");

const MgrEventsPage = {
  /* ----- estado de la pantalla ----- */
  filter: "todos",
  typeFilter: "todos",
  search: "",                 // texto del buscador (nombre del evento)
  dateFrom: "",               // filtro por rango de fechas, formato AAAA-MM-DD (vacío = sin límite)
  dateTo: "",
  sortDir: "asc",             // orden de la columna Fecha: asc (próximos primero) | desc
  manageId: null,             // evento abierto en «Gestionar inscripciones»
  modal: false,
  editingId: null,
  form: eventBlank(),
  formError: "",
  cancelId: null,
  cancelCausa: "",
  cancelError: "",
  cancelBusy: false,
  saving: false,

  /** ¿El rango de fechas está al revés (Hasta anterior a Desde)? */
  rangeInvalid() { return !!(this.dateFrom && this.dateTo && this.dateFrom > this.dateTo); },

  /** Eventos que cumplen TODOS los filtros activos (estado, tipo, nombre y rango de fechas), ordenados por fecha. */
  filtered() {
    if (this.rangeInvalid()) return [];
    const q = normalize(this.search.trim());
    const dir = this.sortDir === "desc" ? -1 : 1;
    return Data.events
      .filter((e) => {
        const okStatus = this.filter === "todos" || e.status === this.filter;
        const okType   = this.typeFilter === "todos" || e.type === this.typeFilter;
        const okName   = !q || normalize(e.name).includes(q);                       // sin distinguir mayúsculas ni tildes
        const okFrom   = !this.dateFrom || e.date >= this.dateFrom;                 // las fechas ISO se comparan como texto
        const okTo     = !this.dateTo || e.date <= this.dateTo;
        return okStatus && okType && okName && okFrom && okTo;
      })
      .sort((x, y) => dir * (`${x.date} ${x.time || ""}`.localeCompare(`${y.date} ${y.time || ""}`) || x.name.localeCompare(y.name, "es")));
  },
  hasFilters() { return !!(this.search || this.dateFrom || this.dateTo || this.filter !== "todos" || this.typeFilter !== "todos"); },

  /** Redibuja SOLO la tabla (no la página): así el campo que se está escribiendo no pierde el foco. */
  refreshList() {
    const host = document.getElementById("ev-list");
    if (!host) return rerender();
    host.innerHTML = this.listHtml();
    const clear = document.getElementById("events-clear");                         // «Limpiar filtros» se habilita en cuanto hay algún filtro
    if (clear) clear.disabled = !this.hasFilters();
  },

  openNew() { this.editingId = null; this.form = eventBlank(); this.formError = ""; this.modal = true; PriceIdeal.start(); },

  /* ----- vista ----- */
  /** Una fila de la tabla: Nombre · Fecha · Lugar · Cupos disponibles · Estado · Acciones */
  renderRow(ev) {
    const d = parseDate(ev.date), color = TYPE_COLOR[ev.type], cancelled = ev.status === "cancelado";
    const left = Math.max(0, ev.capacity - ev.registered), pct = percent(ev.registered, ev.capacity);
    const tone = left === 0 ? "var(--danger)" : pct >= 85 ? "#c77700" : "#0a7a6a";
    return `<tr class="${cancelled ? "ev-row-off" : ""}">
      <td><div class="ev-name-cell"><span class="ev-dot" style="background:${color}"></span><div style="min-width:0"><div class="ev-title ellipsis" title="${esc(ev.name)}">${esc(ev.name)}</div><div class="ev-sub">${esc(TYPE_LABEL[ev.type])}</div></div></div></td>
      <td><div class="ev-date">${d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}</div><div class="ev-sub">${esc(ev.time || "")}${ev.end_time ? ` – ${esc(ev.end_time)}` : ""}</div></td>
      <td><span class="ev-place" title="${esc(ev.location)}">${esc(ev.location)}</span></td>
      <td><div class="ev-spots"><span style="color:${tone};font-weight:600">${left === 0 ? "Agotado" : left}</span><span class="ev-sub"> de ${ev.capacity}</span></div>
          <div class="bar ev-spots-bar" aria-hidden="true"><div class="bar-fill" style="width:${pct}%;background:${tone}"></div></div></td>
      <td>${statusBadge(ev.status)}${cancelled ? "" : `<div class="ev-sub" style="margin-top:4px">Inscripciones: <span class="avail-text avail-text-${esc(ev.availability)}">${esc((AVAIL[ev.availability] || "").toLowerCase())}</span></div>`}</td>
      <td><div class="ev-actions-cell">
        <button class="icon-btn" data-click="events:openEdit" data-id="${ev.id}" ${cancelled ? "disabled" : ""} title="Editar evento" aria-label="Editar ${esc(ev.name)}">${icon("edit", 16)}</button>
        <button class="icon-btn" data-click="events:openManage" data-id="${ev.id}" ${cancelled ? "disabled" : ""} title="Gestionar inscripciones" aria-label="Gestionar inscripciones de ${esc(ev.name)}">${icon("settings", 16)}</button>
        ${cancelled
          ? `<span class="readonly ev-cause" title="${esc(ev.cancel_reason || "")}">Causa: ${esc((ev.cancel_reason || "—").slice(0, 28))}</span>`
          : `<button class="icon-btn icon-btn-danger" data-click="events:askCancel" data-id="${ev.id}" title="Cancelar evento" aria-label="Cancelar ${esc(ev.name)}">${icon("x", 16)}</button>`}
      </div></td></tr>`;
  },

  /** Tabla + contador + estados vacíos. Vive dentro de #ev-list para poder redibujarse sola (refreshList). */
  listHtml() {
    const list = this.filtered(), total = Data.events.length;
    const sortIcon = this.sortDir === "asc" ? "↑" : "↓";
    let empty = "";
    if (this.rangeInvalid()) empty = `<div class="empty-state"><div class="empty-state-title">Rango de fechas inválido</div><div class="empty-state-text">La fecha «Hasta» es anterior a «Desde». Corrige una de las dos.</div></div>`;
    else if (!list.length) empty = `<div class="empty-state"><div class="empty-state-title">Sin resultados</div><div class="empty-state-text">${total ? "Ningún evento coincide con los filtros. Prueba ampliando el rango o limpiándolos." : "Aún no hay eventos: crea el primero."}</div></div>`;
    return `<div class="card"><div class="table-scroll"><table class="table ev-table">
        <thead><tr><th>Nombre del evento</th><th><button class="th-sort" data-click="events:sort" aria-label="Ordenar por fecha">Fecha <span aria-hidden="true">${sortIcon}</span></button></th><th>Lugar</th><th>Cupos disponibles</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>${list.map((ev) => this.renderRow(ev)).join("")}</tbody></table></div>
        ${empty}
        <div class="acc-pager"><span>${list.length ? `Mostrando ${list.length} de ${total} ${total === 1 ? "evento" : "eventos"}` : `0 de ${total} eventos`}</span></div></div>`;
  },

  /** «Gestionar»: disponibilidad de inscripción (abierto / pausado / cerrado) del evento elegido */
  manageModalHtml() {
    const ev = ManagerApp.find(this.manageId); if (!ev) return "";
    const left = Math.max(0, ev.capacity - ev.registered);
    const opts = [["open", "Abiertas", "Los clientes pueden inscribirse."], ["paused", "Pausadas", "Nadie nuevo entra por ahora; puedes reabrir."], ["closed", "Cerradas", "Se cierran las inscripciones (pide confirmación)."]]
      .map(([k, l, hint]) => `<button class="mg-opt ${ev.availability === k ? "is-on" : ""}" data-click="manager:avail" data-id="${ev.id}" data-value="${k}"><strong>${l}</strong><span>${hint}</span></button>`).join("");
    return `<div class="modal-backdrop" data-click="events:closeManage" data-backdrop><div class="modal" style="--w:460px" role="dialog" aria-modal="true" aria-labelledby="mg-title">
        <h2 class="modal-title" id="mg-title">Gestionar inscripciones</h2>
        <p class="modal-confirm-text" style="margin-bottom:12px"><strong>${esc(ev.name)}</strong><br>${ev.registered} inscritos · ${left} ${left === 1 ? "cupo disponible" : "cupos disponibles"} de ${ev.capacity}</p>
        <div class="mg-opts">${opts}</div>
        <div class="modal-form-actions"><button class="btn btn-outline btn-block" data-click="events:closeManage">Listo</button><button class="btn btn-primary btn-block" data-click="events:openEdit" data-id="${ev.id}">${icon("edit", 14)} Editar evento</button></div></div></div>`;
  },

  renderModal() {
    if (!this.modal) return "";
    const f = this.form;
    const H = "events:form";
    return `
      <div class="modal-backdrop" data-click="events:closeModal" data-backdrop>
        <div class="modal" style="--w:540px" role="dialog" aria-modal="true" aria-label="${this.editingId ? "Editar evento" : "Crear evento"}">
          <h2 class="modal-title">${this.editingId ? "Editar evento" : "Crear evento"}</h2>
          <div class="form-stack">
            ${field("Nombre del evento", textInput({ key: "name", value: f.name, handler: H }))}
            <div class="form-grid-2">
              ${field("Lugar (teatro / sede)", textInput({ key: "location", value: f.location, handler: H }))}
              ${field("Ciudad", `<select class="input" data-input="${H}" data-key="cityId" aria-label="Ciudad">${cityOptionsHtml(f.cityId)}</select>`,
                      this.editingId ? "" : "Si no eliges, se usa la ciudad del agente.")}
            </div>
            ${field("Descripción", textInput({ key: "description", value: f.description, handler: H }))}
            <div class="form-grid-2">
              ${field("Fecha", textInput({ key: "date", type: "date", value: f.date, handler: H }))}
              ${field("Hora de inicio", textInput({ key: "time", type: "time", value: f.time, handler: H }))}
            </div>
            <div class="form-grid-2">
              ${field("Hora de fin (opcional)", textInput({ key: "end_time", type: "time", value: f.end_time, handler: H }), "Si la dejas vacía, dura 3 horas.")}
              ${field("Tipo (para sugerir el precio)", selectInput({ key: "type", options: TYPE_LABEL, value: f.type, handler: H }))}
            </div>
            <div class="form-grid-2">
              ${field("Aforo (cupos)", textInput({ key: "capacity", type: "number", value: f.capacity, handler: H, number: true, extra: 'min="1"' }),
                      this.editingId ? `Mínimo ${f.registered} (inscritos actuales)` : "Máximo de personas que pueden inscribirse")}
              ${field("Precio base B por persona (COP)", textInput({ key: "price", type: "number", value: f.price, handler: H, number: true, extra: 'min="0" step="1000"' }),
                      `0 = evento gratuito · zona preferencial ×1,5 · VIP ×2,5${this.editingId && f.basePrice && f.basePrice !== f.price ? ` · base fijada por ti: ${cop(f.basePrice)}` : ""}`)}
            </div>
            ${PriceIdeal.render()}
            ${field("Observaciones (opcional)", textInput({ key: "observaciones", value: f.observaciones, handler: H }))}
          </div>
          ${this.formError ? `<p class="auth-error" role="alert" style="margin-top:14px">${esc(this.formError)}</p>` : ""}
          <div class="modal-form-actions">
            <button class="btn btn-outline btn-block" data-click="events:closeModal">Cancelar</button>
            <button class="btn btn-primary btn-block" data-click="events:save" ${this.saving ? "disabled" : ""}>${this.saving ? "Guardando…" : this.editingId ? "Guardar cambios" : "Crear evento"}</button>
          </div>
        </div>
      </div>`;
  },

  /** Cancelar un EVENTO exige la causa (EVENTO.causa_cancelacion) y cancela todas sus reservas con reembolso simulado */
  cancelModalHtml() {
    const ev = ManagerApp.find(this.cancelId); if (!ev) return "";
    const n = Data.attendees.filter((a) => a.eventId === ev.id && a.status !== "cancelado").length;
    return `<div class="modal-backdrop" data-click="events:cancelClose" data-backdrop><div class="modal modal-confirm" role="dialog" aria-modal="true" aria-labelledby="ec-title">
        <h3 class="modal-confirm-title" id="ec-title">¿Cancelar “${esc(ev.name)}”?</h3>
        <p class="modal-confirm-text">${n ? `Se cancelarán ${n} ${n === 1 ? "reserva" : "reservas"} con reembolso simulado y reversión de puntos.` : "El evento no tiene reservas activas."} Esta acción no se puede deshacer.</p>
        <label class="field-label" for="ec-causa" style="margin-top:12px">Causa de la cancelación</label>
        <textarea id="ec-causa" class="input" rows="3" maxlength="500" placeholder="Ej. Lluvia, falta de permisos, baja venta…" data-input="events:causaInput" style="resize:vertical;min-height:84px">${esc(this.cancelCausa)}</textarea>
        ${this.cancelError ? `<p class="auth-error" role="alert" style="margin-top:10px">${esc(this.cancelError)}</p>` : ""}
        <div class="modal-actions"><button class="btn btn-outline" data-click="events:cancelClose">Volver</button>
          <button class="btn btn-danger" data-click="events:cancelSave" ${this.cancelBusy ? "disabled" : ""}>${this.cancelBusy ? "Cancelando…" : "Cancelar evento"}</button></div></div></div>`;
  },

  render() {
    const list = this.filtered();

    const statusPills = ["todos", "planificado", "en_progreso", "completado", "cancelado"].map((f) => `
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
        ${pageHeader({ eyebrow: "Operación", title: "Gestión de eventos", subtitle: "Crea, edita y cancela eventos (con su causa); cambia su precio y si aceptan inscripciones.", action: createBtn })}

        <div class="filters-stack">
          <div class="filters ev-filters" style="gap:10px">
            ${searchBox({ id: "events-search", placeholder: "Buscar por nombre del evento…", value: this.search, handler: "events:search" })}
            <div class="ev-range" role="group" aria-label="Rango de fechas">
              <label class="ev-range-field" for="events-from"><span>Desde</span><input id="events-from" type="date" class="input" value="${esc(this.dateFrom)}" data-input="events:from"></label>
              <label class="ev-range-field" for="events-to"><span>Hasta</span><input id="events-to" type="date" class="input" value="${esc(this.dateTo)}" data-input="events:to"></label>
            </div>
            <button id="events-clear" class="btn btn-outline btn-sm" data-click="events:clear" ${this.hasFilters() ? "" : "disabled"}>${icon("x", 13)} Limpiar filtros</button>
          </div>
          <div class="filters scroll-x"><span class="fin-note" style="margin-right:4px">Estado</span>${statusPills}</div>
          <div class="filters scroll-x">
            <span class="fin-note" style="margin-right:4px">Tipo</span>
            <button class="pill pill-sm pill-brown ${this.typeFilter === "todos" ? "active" : ""}" data-click="events:type" data-value="todos">Todos los tipos</button>
            ${typePills}
          </div>
        </div>

        <div id="ev-list">${this.listHtml()}</div>

        ${this.renderModal()}
        ${this.cancelModalHtml()}
        ${this.manageModalHtml()}
        ${closing ? mgrModal({ title: "¿Cerrar inscripciones?", body: `<p class="modal-confirm-text">“${esc(closing.name)}” dejará de aceptar inscripciones. Puedes reabrirlas cuando quieras.</p>`, cancel: "manager:cancelClose", confirm: "manager:confirmClose", label: "Sí, cerrar" }) : ""}
      </div>`;
  },
};

/* ----- acciones ----- */
bindForm("events:form", () => MgrEventsPage.form);
// además de guardar el campo, si cambia algo que afecta al precio ideal (tipo, aforo o precio) se recalcula
registerInput({
  "events:form": (el) => {
    const key = el.dataset.key;
    MgrEventsPage.form[key] = el.hasAttribute("data-number") ? +el.value : el.value;
    if (key === "type" || key === "capacity" || key === "price") PriceIdeal.schedule();
  },
});

registerInput({
  "events:causaInput": (el) => { MgrEventsPage.cancelCausa = el.value; },
  // los tres filtros de texto / fecha actualizan el estado local y redibujan solo la tabla (no pierden el foco)
  "events:search": (el) => { MgrEventsPage.search = el.value; MgrEventsPage.refreshList(); },
  "events:from":   (el) => { MgrEventsPage.dateFrom = el.value; MgrEventsPage.refreshList(); },
  "events:to":     (el) => { MgrEventsPage.dateTo = el.value; MgrEventsPage.refreshList(); },
});

registerClick({
  "events:filter": (el) => { MgrEventsPage.filter = el.dataset.value; rerender(); },
  "events:type":   (el) => { MgrEventsPage.typeFilter = el.dataset.value; rerender(); },
  "events:sort":   () => { MgrEventsPage.sortDir = MgrEventsPage.sortDir === "asc" ? "desc" : "asc"; MgrEventsPage.refreshList(); },
  "events:clear":  () => { Object.assign(MgrEventsPage, { search: "", dateFrom: "", dateTo: "", filter: "todos", typeFilter: "todos" }); rerender(); },
  "events:openManage":  (el) => { MgrEventsPage.manageId = el.dataset.id; rerender(); },
  "events:closeManage": () => { MgrEventsPage.manageId = null; rerender(); },

  "events:openNew": () => { MgrEventsPage.openNew(); rerender(); },
  "events:openEdit": (el) => {
    const ev = ManagerApp.find(el.dataset.id);
    if (!ev) return;
    MgrEventsPage.manageId = null;
    MgrEventsPage.editingId = ev.id;
    MgrEventsPage.form = {
      name: ev.name, type: ev.type, date: ev.date, time: ev.time, end_time: ev.end_time || "", cityId: ev.city_id || "",
      location: ev.teatro || String(ev.location || "").split(",")[0], capacity: ev.capacity, registered: ev.registered,
      price: ev.price, basePrice: ev.basePrice, description: ev.description || "", observaciones: ev.observaciones || "",
    };
    MgrEventsPage.formError = "";
    MgrEventsPage.modal = true;
    PriceIdeal.start();
    rerender();
  },
  "events:closeModal": () => { MgrEventsPage.modal = false; PriceIdeal.stop(); rerender(); },

  "events:save": async () => {
    const f = MgrEventsPage.form;
    const fail = (msg) => { MgrEventsPage.formError = msg; rerender(); };
    if (!f.name.trim() || !f.date) return fail("El nombre y la fecha son obligatorios.");
    if (!f.location.trim()) return fail("Escribe el lugar del evento.");
    if (!(f.capacity >= 1)) return fail("El aforo debe ser de al menos 1 cupo.");
    if (f.capacity < f.registered) return fail(`El aforo no puede ser menor a los ${f.registered} inscritos.`);
    if (!(f.price >= 0)) return fail("El precio no puede ser negativo.");
    if (MgrEventsPage.saving) return;

    // Se guarda en la base de datos y luego se vuelve a leer: lo que se ve es lo que quedó guardado.
    const payload = {
      name: f.name.trim(), event_date: f.date, start_time: f.time, end_time: f.end_time || undefined, location: f.location.trim(),
      description: f.description, capacity: Number(f.capacity), price_cop: Math.round(Number(f.price)),
      cityId: f.cityId ? Number(f.cityId) : undefined, observaciones: f.observaciones.trim() || undefined,
    };
    MgrEventsPage.saving = true; MgrEventsPage.formError = ""; rerender();
    try {
      if (MgrEventsPage.editingId) await api.put(`/events/${MgrEventsPage.editingId}`, payload);
      else await api.post("/events", { ...payload, created_by: Session.user.id });
    } catch (e) {
      MgrEventsPage.saving = false;
      const first = e.fields ? Object.values(e.fields)[0] : "";
      return fail(first ? `${e.message} ${first}` : e.message);
    }
    MgrEventsPage.saving = false; MgrEventsPage.modal = false; PriceIdeal.stop();
    Toast.show(MgrEventsPage.editingId ? "Evento actualizado." : "Evento creado.", "ok", 3000);
    await syncData();
  },

  "events:askCancel":  (el) => { Object.assign(MgrEventsPage, { cancelId: el.dataset.id, cancelCausa: "", cancelError: "", cancelBusy: false }); rerender(); },
  "events:cancelClose": () => { if (MgrEventsPage.cancelBusy) return; MgrEventsPage.cancelId = null; rerender(); },
  "events:cancelSave": async () => {
    const P = MgrEventsPage, id = P.cancelId; if (!id || P.cancelBusy) return;
    const causa = P.cancelCausa.trim();
    if (causa.length < 3) { P.cancelError = "Escribe la causa de la cancelación (mínimo 3 caracteres)."; rerender(); return; }
    P.cancelBusy = true; P.cancelError = ""; rerender();
    try {
      const r = await api.post(`/events/${id}/cancel`, { actorId: Session.user.id, causa });
      P.cancelId = null; P.cancelBusy = false;
      Toast.show(`Evento cancelado${r && r.reservasCanceladas ? ` · ${r.reservasCanceladas} reservas canceladas` : ""}.`, "ok", 3500);
      await syncData();
    } catch (e) { P.cancelBusy = false; P.cancelError = e.message; rerender(); }
  },

  /* disponibilidad de inscripción (cerrar pide confirmación) */
  "manager:avail": async (el) => {
    const ev = ManagerApp.find(el.dataset.id); if (!ev) return;
    if (el.dataset.value === "closed" && ev.availability !== "closed") { ManagerApp.closeId = ev.id; rerender(); return; }
    await apiSend("PUT", `/events/${ev.id}/availability`, { availability: el.dataset.value });
    await syncData();
  },
  "manager:confirmClose": async () => {
    const ev = ManagerApp.find(ManagerApp.closeId); ManagerApp.closeId = null;
    if (ev) await apiSend("PUT", `/events/${ev.id}/availability`, { availability: "closed" });
    await syncData();
  },
  "manager:cancelClose":  () => { ManagerApp.closeId = null; rerender(); },
});
