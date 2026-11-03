const TASK_COLUMNS = [{ key: "pendiente", label: "Pendiente", header: "var(--bg)" }, { key: "en_progreso", label: "En progreso", header: "var(--tint)" }, { key: "completado", label: "Completado", header: "var(--tint-2)" }];
const taskBlank = () => ({ title: "", eventId: "", eventName: "", assigneeId: Session.user ? Session.user.id : "", assignee: "", dueDate: "", priority: "media", status: "pendiente", category: "" });

const MgrTasksPage = {
  search: "", filterPriority: "todas", modal: false, editingId: null, form: taskBlank(), formError: "", deleteId: null,
  filtered() { return Data.tasks.filter((t) => { const okP = this.filterPriority === "todas" || t.priority === this.filterPriority; const okS = !this.search || matches(t.title, this.search) || matches(t.assignee, this.search); return okP && okS; }); },
  renderTask(task) {
    const moves = TASK_COLUMNS.filter((c) => c.key !== task.status).map((c) => `<button class="btn btn-outline btn-xs" data-click="tasks:move" data-id="${task.id}" data-status="${c.key}">→ ${c.label}</button>`).join("");
    const adminActions = `<div class="row" style="margin-left:auto;gap:4px"><button class="btn btn-outline btn-xs" data-click="tasks:openEdit" data-id="${task.id}">Editar</button><button class="btn btn-danger btn-xs" data-click="tasks:remove" data-id="${task.id}">Borrar</button></div>`;
    return `<div class="task-card"><div class="row" style="align-items:flex-start;gap:8px;margin-bottom:10px"><div class="prio-dot" style="background:${PRIORITY[task.priority].dot}"></div><span style="font-size:14px;font-weight:500;line-height:1.4">${esc(task.title)}</span></div>
        <div class="task-meta"><div>${esc(task.eventName.split(" ").slice(0, 3).join(" "))}</div><div>Responsable: <span style="color:var(--gold);font-weight:500">${esc(task.assignee)}</span></div>
          ${task.dueDate ? `<div style="color:var(--gold);font-weight:500">Vence: ${parseDate(task.dueDate).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}</div>` : ""}<div><span class="chip" style="background:var(--bg);color:var(--muted);padding:2px 8px;border-radius:10px">${esc(task.category)}</span></div></div>
        <div class="task-actions">${moves}${adminActions}</div></div>`;
  },
  renderModal() {
    if (!this.modal) return "";
    const f = this.form, H = "tasks:form", priorityOptions = { alta: "Alta", media: "Media", baja: "Baja" }, statusOptions = { pendiente: "Pendiente", en_progreso: "En progreso", completado: "Completado" };
    return `<div class="modal-backdrop" data-click="tasks:closeModal" data-backdrop><div class="modal" style="--w:480px"><h2 class="modal-title">${this.editingId ? "Editar tarea" : "Nueva tarea"}</h2>
          <div class="form-stack">
            ${field("Título de la tarea", textInput({ key: "title", value: f.title, handler: H }))}
            ${field("Evento", selectInput({ key: "eventId", options: { "": "Sin evento específico", ...Object.fromEntries(Data.events.map((e) => [e.id, e.name])) }, value: f.eventId, handler: H }))}
            ${field("Responsable", selectInput({ key: "assigneeId", options: Object.fromEntries(Data.accounts.filter(a => a.role === 'manager').map(a => [a.id, a.name])), value: f.assigneeId, handler: H }))}
            ${field("Categoría", textInput({ key: "category", value: f.category, handler: H }))}
            ${field("Fecha límite", textInput({ key: "dueDate", type: "date", value: f.dueDate, handler: H }))}
            <div class="form-grid-2">${field("Prioridad", selectInput({ key: "priority", options: priorityOptions, value: f.priority, handler: H }))}${field("Estado", selectInput({ key: "status", options: statusOptions, value: f.status, handler: H }))}</div></div>
          ${this.formError ? `<p class="auth-error" role="alert" style="margin-top:14px">${esc(this.formError)}</p>` : ""}
          <div class="modal-form-actions"><button class="btn btn-outline btn-block" data-click="tasks:closeModal">Cancelar</button><button class="btn btn-primary btn-block" data-click="tasks:save">${this.editingId ? "Guardar cambios" : "Crear tarea"}</button></div></div></div>`;
  },
  render() {
    const list = this.filtered();
    const priorityPills = ["todas", "alta", "media", "baja"].map((p) => { const active = this.filterPriority === p; return `<button class="pill pill-sm pill-brown ${active ? "active" : ""}" data-click="tasks:priority" data-value="${p}">${p !== "todas" ? `<span class="pill-dot" style="width:8px;height:8px;background:${active ? "#b8b2ea" : PRIORITY[p].dot}"></span>` : ""}${p === "todas" ? "Todas" : PRIORITY[p].text}</button>`; }).join("");
    const columns = TASK_COLUMNS.map((col) => { const colTasks = list.filter((t) => t.status === col.key); return `<div class="kanban-col"><div class="kanban-head" style="background:${col.header}"><span style="font-size:14px;font-weight:600">${col.label}</span><span class="kanban-count">${colTasks.length}</span></div><div class="kanban-body">${colTasks.length === 0 ? `<div class="kanban-empty">Sin tareas aquí</div>` : colTasks.map((t) => this.renderTask(t)).join("")}</div></div>`; }).join("");
    return `<div class="page" style="--w:1680px">
        ${pageHeader({ eyebrow: "Planificación", title: "Tareas", action: `<button class="btn btn-primary" data-click="tasks:openNew">${icon("plus", 16, { width: 2.5 })} Nueva tarea</button>` })}
        <div class="filters" style="gap:12px;margin-bottom:28px">${searchBox({ id: "tasks-search", placeholder: "Buscar tareas…", value: this.search, handler: "tasks:search", maxWidth: 320 })}<div class="filters scroll-x"><span style="font-size:13px;color:var(--muted);font-weight:500">Prioridad:</span>${priorityPills}</div></div>
        <div class="grid-3" style="gap:20px">${columns}</div>
        ${this.renderModal()}${this.deleteId ? confirmModal({ title: "¿Eliminar tarea?", cancelAction: "tasks:cancelDelete", confirmAction: "tasks:confirmDelete" }) : ""}</div>`;
  },
};
bindForm("tasks:form", () => MgrTasksPage.form);
registerInput({ "tasks:search": (el) => { MgrTasksPage.search = el.value; rerender(); }, });
registerClick({
  "tasks:priority": (el) => { MgrTasksPage.filterPriority = el.dataset.value; rerender(); },
  "tasks:move": async (el) => { await apiSend('PUT', `/tasks/${el.dataset.id}/status`, {status: el.dataset.status}); await syncData(); },
  "tasks:remove": (el) => { MgrTasksPage.deleteId = el.dataset.id; rerender(); },
  "tasks:cancelDelete": () => { MgrTasksPage.deleteId = null; rerender(); },
  "tasks:confirmDelete": async () => { await apiSend('DELETE', `/tasks/${MgrTasksPage.deleteId}`); MgrTasksPage.deleteId = null; await syncData(); },
  "tasks:openNew": () => { MgrTasksPage.editingId = null; MgrTasksPage.form = taskBlank(); MgrTasksPage.formError = ""; MgrTasksPage.modal = true; rerender(); },
  "tasks:openEdit": (el) => { const t = Data.tasks.find((x) => x.id === el.dataset.id); const { id, ...rest } = t; MgrTasksPage.editingId = id; MgrTasksPage.form = rest; MgrTasksPage.formError = ""; MgrTasksPage.modal = true; rerender(); },
  "tasks:closeModal": () => { MgrTasksPage.modal = false; rerender(); },
  "tasks:save": async () => {
    const f = { ...MgrTasksPage.form };
    if (!f.title.trim() || !f.assigneeId) { MgrTasksPage.formError = "El título y el responsable son obligatorios."; rerender(); return; }
    const payload = { title: f.title.trim(), eventId: f.eventId || null, assigneeId: f.assigneeId || null, category: f.category || "", dueDate: f.dueDate || null, priority: f.priority, status: f.status };
    if (MgrTasksPage.editingId) { await apiSend('PUT', `/tasks/${MgrTasksPage.editingId}`, payload); } 
    else { await apiSend('POST', '/tasks', payload); }
    MgrTasksPage.modal = false; await syncData();
  },
});