/* ==========================================================
   pages/manager/events.js — Gestión de eventos (herramienta del Agente)
   Crear, editar, eliminar, cambiar PRECIO y DISPONIBILIDAD de inscripción.
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
  search: "",
  modal: false,
  editingId: null,
  form: eventBlank(),
  formError: "",
  cancelId: null,
  cancelCausa: "",
  cancelError: "",
  cancelBusy: false,
  saving: false,

  filtered() {
    return Data.events.filter((e) => {
      const okStatus = this.filter === "todos" || e.status === this.filter;
      const okType   = this.typeFilter === "todos" || e.type === this.typeFilter;
      const okSearch = !this.search || matches(e.name, this.search) || matches(e.location, this.search);
      return okStatus && okType && okSearch;
    });
  },

  openNew() { this.editingId = null; this.form = eventBlank(); this.formError = ""; this.modal = true; PriceIdeal.start(); },

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
            <button class="btn btn-outline btn-sm" style="flex:1" data-click="events:openEdit" data-id="${ev.id}" ${ev.status === "cancelado" ? "disabled" : ""}>${icon("edit", 14)} Editar</button>
            ${ev.status === "cancelado"
              ? `<span class="readonly" style="flex:1;text-align:center;font-size:12px" title="${esc(ev.cancel_reason || "")}">Causa: ${esc((ev.cancel_reason || "—").slice(0, 40))}</span>`
              : `<button class="btn btn-danger btn-sm" style="flex:1" data-click="events:askCancel" data-id="${ev.id}">${icon("trash", 14)} Cancelar evento</button>`}
          </div>
        </div>
      </div>`;
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
        ${this.cancelModalHtml()}
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
  "events:search": (el) => { MgrEventsPage.search = el.value; rerender(); },
});

registerClick({
  "events:filter": (el) => { MgrEventsPage.filter = el.dataset.value; rerender(); },
  "events:type":   (el) => { MgrEventsPage.typeFilter = el.dataset.value; rerender(); },

  "events:openNew": () => { MgrEventsPage.openNew(); rerender(); },
  "events:openEdit": (el) => {
    const ev = ManagerApp.find(el.dataset.id);
    if (!ev) return;
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
