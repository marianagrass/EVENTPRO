/* ==========================================================
   pages/manager/manager.js — Panel del Agente (Event Manager)
   Solo opera eventos asignados. Sin presupuesto ni tareas globales.
   Toda mutación pasa por ManagerApp.own(id): espejo del middleware
   requireEventAssignment del backend.
   ========================================================== */
const AVAIL = { open: "Abierto", paused: "Pausado", closed: "Cerrado" };

const ManagerApp = {
  view: "inicio", eventId: "todos", search: "", filter: "todos",
  capModal: null, capValue: 0, capError: "", closeId: null,

  assigned() {
    const ids = Data.eventAgents.filter((a) => a.agentId === Session.user?.id && !a.revokedAt).map((a) => a.eventId);
    return Data.events.filter((e) => ids.includes(e.id));
  },
  own(id) { return this.assigned().find((e) => e.id === id); },
  attendeesOf() {
    const ids = this.assigned().map((e) => e.id);
    return Data.attendees.filter((a) => ids.includes(a.eventId) && a.status === "confirmado");
  },
  pages() { return { inicio: MgrHomePage, eventos: MgrEventsPage, aforo: MgrCapacityPage, asistentes: MgrAttendeesPage }; },
  currentPage() { return this.pages()[this.view]; },
  render() { return `<div class="app">${ManagerSidebar.render()}<main class="main">${this.currentPage().render()}</main></div>`; },
};

const mgrModal = ({ title, body, cancel, confirm, label }) => `
  <div class="modal-backdrop" data-click="${cancel}" data-backdrop>
    <div class="modal modal-confirm">
      <h3 class="modal-confirm-title">${title}</h3>
      ${body}
      <div class="modal-actions">
        <button class="btn btn-outline" data-click="${cancel}">Cancelar</button>
        <button class="btn btn-primary" data-click="${confirm}">${label}</button>
      </div>
    </div>
  </div>`;

const MgrHomePage = {
  render() {
    const evs = ManagerApp.assigned(), att = ManagerApp.attendeesOf();
    const reg = evs.reduce((s, e) => s + e.registered, 0), cap = evs.reduce((s, e) => s + e.capacity, 0);
    const done = att.filter((a) => a.checkedInAt).length;
    const kpis = [
      ["Eventos asignados", evs.length, "bajo tu gestión"],
      ["Aforo ocupado", `${percent(reg, cap)}%`, `${reg} de ${cap} cupos`],
      ["Check-in realizado", `${done}/${att.length}`, "asistentes confirmados"],
      ["Inscripción restringida", evs.filter((e) => e.availability !== "open").length, "pausados o cerrados"],
    ].map(([l, v, s]) => `<div class="kpi"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div><div class="kpi-sub">${s}</div></div>`).join("");

    const rows = [...evs].sort((a, b) => a.date.localeCompare(b.date)).map((ev) => {
      const d = parseDate(ev.date);
      return `
        <div class="dash-row">
          <div class="date-badge" style="background:${TYPE_COLOR[ev.type]}"><span class="date-badge-day">${String(d.getDate()).padStart(2, "0")}</span><span class="date-badge-month">${d.toLocaleString("es-CO", { month: "short" })}</span></div>
          <div class="dash-info"><div class="dash-name ellipsis">${esc(ev.name)}</div><div class="dash-meta">${esc(ev.location.split(",")[0])} · ${esc(ev.time)}</div>
            <div class="row" style="gap:8px"><div class="bar bar-thin" style="flex:1"><div class="bar-fill" style="width:${percent(ev.registered, ev.capacity)}%;background:${TYPE_COLOR[ev.type]}"></div></div><span class="dash-count">${ev.registered}/${ev.capacity}</span></div></div>
          <span class="badge">${AVAIL[ev.availability]}</span>
        </div>`;
    }).join("");

    return `
      <div class="page" style="--w:1100px">
        ${pageHeader({ eyebrow: "Panel del Agente", title: `Hola, ${esc(Session.user.name.split(" ")[0])}`, subtitle: "Resumen operativo de tus eventos asignados." })}
        <div class="grid-kpi">${kpis}</div>
        <div class="card"><div class="card-head"><h2>Mis próximos eventos</h2></div>${rows || `<p class="card-pad">No tienes eventos asignados.</p>`}</div>
      </div>`;
  },
};

