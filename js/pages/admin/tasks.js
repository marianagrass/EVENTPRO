/* ==========================================================
   pages/admin/tasks.js — Tablero Kanban de tareas
   ========================================================== */

const TASK_COLUMNS = [
  { key: "pendiente",   label: "Pendiente",   header: "#f5efe6" },
  { key: "en_progreso", label: "En progreso", header: "#eef5e8" },
  { key: "completado",  label: "Completado",  header: "#ede8e0" },
];

const taskBlank = () => ({
  title: "", eventId: "", eventName: "", assignee: "",
  dueDate: "", priority: "media", status: "pendiente", category: "",
});

const TasksPage = {
  search: "",
  filterPriority: "todas",
  modal: false,
  editingId: null,
  form: taskBlank(),

  isAdmin() { return App.role === "admin"; },

  filtered() {
    return Data.tasks.filter((t) => {
      const okP = this.filterPriority === "todas" || t.priority === this.filterPriority;
      const okS = !this.search || matches(t.title, this.search) || matches(t.assignee, this.search);
      return okP && okS;
    });
  },

  renderTask(task) {
    const moves = TASK_COLUMNS
      .filter((c) => c.key !== task.status)
      .map((c) => `<button class="btn btn-outline btn-xs" data-click="tasks:move" data-id="${task.id}" data-status="${c.key}">→ ${c.label}</button>`)
      .join("");

    const adminActions = this.isAdmin()
      ? `<div class="row" style="margin-left:auto;gap:4px">
           <button class="btn btn-outline btn-xs" data-click="tasks:openEdit" data-id="${task.id}">Editar</button>
           <button class="btn btn-danger btn-xs" data-click="tasks:remove" data-id="${task.id}">Borrar</button>
         </div>`
      : "";

    return `
      <div class="task-card">
        <div class="row" style="align-items:flex-start;gap:8px;margin-bottom:10px">
          <div class="prio-dot" style="background:${PRIORITY[task.priority].dot}"></div>
          <span style="font-size:14px;font-weight:500;line-height:1.4">${esc(task.title)}</span>
        </div>
        <div class="task-meta">
          <div>${esc(task.eventName.split(" ").slice(0, 3).join(" "))}</div>
          <div>Responsable: <span style="color:#6b5626;font-weight:500">${esc(task.assignee)}</span></div>
          ${task.dueDate ? `<div style="color:#6b5626;font-weight:500">Vence: ${parseDate(task.dueDate).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}</div>` : ""}
          <div><span class="chip" style="background:#f5efe6;color:#889063;padding:2px 8px;border-radius:10px">${esc(task.category)}</span></div>
        </div>
        <div class="task-actions">${moves}${adminActions}</div>
      </div>`;
  },

  renderModal() {
    if (!this.modal) return "";
    const f = this.form, H = "tasks:form";
    const priorityOptions = { alta: "Alta", media: "Media", baja: "Baja" };
    const statusOptions = { pendiente: "Pendiente", en_progreso: "En progreso", completado: "Completado" };
    return `
      <div class="modal-backdrop" data-click="tasks:closeModal" data-backdrop>
        <div class="modal" style="--w:480px">
          <h2 class="modal-title">${this.editingId ? "Editar tarea" : "Nueva tarea"}</h2>
          <div class="form-stack">
            ${field("Título de la tarea", textInput({ key: "title",     value: f.title,     handler: H }))}
            ${field("Evento",             textInput({ key: "eventName", value: f.eventName, handler: H }))}
            ${field("Responsable",        textInput({ key: "assignee",  value: f.assignee,  handler: H }))}
            ${field("Categoría",          textInput({ key: "category",  value: f.category,  handler: H }))}
            ${field("Fecha límite",       textInput({ key: "dueDate",   type: "date", value: f.dueDate, handler: H }))}
            <div class="form-grid-2">
              ${field("Prioridad", selectInput({ key: "priority", options: priorityOptions, value: f.priority, handler: H }))}
              ${field("Estado",    selectInput({ key: "status",   options: statusOptions,   value: f.status,   handler: H }))}
            </div>
          </div>
          <div class="modal-form-actions">
            <button class="btn btn-outline btn-block" data-click="tasks:closeModal">Cancelar</button>
            <button class="btn btn-primary btn-block" data-click="tasks:save">${this.editingId ? "Guardar cambios" : "Crear tarea"}</button>
          </div>
        </div>
      </div>`;
  },

  render() {
    const list = this.filtered();

    const priorityPills = ["todas", "alta", "media", "baja"].map((p) => {
      const active = this.filterPriority === p;
      return `
        <button class="pill pill-sm pill-brown ${active ? "active" : ""}" data-click="tasks:priority" data-value="${p}">
          ${p !== "todas" ? `<span class="pill-dot" style="width:8px;height:8px;background:${active ? "#cfbb99" : PRIORITY[p].dot}"></span>` : ""}
          ${p === "todas" ? "Todas" : PRIORITY[p].text}
        </button>`;
    }).join("");

    const columns = TASK_COLUMNS.map((col) => {
      const colTasks = list.filter((t) => t.status === col.key);
      return `
        <div class="kanban-col">
          <div class="kanban-head" style="background:${col.header}">
            <span style="font-size:14px;font-weight:600">${col.label}</span>
            <span class="kanban-count">${colTasks.length}</span>
          </div>
          <div class="kanban-body">
            ${colTasks.length === 0 ? `<div class="kanban-empty">Sin tareas aquí</div>` : colTasks.map((t) => this.renderTask(t)).join("")}
          </div>
        </div>`;
    }).join("");

    const addBtn = this.isAdmin()
      ? `<button class="btn btn-primary" data-click="tasks:openNew">${icon("plus", 16, { width: 2.5 })} Nueva tarea</button>`
      : "";

    return `
      <div class="page" style="--w:1200px">
        ${pageHeader({ eyebrow: "Planificación", title: "Tareas", action: addBtn })}

        <div class="filters" style="gap:12px;margin-bottom:28px">
          ${searchBox({ id: "tasks-search", placeholder: "Buscar tareas…", value: this.search, handler: "tasks:search", maxWidth: 320 })}
          <div class="filters">
            <span style="font-size:13px;color:#889063;font-weight:500">Prioridad:</span>
            ${priorityPills}
          </div>
        </div>

        <div class="grid-3" style="gap:20px">${columns}</div>

        ${this.renderModal()}
      </div>`;
  },
};

bindForm("tasks:form", () => TasksPage.form);

registerInput({
  "tasks:search": (el) => { TasksPage.search = el.value; rerender(); },
});

registerClick({
  "tasks:priority": (el) => { TasksPage.filterPriority = el.dataset.value; rerender(); },

  "tasks:move": (el) => {
    Data.tasks = Data.tasks.map((t) => (t.id === el.dataset.id ? { ...t, status: el.dataset.status } : t));
    rerender();
  },
  "tasks:remove": (el) => {
    Data.tasks = Data.tasks.filter((t) => t.id !== el.dataset.id);
    rerender();
  },

  "tasks:openNew": () => {
    TasksPage.editingId = null;
    TasksPage.form = taskBlank();
    TasksPage.modal = true;
    rerender();
  },
  "tasks:openEdit": (el) => {
    const t = Data.tasks.find((x) => x.id === el.dataset.id);
    const { id, ...rest } = t;
    TasksPage.editingId = id;
    TasksPage.form = rest;
    TasksPage.modal = true;
    rerender();
  },
  "tasks:closeModal": () => { TasksPage.modal = false; rerender(); },

  "tasks:save": () => {
    const f = TasksPage.form;
    if (!f.title || !f.assignee) return;
    if (TasksPage.editingId) {
      Data.tasks = Data.tasks.map((t) => (t.id === TasksPage.editingId ? { ...f, id: t.id } : t));
    } else {
      Data.tasks = [...Data.tasks, { ...f, id: "t" + Date.now() }];
    }
    TasksPage.modal = false;
    rerender();
  },
});
