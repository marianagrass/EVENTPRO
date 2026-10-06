/* ==========================================================
   pages/admin/dashboard.js — Resumen general del administrador
   ========================================================== */

const DashboardPage = {
  render() {
    const { events, tasks, attendees } = Data;

    const confirmed   = attendees.filter((a) => a.status === "confirmado").length;
    const inProgress  = events.filter((e) => e.status === "en_progreso").length;
    const pending     = tasks.filter((t) => t.status === "pendiente").length;
    const totalBudget = events.reduce((sum, e) => sum + e.budget, 0);
    const totalSpent  = events.reduce((sum, e) => sum + e.spent, 0);

    const upcoming = [...events]
      .filter((e) => e.status !== "completado" && e.status !== "cancelado")
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);

    const urgentTasks = [...tasks]
      .filter((t) => t.status !== "completado")
      .sort((a, b) => (a.priority === "alta" ? -1 : b.priority === "alta" ? 1 : 0))
      .slice(0, 5);

    const kpis = [
      { label: "Eventos activos",   value: inProgress, sub: `de ${events.length} en total` },
      { label: "Asistentes",        value: confirmed,  sub: "confirmados" },
      { label: "Tareas pendientes", value: pending,    sub: "por completar" },
      { label: "Presupuesto usado", value: `${percent(totalSpent, totalBudget)}%`, sub: `${cop(totalSpent)} de ${cop(totalBudget)}` },
    ].map((k) => `
      <div class="kpi">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-sub">${esc(k.sub)}</div>
      </div>`).join("");

    const upcomingRows = upcoming.map((ev) => {
      const d = parseDate(ev.date);
      return `
        <div class="dash-row">
          <div class="date-badge" style="background:${TYPE_COLOR[ev.type]}">
            <span class="date-badge-day">${String(d.getDate()).padStart(2, "0")}</span>
            <span class="date-badge-month">${d.toLocaleString("es-CO", { month: "short" })}</span>
          </div>
          <div class="dash-info">
            <div class="dash-name ellipsis">${esc(ev.name)}</div>
            <div class="dash-meta">${esc(ev.location.split(",")[0])} · ${esc(ev.time)}</div>
            <div class="row" style="gap:8px">
              <div class="bar bar-thin" style="flex:1"><div class="bar-fill" style="width:${percent(ev.registered, ev.capacity)}%;background:${TYPE_COLOR[ev.type]}"></div></div>
              <span class="dash-count">${ev.registered}/${ev.capacity}</span>
            </div>
          </div>
          ${statusBadge(ev.status)}
        </div>`;
    }).join("");

    const taskRows = urgentTasks.map((t) => `
      <div class="dash-row dash-row-top">
        <div class="prio-dot" style="background:${PRIORITY[t.priority].dot}"></div>
        <div class="dash-info">
          <div class="task-title">${esc(t.title)}</div>
          <div class="dash-meta" style="margin:0">${esc(t.eventName)} · ${esc(t.assignee)}</div>
        </div>
        <span class="chip st-${t.status}">${t.status === "en_progreso" ? "En progreso" : "Pendiente"}</span>
      </div>`).join("");

    return `
      <div class="page" style="--w:1100px">
        <div style="margin-bottom:36px">
          <div class="eyebrow" style="margin-bottom:6px">Jueves · 21 de agosto de 2026</div>
          <h1 class="page-title" style="line-height:1.2">Bienvenida, Sofía</h1>
          <p class="page-subtitle">Resumen completo de todos los eventos y actividades.</p>
        </div>

        <div class="grid-kpi">${kpis}</div>

        <div class="grid-dash">
          <div class="card">
            <div class="card-head">
              <h2>Próximos eventos</h2>
              <button class="btn btn-light" data-click="nav:admin" data-view="events">Ver todos</button>
            </div>
            ${upcomingRows}
          </div>

          <div class="card">
            <div class="card-head">
              <h2>Tareas urgentes</h2>
              <button class="btn btn-light" data-click="nav:admin" data-view="tasks">Ver todas</button>
            </div>
            ${taskRows}
          </div>
        </div>
      </div>`;
  },
};
