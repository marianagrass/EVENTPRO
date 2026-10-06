/* ==========================================================
   pages/user/user-my-events.js — "Mis inscripciones" (próximos y asistidos)
   ========================================================== */

const UserMyEventsPage = {
  render() {
    const myEvents = Data.events.filter((e) => UserApp.registrations.includes(e.id));
    const past     = myEvents.filter((e) => e.status === "completado");
    const upcoming = myEvents.filter((e) => e.status !== "completado").sort((a, b) => a.date.localeCompare(b.date));

    if (myEvents.length === 0) {
      return `
        <div class="page" style="--w:900px">
          ${pageHeader({ eyebrow: "Mi agenda", title: "Mis inscripciones" })}
          <div class="card" style="padding:60px 40px;text-align:center">
            <div class="empty-icon">${icon("calendar", 26, { color: "#cfbb99", width: 1.5 })}</div>
            <div style="font-family:var(--font-title);font-size:22px;margin-bottom:8px">Aún no te has inscrito a ningún evento</div>
            <p style="color:#889063;font-size:14px;margin-bottom:24px">Explora el catálogo y encuentra algo que te interese.</p>
          </div>
        </div>`;
    }

    const upcomingCards = upcoming.map((ev) => {
      const d = parseDate(ev.date);
      const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
      const color = TYPE_COLOR[ev.type];
      return `
        <div class="card card-md my-card">
          <div class="date-badge" style="width:60px;height:60px;border-radius:14px;background:${color}">
            <span class="date-badge-day" style="font-size:20px">${String(d.getDate()).padStart(2, "0")}</span>
            <span class="date-badge-month" style="font-size:11px">${d.toLocaleString("es-CO", { month: "short" })}</span>
          </div>

          <div style="flex:1;min-width:0">
            <div class="row" style="gap:8px;margin-bottom:4px;flex-wrap:wrap">
              <span class="chip" style="background:${color}18;color:${color}">${TYPE_LABEL[ev.type]}</span>
              ${daysLeft <= 7 && daysLeft > 0 ? `<span class="chip" style="background:#f0e8da;color:#6b5626">En ${daysLeft} día${daysLeft !== 1 ? "s" : ""}</span>` : ""}
            </div>
            <div style="font-family:var(--font-title);font-size:18px;font-weight:500;margin-bottom:6px">${esc(ev.name)}</div>
            <div class="row" style="gap:16px;font-size:13px;color:#889063;flex-wrap:wrap">
              <span>🕐 ${esc(ev.time)}</span>
              <span>📍 ${esc(ev.location.split(",")[0])}</span>
            </div>
            <div style="margin-top:12px">
              <div class="row" style="justify-content:space-between;font-size:11px;color:#cfbb99;margin-bottom:5px">
                <span>Ocupación del evento</span><span>${ev.registered}/${ev.capacity}</span>
              </div>
              <div class="bar bar-thin" style="background:#f5efe6">
                <div class="bar-fill" style="width:${percent(ev.registered, ev.capacity)}%;background:${color}"></div>
              </div>
            </div>
          </div>

          <button class="btn btn-danger" style="padding:8px 16px;flex-shrink:0" data-click="user:unregister" data-id="${ev.id}">Cancelar inscripción</button>
        </div>`;
    }).join("");

    const pastCards = past.map((ev) => {
      const d = parseDate(ev.date);
      return `
        <div class="card past-card">
          <div class="date-badge" style="width:40px;height:40px;border-radius:10px;background:#f5efe6">
            <span style="color:#cfbb99;font-size:13px;font-weight:700">${String(d.getDate()).padStart(2, "0")}</span>
            <span style="color:#cfbb99;font-size:9px;text-transform:uppercase">${d.toLocaleString("es-CO", { month: "short" })}</span>
          </div>
          <div style="flex:1;min-width:0">
            <div class="ellipsis" style="font-size:14px;font-weight:500;color:#889063">${esc(ev.name)}</div>
            <div style="font-size:12px;color:#cfbb99">${esc(ev.location.split(",")[0])}</div>
          </div>
          <span class="badge st-completado" style="color:#889063">Completado</span>
        </div>`;
    }).join("");

    return `
      <div class="page" style="--w:900px">
        ${pageHeader({
          eyebrow: "Mi agenda", title: "Mis inscripciones",
          subtitle: `${myEvents.length} evento${myEvents.length !== 1 ? "s" : ""} en total`,
        })}

        ${upcoming.length > 0 ? `
          <div style="margin-bottom:36px">
            <h2 class="list-title">Próximos</h2>
            <div class="col-stack" style="gap:12px">${upcomingCards}</div>
          </div>` : ""}

        ${past.length > 0 ? `
          <div>
            <h2 class="list-title" style="color:#cfbb99">Asistidos</h2>
            <div class="col-stack" style="gap:10px">${pastCards}</div>
          </div>` : ""}
      </div>`;
  },
};
