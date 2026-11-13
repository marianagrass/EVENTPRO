const AVAIL = { open: "Abierto", paused: "Pausado", closed: "Cerrado" };
const ACTIVE_STATUS = (e) => !["completado", "cancelado"].includes(e.status);
const ManagerApp = {
  view: "inicio", capModal: null, capValue: 0, capError: "", closeId: null,
  eventId: "todos", search: "", filter: "todos", attFilter: "todos", cancelRes: null, cancelCausa: "", cancelError: "", cancelBusy: false,
  events() { return Data.events; }, active() { return Data.events.filter(ACTIVE_STATUS); }, find(id) { return Data.events.find((e) => e.id === id); },
  pages() { return { inicio: MgrHomePage, eventos: MgrEventsPage, calendario: MgrCalendarPage, aforo: MgrCapacityPage, asistentes: MgrAttendeesPage }; },
  currentPage() { return this.pages()[this.view]; },
  render() { return AppShell.render({ sidebar: ManagerSidebar.render(), page: this.currentPage().render(), title: navTitle(MANAGER_NAV, this.view) }); },
};
const mgrModal = ({ title, body, cancel, confirm, label }) => `
  <div class="modal-backdrop" data-click="${cancel}" data-backdrop>
    <div class="modal modal-confirm" role="dialog" aria-modal="true"><h3 class="modal-confirm-title">${title}</h3>${body}
      <div class="modal-actions"><button class="btn btn-outline" data-click="${cancel}">Cancelar</button><button class="btn btn-primary" data-click="${confirm}">${label}</button></div></div></div>`;
