/* ==========================================================
   pages/admin/attendees.js — Registro de asistentes (tabla + CRUD)
   ========================================================== */

const attendeeBlank = () => ({
  name: "", email: "", phone: "", eventId: "", eventName: "",
  status: "pendiente", registeredAt: new Date().toISOString().slice(0, 10),
});

const AttendeesPage = {
  search: "",
  filterStatus: "todos",
  modal: false,
  editingId: null,
  form: attendeeBlank(),
  deleteId: null,

  isAdmin() { return App.role === "admin"; },

  filtered() {
    return Data.attendees.filter((a) => {
      const okStatus = this.filterStatus === "todos" || a.status === this.filterStatus;
      const okSearch = !this.search || matches(a.name, this.search) || matches(a.email, this.search) || matches(a.eventName, this.search);
      return okStatus && okSearch;
    });
  },

  renderRow(a) {
    const actions = this.isAdmin()
      ? `<div class="row" style="gap:8px">
           <button class="btn btn-outline btn-sm" data-click="attendees:openEdit" data-id="${a.id}">Editar</button>
           <button class="btn btn-danger btn-sm" data-click="attendees:askDelete" data-id="${a.id}">Eliminar</button>
         </div>`
      : `<span class="readonly">Solo lectura</span>`;

    return `
      <tr>
        <td>
          <div class="row" style="gap:12px">
            <div class="avatar" style="width:38px;height:38px;font-size:13px;background:${avatarColor(a.name)}">${esc(initials(a.name))}</div>
            <div>
              <div style="font-size:14px;font-weight:500">${esc(a.name)}</div>
              <div style="font-size:12px;color:#889063">${esc(a.email)}</div>
              <div style="font-size:12px;color:#cfbb99">${esc(a.phone)}</div>
            </div>
          </div>
        </td>
        <td style="font-size:13px;max-width:200px"><div class="ellipsis">${esc(a.eventName)}</div></td>
        <td>${statusBadge(a.status)}</td>
        <td style="font-size:13px;color:#889063">${parseDate(a.registeredAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}</td>
        <td>${actions}</td>
      </tr>`;
  },

  renderModal() {
    if (!this.modal) return "";
    const f = this.form, H = "attendees:form";
    const statusOptions = { confirmado: "Confirmado", pendiente: "Pendiente", cancelado: "Cancelado" };
    return `
      <div class="modal-backdrop" data-click="attendees:closeModal" data-backdrop>
        <div class="modal" style="--w:480px">
          <h2 class="modal-title">${this.editingId ? "Editar asistente" : "Registrar asistente"}</h2>
          <div class="form-stack">
            ${field("Nombre completo",    textInput({ key: "name",      value: f.name,      handler: H }))}
            ${field("Correo electrónico", textInput({ key: "email",     type: "email", value: f.email, handler: H }))}
            ${field("Teléfono",           textInput({ key: "phone",     type: "tel",   value: f.phone, handler: H }))}
            ${field("Evento",             textInput({ key: "eventName", value: f.eventName, handler: H }))}
            ${field("Estado",             selectInput({ key: "status", options: statusOptions, value: f.status, handler: H }))}
          </div>
          <div class="modal-form-actions">
            <button class="btn btn-outline btn-block" data-click="attendees:closeModal">Cancelar</button>
            <button class="btn btn-primary btn-block" data-click="attendees:save">${this.editingId ? "Guardar cambios" : "Registrar"}</button>
          </div>
        </div>
      </div>`;
  },

  render() {
    const all = Data.attendees;
    const list = this.filtered();

    const stats = [
      { label: "Total registrados", value: all.length,                                          color: "#4c3d19" },
      { label: "Confirmados",       value: all.filter((a) => a.status === "confirmado").length, color: "#354024" },
      { label: "Pendientes",        value: all.filter((a) => a.status === "pendiente").length,  color: "#889063" },
    ].map((s) => `
      <div class="kpi" style="padding:20px 24px">
        <div class="kpi-label" style="margin-bottom:8px">${s.label}</div>
        <div class="kpi-value" style="font-size:34px;color:${s.color}">${s.value}</div>
      </div>`).join("");

    const pills = ["todos", "confirmado", "pendiente", "cancelado"].map((f) => `
      <button class="pill ${this.filterStatus === f ? "active" : ""}" data-click="attendees:filter" data-value="${f}">
        ${f === "todos" ? "Todos" : STATUS_TEXT[f]}
      </button>`).join("");

    const addBtn = this.isAdmin()
      ? `<button class="btn btn-primary" data-click="attendees:openNew">${icon("plus", 16, { width: 2.5 })} Registrar asistente</button>`
      : "";

    return `
      <div class="page" style="--w:1100px">
        ${pageHeader({ eyebrow: "Registro", title: "Asistentes", action: addBtn })}

        <div class="grid-3" style="margin-bottom:28px">${stats}</div>

        <div class="filters" style="gap:12px;margin-bottom:20px">
          ${searchBox({ id: "attendees-search", placeholder: "Buscar por nombre, email o evento…", value: this.search, handler: "attendees:search" })}
          <div class="filters">${pills}</div>
        </div>

        <div class="card">
          <table class="table">
            <thead><tr>${["Asistente", "Evento", "Estado", "Registrado el", "Acciones"].map((h) => `<th>${h}</th>`).join("")}</tr></thead>
            <tbody>${list.map((a) => this.renderRow(a)).join("")}</tbody>
          </table>
          ${list.length === 0 ? `
            <div style="text-align:center;padding:60px 0">
              <div style="font-family:var(--font-title);font-size:20px;color:#889063">Sin resultados</div>
            </div>` : ""}
        </div>

        ${this.renderModal()}
        ${this.deleteId ? confirmModal({ title: "¿Eliminar asistente?", cancelAction: "attendees:cancelDelete", confirmAction: "attendees:confirmDelete" }) : ""}
      </div>`;
  },
};

bindForm("attendees:form", () => AttendeesPage.form);

registerInput({
  "attendees:search": (el) => { AttendeesPage.search = el.value; rerender(); },
});

registerClick({
  "attendees:filter": (el) => { AttendeesPage.filterStatus = el.dataset.value; rerender(); },

  "attendees:openNew": () => {
    AttendeesPage.editingId = null;
    AttendeesPage.form = attendeeBlank();
    AttendeesPage.modal = true;
    rerender();
  },
  "attendees:openEdit": (el) => {
    const a = Data.attendees.find((x) => x.id === el.dataset.id);
    const { id, ...rest } = a;
    AttendeesPage.editingId = id;
    AttendeesPage.form = rest;
    AttendeesPage.modal = true;
    rerender();
  },
  "attendees:closeModal": () => { AttendeesPage.modal = false; rerender(); },

  "attendees:save": () => {
    const f = AttendeesPage.form;
    if (!f.name || !f.email) return;
    if (AttendeesPage.editingId) {
      Data.attendees = Data.attendees.map((a) => (a.id === AttendeesPage.editingId ? { ...f, id: a.id } : a));
    } else {
      Data.attendees = [...Data.attendees, { ...f, id: "a" + Date.now() }];
    }
    AttendeesPage.modal = false;
    rerender();
  },

  "attendees:askDelete":     (el) => { AttendeesPage.deleteId = el.dataset.id; rerender(); },
  "attendees:cancelDelete":  () => { AttendeesPage.deleteId = null; rerender(); },
  "attendees:confirmDelete": () => {
    Data.attendees = Data.attendees.filter((a) => a.id !== AttendeesPage.deleteId);
    AttendeesPage.deleteId = null;
    rerender();
  },
});
