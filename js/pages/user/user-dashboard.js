/* ==========================================================
   pages/user/user-dashboard.js — Inicio del portal de usuario
   ========================================================== */

const UserDashboardPage = {
  render() {
    const regs = UserApp.registrations;
    const available = Data.events.filter((e) => e.status !== "completado" && e.status !== "cancelado");
    const myEvents  = Data.events.filter((e) => regs.includes(e.id));
    const featured  = available.filter((e) => !regs.includes(e.id)).slice(0, 3);
    const thisWeek  = available.filter((e) => {
      const diff = (parseDate(e.date).getTime() - Date.now()) / 86400000;
      return diff >= 0 && diff <= 7;
    }).length;

    const stats = [
      { label: "Disponibles", value: available.length, icon: "🎯", color: "#354024" },
      { label: "Inscritos",   value: regs.length,      icon: "✅", color: "#4c3d19" },
      { label: "Esta semana", value: thisWeek,         icon: "📅", color: "#889063" },
    ].map((s) => `
      <div class="stat-pill">
        <span style="font-size:24px">${s.icon}</span>
        <div>
          <div class="stat-pill-value" style="color:${s.color}">${s.value}</div>
          <div style="font-size:12px;color:#889063;margin-top:3px">${s.label}</div>
        </div>
      </div>`).join("");

    const myList = myEvents.map((ev) => {
      const d = parseDate(ev.date);
      const spots = UserApp.getSpots(ev.id);
      return `
        <div class="my-row">
          <div class="date-badge" style="width:50px;height:50px;background:${TYPE_STYLE[ev.type].gradient}">
            <span class="date-badge-day" style="font-weight:800">${String(d.getDate()).padStart(2, "0")}</span>
            <span class="date-badge-month">${d.toLocaleString("es-CO", { month: "short" })}</span>
          </div>
          <div style="flex:1;min-width:0">
            <div class="ellipsis" style="font-size:14px;font-weight:700">${esc(ev.name)}</div>
            <div style="font-size:12px;color:#889063;margin-top:2px">${esc(ev.location.split(",")[0])} · ${esc(ev.time)}</div>
          </div>
          <div style="font-size:12px;font-weight:600;flex-shrink:0;color:${spots <= 20 ? "#8b5000" : "#889063"}">${spots} cupos</div>
          <button class="btn btn-danger" style="padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600"
                  data-click="user:unregister" data-id="${ev.id}">Cancelar</button>
        </div>`;
    }).join("");

    const featuredCards = featured.map((ev) => {
      const spots = UserApp.getSpots(ev.id);
      const isFull = spots <= 0;
      const tc = TYPE_STYLE[ev.type];
      const d = parseDate(ev.date);
      const spotsBadge = isFull
        ? `<span class="img-badge" style="background:rgba(160,80,80,.9)">Agotado</span>`
        : `<span class="img-badge" style="background:${spots <= 20 ? "rgba(200,100,40,.9)" : "rgba(0,0,0,.5)"}">${spots} cupos</span>`;
      return `
        <div class="card card-hover feat-card">
          <div class="feat-img">
            <img src="${esc(ev.image)}" alt="${esc(ev.name)}" loading="lazy">
            <div class="img-shade" style="background:linear-gradient(to top,rgba(0,0,0,.7) 0%,transparent 60%)"></div>
            <div style="position:absolute;top:10px;left:10px"><span class="img-badge" style="background:${tc.gradient};color:#e5d7c4">${TYPE_LABEL[ev.type]}</span></div>
            <div style="position:absolute;top:10px;right:10px">${spotsBadge}</div>
            <h3 class="feat-title">${esc(ev.name)}</h3>
          </div>
          <div style="padding:14px 14px 12px">
            <div style="font-size:12px;color:#889063;margin-bottom:12px">
              ${d.toLocaleDateString("es-CO", { day: "numeric", month: "long" })} · ${esc(ev.location.split(",")[0])}
            </div>
            <button class="cta-btn" ${isFull ? "disabled" : `style="background:${tc.gradient}"`} data-click="user:register" data-id="${ev.id}">
              ${isFull ? "Sin cupos" : "Inscribirse"}
            </button>
          </div>
        </div>`;
    }).join("");

    return `
      <div class="page page-user" style="--w:1100px">
        <div class="hero">
          <div class="hero-blob"></div>
          <div style="position:relative">
            <p class="hero-eyebrow">Portal de eventos</p>
            <h1 class="hero-title">¡Hola, Carlos! 👋</h1>
            <p class="hero-text">
              Tienes <strong>${regs.length}</strong> evento${regs.length !== 1 ? "s" : ""} en tu agenda y
              <strong>${available.length - regs.length}</strong> más disponibles para explorar.
            </p>
            <div class="row" style="gap:10px">
              <button class="hero-btn hero-btn-solid" data-click="nav:user" data-view="eventos">Explorar eventos</button>
              <button class="hero-btn hero-btn-ghost" data-click="nav:user" data-view="mis-eventos">Ver mis inscripciones</button>
            </div>
          </div>
        </div>

        <div class="grid-3" style="gap:14px;margin-bottom:32px">${stats}</div>

        ${myEvents.length > 0 ? `
          <div style="margin-bottom:32px">
            <div class="section-head">
              <h2>Mis próximos eventos</h2>
              <button class="btn btn-light" style="font-weight:600" data-click="nav:user" data-view="mis-eventos">Ver todos</button>
            </div>
            <div class="col-stack" style="gap:10px">${myList}</div>
          </div>` : ""}

        <div>
          <div class="section-head" style="margin-bottom:16px">
            <h2>Eventos destacados</h2>
            <button class="btn btn-light" style="font-weight:600" data-click="nav:user" data-view="eventos">Ver todos</button>
          </div>
          <div class="grid-cards" style="--min:280px;gap:16px">${featuredCards}</div>
        </div>
      </div>`;
  },
};