const MgrEventsPage = {
  render() {
    const cards = ManagerApp.assigned().map((ev) => {
      const pills = Object.entries(AVAIL).map(([k, l]) =>
        `<button class="pill pill-sm ${ev.availability === k ? "active" : ""}" data-click="manager:avail" data-id="${ev.id}" data-value="${k}">${l}</button>`).join("");
      return `
        <div class="card card-pad">
          <div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="eyebrow">${TYPE_LABEL[ev.type]}</span>${statusBadge(ev.status)}</div>
          <h3 class="card-title" style="margin-bottom:6px">${esc(ev.name)}</h3>
          <p class="dash-meta">${parseDate(ev.date).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })} · ${esc(ev.time)}<br>${esc(ev.location)}</p>
          <div class="field-label" style="margin-top:14px">Disponibilidad de inscripción</div>
          <div class="row" style="gap:8px;flex-wrap:wrap">${pills}</div>
        </div>`;
    }).join("");
    const closing = ManagerApp.own(ManagerApp.closeId);
    return `
      <div class="page" style="--w:1100px">
        ${pageHeader({ eyebrow: "Operación", title: "Mis Eventos", subtitle: "Controla si cada evento acepta nuevas inscripciones." })}
        <div class="grid-cards" style="--min:340px">${cards}</div>
        ${closing ? mgrModal({ title: "¿Cerrar inscripciones?", body: `<p class="modal-confirm-text">“${esc(closing.name)}” dejará de aceptar inscripciones. Puedes reabrirlas cuando quieras.</p>`, cancel: "manager:cancelClose", confirm: "manager:confirmClose", label: "Sí, cerrar" }) : ""}
      </div>`;
  },
};

const MgrCapacityPage = {
  render() {
    const cards = ManagerApp.assigned().map((ev) => {
      const free = ev.capacity - ev.registered;
      return `
        <div class="card card-pad">
          <h3 class="card-title" style="margin-bottom:12px">${esc(ev.name)}</h3>
          <div class="row" style="justify-content:space-between;align-items:baseline"><span class="kpi-value" style="font-size:30px">${ev.registered}<small style="font-size:14px;color:var(--sand)"> / ${ev.capacity}</small></span><span class="dash-count">${free} libres</span></div>
          <div class="bar" style="margin:12px 0 16px"><div class="bar-fill" style="width:${percent(ev.registered, ev.capacity)}%;background:${TYPE_COLOR[ev.type]}"></div></div>
          <button class="btn btn-outline btn-block" data-click="manager:capOpen" data-id="${ev.id}">Modificar aforo</button>
        </div>`;
    }).join("");
    const ev = ManagerApp.own(ManagerApp.capModal);
    const modal = ev ? mgrModal({
      title: "Modificar aforo", cancel: "manager:capClose", confirm: "manager:capSave", label: "Guardar",
      body: `<p class="modal-confirm-text">${esc(ev.name)}<br>Mínimo permitido: ${ev.registered} (inscritos actuales).</p>
        <div class="row" style="gap:8px;margin:14px 0">
          <button class="btn btn-outline" data-click="manager:capStep" data-d="-10">−10</button>
          <input id="cap-input" class="input" type="number" min="${ev.registered}" value="${ManagerApp.capValue}" data-input="manager:capInput" style="text-align:center">
          <button class="btn btn-outline" data-click="manager:capStep" data-d="10">+10</button>
        </div>${ManagerApp.capError ? `<p style="color:#a05050;font-size:13px">${esc(ManagerApp.capError)}</p>` : ""}`,
    }) : "";
    return `
      <div class="page" style="--w:1100px">
        ${pageHeader({ eyebrow: "Operación", title: "Control de Aforo", subtitle: "Ajusta la cantidad de cupos de tus eventos." })}
        <div class="grid-cards" style="--min:320px">${cards}</div>${modal}
      </div>`;
  },
};