const capFirst = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/* ----- Liquidación del Agente: función lineal L(E, T) = b·E + m·T  (el servidor la calcula; aquí solo se muestra) ----- */
const MgrCommission = {
  status: "idle",            // idle | loading | ok | error
  data: null, error: "",
  invalidate() { if (this.status === "ok" || this.status === "error") this.status = "idle"; },
  ensure() {
    if (this.status !== "idle" || !Session.user || App.offline) return;
    this.status = "loading";
    api.get(`/agents/${Session.user.id}/commission`)
      .then((d) => { this.data = d; this.status = "ok"; })
      .catch((e) => { this.error = e.code === "NETWORK" ? "" : e.message; this.status = "error"; })
      .finally(() => { if (App.mode === "manager" && ManagerApp.view === "inicio") rerender(); });
  },
  render() {
    this.ensure();
    const d = this.data;
    if (!d) {
      return `<section class="card card-pad cm" aria-busy="true"><div class="cm-head"><h2>Mi liquidación</h2></div>
        <p class="cm-muted">${this.status === "error" ? esc(this.error || "No se pudo calcular tu liquidación ahora.") : "Calculando tu liquidación…"}</p></section>`;
    }
    const r = d.rule;
    const rows = d.breakdown.slice(0, 5).map((b) => `
      <div class="cm-row"><div class="cm-row-name ellipsis">${esc(b.name)}<small>${esc(b.date)} · ${b.tickets} ${b.tickets === 1 ? "entrada" : "entradas"}</small></div><strong>${cop(b.subtotalCop)}</strong></div>`).join("");
    return `
      <section class="card card-pad cm" aria-label="Mi liquidación como agente">
        <div class="cm-head"><h2>Mi liquidación</h2><span class="cm-chip">${icon("dollar", 14, { width: 2.4 })} Comisión</span></div>
        <div class="cm-grid">
          <div class="cm-total"><span class="cm-label">Total a liquidar</span><strong class="cm-amount">${cop(d.commissionCop)}</strong>
            <code class="cm-formula">L(E, T) = b·E + m·T</code>
            <p class="cm-calc">${cop(r.perEventCop)} × ${d.eventsManaged} + ${cop(r.perTicketCop)} × ${d.ticketsManaged}</p></div>
          <div class="cm-stats">
            <div><span>Eventos gestionados (E)</span><strong>${d.eventsManaged}</strong><small>${cop(r.perEventCop)} c/u</small></div>
            <div><span>Entradas gestionadas (T)</span><strong>${d.ticketsManaged}</strong><small>${cop(r.perTicketCop)} c/u</small></div>
          </div>
          <div class="cm-break"><span class="cm-label">Por evento</span>${rows || `<p class="cm-muted">Aún no gestionas eventos: crea uno para empezar a sumar.</p>`}</div>
        </div>
      </section>`;
  },
};
const salesBadge = (ev) => {
  const s = ev.availability && ev.availability !== "open" ? null : ev.salesState;
  if (!s) return "";
  const t = { disponible: "Disponible", ultimos_cupos: "Últimos cupos", agotado: "Agotado" }[s];
  return t ? `<span class="sales-badge is-${s}">${t}</span>` : "";
};
const MgrHomePage = {
  render() {
    const evs = ManagerApp.active();
    const att = Data.attendees.filter((a) => a.status === "confirmado" && evs.some((e) => e.id === a.eventId));
    const reg = evs.reduce((s, e) => s + e.registered, 0), cap = evs.reduce((s, e) => s + e.capacity, 0);
    const sold = att.reduce((s, a) => s + (a.tickets || 1), 0);
    const restricted = evs.filter((e) => e.availability !== "open").length;
    const kpis = [["Eventos activos", evs.length, `de ${Data.events.length} en total`], ["Aforo ocupado", `${percent(reg, cap)}%`, `${reg} de ${cap} cupos`], ["Entradas vendidas", sold, `en ${att.length} reservas confirmadas`], ["Inscripción restringida", restricted, "pausados o cerrados"]]
      .map(([l, v, s]) => `<div class="kpi"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div><div class="kpi-sub">${s}</div></div>`).join("");
    const rows = [...evs].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6).map((ev) => {
      const d = parseDate(ev.date);
      return `<div class="dash-row"><div class="date-badge" style="background:${TYPE_COLOR[ev.type]}"><span class="date-badge-day">${String(d.getDate()).padStart(2, "0")}</span><span class="date-badge-month">${d.toLocaleString("es-CO", { month: "short" })}</span></div>
          <div class="dash-info"><div class="dash-name ellipsis">${esc(ev.name)}</div><div class="dash-meta">${esc(ev.location.split(",")[0])} · ${esc(ev.time)} · ${esc(priceLabel(ev))}</div>
            <div class="row" style="gap:8px"><div class="bar bar-thin" style="flex:1"><div class="bar-fill" style="width:${percent(ev.registered, ev.capacity)}%;background:${TYPE_COLOR[ev.type]}"></div></div><span class="dash-count">${ev.registered}/${ev.capacity}</span></div></div>
          <span class="badge avail-${ev.availability}">${AVAIL[ev.availability]}</span></div>`;
    }).join("");
    const recent = [...Data.attendees].sort((x, y) => String(y.registeredAt).localeCompare(String(x.registeredAt))).slice(0, 5)
      .map((r) => `<div class="dash-row dash-row-top"><div class="avatar" style="width:34px;height:34px;font-size:12px;background:${avatarColor(r.name)}">${esc(initials(r.name))}</div>
          <div class="dash-info"><div class="task-title">${esc(r.name)}</div><div class="dash-meta" style="margin:0">${esc(r.eventName)} · ${r.tickets} ${r.tickets === 1 ? "entrada" : "entradas"} · ${cop(r.total)}</div></div>
          ${statusBadge(r.status)}</div>`).join("");
    const today = capFirst(new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    return `<div class="page" style="--w:1680px">
        ${pageHeader({ eyebrow: today, title: `Hola, ${esc(Session.firstName)}`, subtitle: "Resumen operativo de todos los eventos de la plataforma.", action: `<button class="btn btn-primary" data-click="manager:newEvent">${icon("plus", 16, { width: 2.5 })} Crear evento</button>` })}
        <div class="grid-kpi">${kpis}</div>${MgrCommission.render()}<div class="grid-dash">
          <div class="card"><div class="card-head"><h2>Próximos eventos</h2><button class="btn btn-light" data-click="nav:manager" data-view="eventos">Gestionar</button></div>${rows || `<p class="card-pad">No hay eventos activos.</p>`}</div>
          <div class="card"><div class="card-head"><h2>Reservas recientes</h2><button class="btn btn-light" data-click="nav:manager" data-view="asistentes">Ver todas</button></div>${recent || `<p class="card-pad">Aún no hay reservas.</p>`}</div></div></div>`;
  },
};
/* ----- Demanda y precio dinámico: r(t) = dI/dt y sus máximos locales (el análisis lo hace el servidor) ----- */
const MgrPricing = {
  eventId: null, status: "idle", result: null, error: "", applying: false,
  async open(id) {
    Object.assign(this, { eventId: id, status: "loading", result: null, error: "", applying: false }); rerender();
    try { this.result = await api.get(`/events/${id}/pricing`); this.status = "ok"; }
    catch (e) { this.error = e.message; this.status = "error"; }
    rerender();
  },
  close() { this.eventId = null; rerender(); },
  async apply() {
    if (this.applying) return;
    this.applying = true; rerender();
    try {
      const r = await api.post(`/events/${this.eventId}/pricing/evaluate`);
      this.result = r; this.applying = false;
      Toast.show(r.decision.applied ? `Precio actualizado a ${cop(r.decision.newPriceCop)}.` : "No hubo cambios de precio.", r.decision.applied ? "ok" : "error", 3500);
      await syncData();
    } catch (e) { this.applying = false; Toast.show(e.message, "error"); rerender(); }
  },
  spark(a) {
    const rates = a.ratesCopPerHour || [];
    if (rates.length < 2) return `<p class="cm-muted">Todavía no hay suficientes ventas para analizar.</p>`;
    const max = Math.max(...rates, 1), w = 100 / rates.length;
    const peaks = new Set(a.peaks || []);
    const bars = rates.map((v, i) => `<rect x="${(i * w + w * 0.12).toFixed(2)}" y="${(100 - (v / max) * 96).toFixed(2)}" width="${(w * 0.76).toFixed(2)}" height="${((v / max) * 96).toFixed(2)}" rx="1.2" class="${peaks.has(i) ? "pk-peak" : "pk-bar"}"/>`).join("");
    return `<svg class="pk-spark" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Tasa de ventas por intervalo, ${peaks.size} máximo(s) local(es)">${bars}</svg>
      <div class="pk-legend"><span><i class="pk-dot"></i> Tasa r = dI/dt</span><span><i class="pk-dot is-peak"></i> Máximo local</span></div>`;
  },
  render() {
    const ev = ManagerApp.find(this.eventId);
    if (!this.eventId || !ev) return "";
    let body;
    if (this.status === "loading") body = `<p class="cm-muted">Analizando las ventas…</p>`;
    else if (this.status === "error") body = `<p class="auth-error" role="alert">${esc(this.error)}</p>`;
    else {
      const r = this.result, d = r.decision, a = r.analysis;
      const label = { raise: "Subir precio", lower: "Bajar precio", hold: "Mantener precio" }[d.action] || d.action;
      body = `
        <div class="pk-kpis">
          <div><span>Tasa actual</span><strong>${cop(a.lastRate)}/h</strong></div>
          <div><span>Promedio</span><strong>${cop(a.meanRate)}/h</strong></div>
          <div><span>Precio</span><strong>${cop(r.event.currentPriceCop)}</strong><small>base ${cop(r.event.basePriceCop)} · tope ${cop(r.event.maxPriceCop)}</small></div>
        </div>
        ${this.spark(a)}
        <div class="pk-decision is-${d.action}"><strong>${label}${d.action !== "hold" ? ` → ${cop(d.newPriceCop)}` : ""}</strong><p>${esc(d.reason)}</p></div>`;
    }
    const canApply = this.status === "ok" && this.result.decision.action !== "hold" && !this.result.decision.applied;
    return `<div class="modal-backdrop" data-click="manager:priceClose" data-backdrop>
      <div class="modal" style="--w:520px" role="dialog" aria-modal="true" aria-labelledby="pk-title">
        <h2 class="modal-title" id="pk-title">Demanda · ${esc(ev.name)}</h2>${body}
        <div class="modal-form-actions"><button class="btn btn-outline btn-block" data-click="manager:priceClose">Cerrar</button>
          ${canApply ? `<button class="btn btn-primary btn-block" data-click="manager:priceApply" ${this.applying ? "disabled" : ""}>${this.applying ? "Aplicando…" : "Aplicar ajuste"}</button>` : ""}</div>
      </div></div>`;
  },
};
const MgrCapacityPage = {
  render() {
    const cards = ManagerApp.active().map((ev) => {
      const free = ev.capacity - ev.registered;
      return `<div class="card card-pad">
          <div class="row" style="justify-content:space-between;margin-bottom:10px"><span class="eyebrow">${esc(TYPE_LABEL[ev.type])}</span><span class="row" style="gap:6px">${salesBadge(ev)}<span class="badge avail-${ev.availability}">${AVAIL[ev.availability]}</span></span></div>
          <h3 class="card-title" style="margin-bottom:12px">${esc(ev.name)}</h3>
          <div class="row" style="justify-content:space-between;align-items:baseline"><span class="kpi-value" style="font-size:30px">${ev.registered}<small style="font-size:14px;color:var(--muted-2)"> / ${ev.capacity}</small></span><span class="dash-count">${free} libres</span></div>
          <div class="bar" style="margin:12px 0 16px"><div class="bar-fill" style="width:${percent(ev.registered, ev.capacity)}%;background:${TYPE_COLOR[ev.type]}"></div></div>
          ${ev.price > 0 ? `<div class="cm-price"><span>Precio base <strong>${cop(ev.basePrice || ev.price)}</strong></span><span>Actual <strong class="${ev.basePrice && ev.price > ev.basePrice ? "is-up" : ""}">${cop(ev.price)}</strong></span></div>` : ""}
          <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn btn-outline" style="flex:1" data-click="manager:capOpen" data-id="${ev.id}">Modificar aforo</button>
          ${ev.price > 0 ? `<button class="btn btn-light" style="flex:1" data-click="manager:priceOpen" data-id="${ev.id}">${icon("trending", 15, { width: 2.2 })} Demanda</button>` : ""}</div></div>`;
    }).join("");
    const ev = ManagerApp.find(ManagerApp.capModal);
    const modal = ev ? mgrModal({
      title: "Modificar aforo", cancel: "manager:capClose", confirm: "manager:capSave", label: "Guardar",
      body: `<p class="modal-confirm-text">${esc(ev.name)}<br>Mínimo permitido: ${ev.registered} (inscritos actuales).</p>
        <div class="row" style="gap:8px;margin:14px 0"><button class="btn btn-outline" data-click="manager:capStep" data-d="-10">−10</button>
          <input id="cap-input" class="input" type="number" min="${ev.registered}" value="${ManagerApp.capValue}" data-input="manager:capInput" style="text-align:center">
          <button class="btn btn-outline" data-click="manager:capStep" data-d="10">+10</button></div>${ManagerApp.capError ? `<p class="auth-error" role="alert">${esc(ManagerApp.capError)}</p>` : ""}`,
    }) : "";
    return `<div class="page" style="--w:1680px">
        ${pageHeader({ eyebrow: "Operación", title: "Control de cupos y aforo", subtitle: "Ajusta la capacidad de cada evento. No puede bajar de los inscritos actuales." })}
        <div class="grid-cards" style="--min:320px">${cards}</div>${modal}${MgrPricing.render()}</div>`;
  },
};
const MgrAttendeesPage = {
  inScope() { return Data.attendees.filter((a) => ManagerApp.eventId === "todos" || a.eventId === ManagerApp.eventId); },
  list() {
    const f = ManagerApp.attFilter, q = ManagerApp.search;
    return this.inScope().filter((a) => (f === "todos" || a.status === f) && (!q || matches(a.name, q) || matches(a.email, q)));
  },
  /** Cancelar una RESERVA exige la causa (columna RESERVA.causa_cancelacion) */
  cancelModalHtml() {
    const r = ManagerApp.cancelRes; if (!r) return "";
    return `<div class="modal-backdrop" data-click="manager:resCancelClose" data-backdrop><div class="modal modal-confirm" role="dialog" aria-modal="true" aria-labelledby="rc-title">
        <h3 class="modal-confirm-title" id="rc-title">Cancelar la reserva de ${esc(r.name)}</h3>
        <p class="modal-confirm-text">${esc(r.eventName)} · ${r.tickets} ${r.tickets === 1 ? "entrada" : "entradas"} · ${cop(r.total)}.<br>Se libera el cupo, se simula el reembolso y se revierten los puntos.</p>
        <label class="field-label" for="rc-causa" style="margin-top:12px">Causa de la cancelación</label>
        <textarea id="rc-causa" class="input" rows="3" maxlength="500" placeholder="Ej. El cliente no puede asistir" data-input="manager:causaInput" style="resize:vertical;min-height:84px">${esc(ManagerApp.cancelCausa)}</textarea>
        ${ManagerApp.cancelError ? `<p class="auth-error" role="alert" style="margin-top:10px">${esc(ManagerApp.cancelError)}</p>` : ""}
        <div class="modal-actions"><button class="btn btn-outline" data-click="manager:resCancelClose">Volver</button>
          <button class="btn btn-danger" data-click="manager:resCancelSave" ${ManagerApp.cancelBusy ? "disabled" : ""}>${ManagerApp.cancelBusy ? "Cancelando…" : "Cancelar reserva"}</button></div></div></div>`;
  },
  render() {
    const evOpts = { todos: "Todos los eventos", ...Object.fromEntries(Data.events.filter((e) => e.status !== "cancelado").map((e) => [e.id, e.name])) };
    const scope = this.inScope(), conf = scope.filter((a) => a.status === "confirmado");
    const tickets = conf.reduce((s, a) => s + (a.tickets || 1), 0);
    const rows = this.list().slice(0, 300).map((a) => {
      const action = a.status === "pendiente"
        ? `<button class="btn btn-outline btn-sm" data-click="manager:confirmAtt" data-id="${a.id}">Confirmar</button>` : "";
      const cancel = a.status !== "cancelado"
        ? `<button class="btn btn-outline btn-sm" data-click="manager:resCancelOpen" data-id="${a.id}" aria-label="Cancelar la reserva de ${esc(a.name)}">Cancelar</button>` : "";
      const note = a.status === "cancelado" && a.cancelReason ? `<div style="font-size:12px;color:var(--muted)" title="${esc(a.cancelReason)}">Causa: ${esc(a.cancelReason.length > 60 ? a.cancelReason.slice(0, 60) + "…" : a.cancelReason)}</div>` : "";
      return `<tr><td><div class="row" style="gap:12px"><div class="avatar" style="width:38px;height:38px;font-size:13px;background:${avatarColor(a.name)}">${esc(initials(a.name))}</div>
          <div><div style="font-size:14px;font-weight:500">${esc(a.name)}</div><div style="font-size:12px;color:var(--muted)">${esc(a.email)}</div></div></div></td>
        <td style="font-size:13px;max-width:220px"><div class="ellipsis">${esc(a.eventName)}</div></td>
        <td style="font-size:13px">${a.tickets}</td><td style="font-size:13px">${cop(a.total)}</td>
        <td>${statusBadge(a.status)}${note}</td>
        <td style="font-size:13px;color:var(--muted)">${a.registeredAt ? parseDate(String(a.registeredAt).slice(0, 10)).toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : "—"}</td>
        <td><div class="row" style="gap:8px">${action}${cancel || (action ? "" : `<span class="readonly">—</span>`)}</div></td></tr>`;
    }).join("");
    const pills = [["todos", "Todas"], ["confirmado", "Confirmadas"], ["pendiente", "Pendientes"], ["cancelado", "Canceladas"]].map(([k, l]) =>
      `<button class="pill ${ManagerApp.attFilter === k ? "active" : ""}" data-click="manager:attFilter" data-value="${k}">${l}</button>`).join("");
    return `<div class="page" style="--w:1680px">
        ${pageHeader({ eyebrow: "Operación", title: "Gestión de reservas", subtitle: `${conf.length} reservas confirmadas · ${tickets} entradas.` })}
        <div class="row" style="gap:12px;margin-bottom:16px;flex-wrap:wrap">${searchBox({ id: "mgr-search", placeholder: "Buscar por nombre o email…", value: ManagerApp.search, handler: "manager:search" })}
          <select id="mgr-event" class="input" style="max-width:320px" aria-label="Filtrar por evento" data-input="manager:event">${Object.entries(evOpts).map(([k, l]) => `<option value="${esc(k)}" ${k === ManagerApp.eventId ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></div>
        <div class="filters scroll-x" style="margin-bottom:16px">${pills}</div>
        <div class="card"><div class="table-scroll"><table class="table"><thead><tr><th>Cliente</th><th>Evento</th><th>Entradas</th><th>Total</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="7" style="text-align:center;color:var(--muted)">Sin reservas para mostrar.</td></tr>`}</tbody></table></div></div>
        ${this.cancelModalHtml()}</div>`;
  },
};
registerInput({ "manager:causaInput": (el) => { ManagerApp.cancelCausa = el.value; }, "manager:capInput": (el) => { ManagerApp.capValue = +el.value; }, "manager:event": (el) => { ManagerApp.eventId = el.value; rerender(); }, "manager:search": (el) => { ManagerApp.search = el.value; rerender(); } });
registerClick({
  "nav:manager": (el) => { ManagerApp.view = el.dataset.view; App.render({ resetScroll: true }); },
  "manager:newEvent": () => { ManagerApp.view = "eventos"; MgrEventsPage.openNew(); App.render({ resetScroll: true }); },
  "manager:capOpen": (el) => { const ev = ManagerApp.find(el.dataset.id); if (!ev) return; Object.assign(ManagerApp, { capModal: ev.id, capValue: ev.capacity, capError: "" }); rerender(); },
  "manager:priceOpen": (el) => MgrPricing.open(el.dataset.id),
  "manager:priceClose": () => MgrPricing.close(),
  "manager:priceApply": () => MgrPricing.apply(),
  "manager:capClose": () => { ManagerApp.capModal = null; rerender(); },
  "manager:capStep": (el) => { ManagerApp.capValue = Math.max(0, ManagerApp.capValue + +el.dataset.d); rerender(); },
  "manager:capSave": async () => {
    const ev = ManagerApp.find(ManagerApp.capModal); if (!ev) return;
    if (!(ManagerApp.capValue >= ev.registered)) { ManagerApp.capError = `El aforo no puede ser menor a los ${ev.registered} inscritos.`; rerender(); return; }
    await apiSend('PUT', `/events/${ev.id}/capacity`, {capacity: ManagerApp.capValue});
    ManagerApp.capModal = null; await syncData();
  },
  "manager:filter": (el) => { ManagerApp.filter = el.dataset.value; rerender(); },
  "manager:attFilter": (el) => { ManagerApp.attFilter = el.dataset.value; rerender(); },
  "manager:confirmAtt": async (el) => {
    const a = Data.attendees.find((x) => String(x.id) === el.dataset.id);
    if (a && a.status === "pendiente" && await apiSend("PUT", `/attendees/${a.id}/status`, { status: "confirmado" })) await syncData();
  },
  "manager:resCancelOpen": (el) => {
    const a = Data.attendees.find((x) => String(x.id) === el.dataset.id); if (!a) return;
    Object.assign(ManagerApp, { cancelRes: { id: a.id, name: a.name, eventName: a.eventName, tickets: a.tickets, total: a.total }, cancelCausa: "", cancelError: "", cancelBusy: false });
    rerender();
    const t = document.getElementById("rc-causa"); if (t) t.focus();
  },
  "manager:resCancelClose": () => { if (ManagerApp.cancelBusy) return; ManagerApp.cancelRes = null; rerender(); },
  "manager:resCancelSave": async () => {
    const r = ManagerApp.cancelRes; if (!r || ManagerApp.cancelBusy) return;
    const causa = ManagerApp.cancelCausa.trim();
    if (causa.length < 3) { ManagerApp.cancelError = "Escribe la causa de la cancelación (mínimo 3 caracteres)."; rerender(); return; }
    ManagerApp.cancelBusy = true; ManagerApp.cancelError = ""; rerender();
    try {
      await api.post(`/reservas/${r.id}/cancel`, { actorId: Session.user.id, causa });
      ManagerApp.cancelRes = null; ManagerApp.cancelBusy = false;
      Toast.show("Reserva cancelada.", "ok", 3000);
      await syncData();
    } catch (e) { ManagerApp.cancelBusy = false; ManagerApp.cancelError = e.message; rerender(); }
  },
});