const MgrAttendeesPage = {
  list() {
    return ManagerApp.attendeesOf().filter((a) =>
      (ManagerApp.eventId === "todos" || a.eventId === ManagerApp.eventId) &&
      (ManagerApp.filter === "todos" || (ManagerApp.filter === "presentes" ? a.checkedInAt : !a.checkedInAt)) &&
      (!ManagerApp.search || matches(a.name, ManagerApp.search) || matches(a.email, ManagerApp.search)));
  },
  render() {
    const evOpts = { todos: "Todos mis eventos", ...Object.fromEntries(ManagerApp.assigned().map((e) => [e.id, e.name])) };
    const scope = ManagerApp.attendeesOf().filter((a) => ManagerApp.eventId === "todos" || a.eventId === ManagerApp.eventId);
    const rows = this.list().map((a) => `
      <tr>
        <td><div class="row" style="gap:12px"><div class="avatar" style="width:38px;height:38px;font-size:13px;background:${avatarColor(a.name)}">${esc(initials(a.name))}</div>
          <div><div style="font-size:14px;font-weight:500">${esc(a.name)}</div><div style="font-size:12px;color:#889063">${esc(a.email)}</div></div></div></td>
        <td style="font-size:13px;max-width:220px"><div class="ellipsis">${esc(a.eventName)}</div></td>
        <td style="font-size:13px;color:#889063">${a.checkedInAt ? new Date(a.checkedInAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
        <td><button class="btn ${a.checkedInAt ? "btn-outline" : "btn-primary"} btn-sm" data-click="manager:checkin" data-id="${a.id}">${a.checkedInAt ? "Deshacer" : "Check-in"}</button></td>
      </tr>`).join("");
    const pills = [["todos", "Todos"], ["pendientes", "Por ingresar"], ["presentes", "Presentes"]].map(([k, l]) =>
      `<button class="pill ${ManagerApp.filter === k ? "active" : ""}" data-click="manager:filter" data-value="${k}">${l}</button>`).join("");
    return `
      <div class="page" style="--w:1100px">
        ${pageHeader({ eyebrow: "Operación", title: "Asistentes", subtitle: `Check-in: ${scope.filter((a) => a.checkedInAt).length} de ${scope.length} confirmados.` })}
        <div class="row" style="gap:12px;margin-bottom:16px;flex-wrap:wrap">
          ${searchBox({ id: "mgr-search", placeholder: "Buscar por nombre o email…", value: ManagerApp.search, handler: "manager:search" })}
          <select id="mgr-event" class="input" style="max-width:300px" data-input="manager:event">${Object.entries(evOpts).map(([k, l]) => `<option value="${esc(k)}" ${k === ManagerApp.eventId ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
          ${pills}
        </div>
        <div class="card"><table class="table"><thead><tr><th>Asistente</th><th>Evento</th><th>Ingreso</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4" style="text-align:center;color:#889063">Sin asistentes para mostrar.</td></tr>`}</tbody></table></div>
      </div>`;
  },
};

registerClick({
  "nav:manager": (el) => { ManagerApp.view = el.dataset.view; App.render({ resetScroll: true }); },
  "manager:avail": (el) => {
    const ev = ManagerApp.own(el.dataset.id); if (!ev) return;
    if (el.dataset.value === "closed") ManagerApp.closeId = ev.id; else ev.availability = el.dataset.value;
    rerender();
  },
  "manager:confirmClose": () => { const ev = ManagerApp.own(ManagerApp.closeId); if (ev) ev.availability = "closed"; ManagerApp.closeId = null; rerender(); },
  "manager:cancelClose": () => { ManagerApp.closeId = null; rerender(); },
  "manager:capOpen": (el) => { const ev = ManagerApp.own(el.dataset.id); if (!ev) return; Object.assign(ManagerApp, { capModal: ev.id, capValue: ev.capacity, capError: "" }); rerender(); },
  "manager:capClose": () => { ManagerApp.capModal = null; rerender(); },
  "manager:capStep": (el) => { ManagerApp.capValue = Math.max(0, ManagerApp.capValue + +el.dataset.d); rerender(); },
  "manager:capSave": () => {
    const ev = ManagerApp.own(ManagerApp.capModal); if (!ev) return;
    if (!(ManagerApp.capValue >= ev.registered)) { ManagerApp.capError = `El aforo no puede ser menor a los ${ev.registered} inscritos.`; rerender(); return; }
    ev.capacity = ManagerApp.capValue; ManagerApp.capModal = null; rerender();
  },
  "manager:filter": (el) => { ManagerApp.filter = el.dataset.value; rerender(); },
  "manager:checkin": (el) => {
    const a = Data.attendees.find((x) => x.id === el.dataset.id);
    if (!a || !ManagerApp.own(a.eventId) || a.status !== "confirmado") return;   // regla de pertenencia
    a.checkedInAt = a.checkedInAt ? null : new Date().toISOString(); rerender();
  },
});
registerInput({
  "manager:capInput": (el) => { ManagerApp.capValue = +el.value; },
  "manager:event":    (el) => { ManagerApp.eventId = el.value; rerender(); },
  "manager:search":   (el) => { ManagerApp.search = el.value; rerender(); },
});
