/* ==========================================================
   pages/user/user-events.js — Catálogo "Explorar eventos" + inscripción
   ========================================================== */

const UserEventsPage = {
  search: "",
  typeFilter: "todos",
  confirmId: null,     // evento que se está por confirmar en el modal
  successId: null,     // muestra el aviso de "inscripción confirmada"
  successTimer: null,

  filtered() {
    return Data.events.filter((e) => {
      if (e.status === "cancelado") return false;
      const okType = this.typeFilter === "todos" || e.type === this.typeFilter;
      const okSearch = !this.search || matches(e.name, this.search) || matches(e.location, this.search);
      return okType && okSearch;
    });
  },

  renderCard(ev) {
    const spots = UserApp.getSpots(ev.id);
    const isFull = spots <= 0;
    const isLow = spots <= 20;
    const isRegistered = UserApp.registrations.includes(ev.id);
    const tc = TYPE_STYLE[ev.type];
    const d = parseDate(ev.date);
    const spotsPercent = percent(spots, ev.capacity);

    const spotsBadge = isFull
      ? `<span class="img-badge img-badge-lg" style="background:rgba(160,80,80,.9)">Agotado</span>`
      : `<span class="img-badge img-badge-lg" style="background:${isLow ? "rgba(200,100,40,.9)" : "rgba(0,0,0,.55)"}">${isLow ? "⚡ " : ""}${spots} cupos</span>`;

    const checkmark = isRegistered ? `
      <div class="reg-overlay"><div class="reg-check">${icon("check", 14, { color: "#cfbb99", width: 3 })}</div></div>` : "";

    const barBg = isFull ? "#a05050" : isLow ? "linear-gradient(90deg,#a06020,#d48040)" : tc.gradient;
    const countColor = isFull ? "#a05050" : isLow ? "#8b5000" : "#354024";

    const cta = isRegistered
      ? `<div class="row" style="gap:8px">
           <div class="registered-tag">${icon("check", 13, { color: "#cfbb99", width: 2.5 })}<span>Inscrito</span></div>
           <button class="btn btn-danger" style="padding:10px 14px;border-radius:12px;font-size:13px;font-weight:600"
                   data-click="user:unregister" data-id="${ev.id}">Cancelar</button>
         </div>`
      : `<button class="cta-btn cta-lg" ${isFull ? "disabled" : `style="background:${tc.gradient}"`} data-click="userEvents:ask" data-id="${ev.id}">
           ${isFull ? "Sin cupos disponibles" : "Inscribirse"}
         </button>`;

    return `
      <div class="card card-hover uev-card">
        <div class="uev-img">
          <img src="${esc(ev.image)}" alt="${esc(ev.name)}" loading="lazy">
          <div class="img-shade" style="background:linear-gradient(to top,rgba(0,0,0,.75) 0%,rgba(0,0,0,.1) 50%,transparent 100%)"></div>
          <div style="position:absolute;top:12px;left:12px"><span class="img-badge img-badge-lg" style="background:${tc.gradient};color:#e5d7c4">${TYPE_LABEL[ev.type]}</span></div>
          <div style="position:absolute;top:12px;right:12px">${spotsBadge}</div>
          <div style="position:absolute;bottom:0;left:0;right:0;padding:12px 16px">
            <h3 class="uev-title">${esc(ev.name)}</h3>
          </div>
          ${checkmark}
        </div>

        <div class="uev-body">
          <div class="col-stack" style="gap:5px;margin-bottom:12px">
            <div class="ev-meta-row" style="font-size:12px;font-weight:500">
              ${icon("calendar", 12)} ${d.toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "long" })} · ${esc(ev.time)}
            </div>
            <div class="ev-meta-row ellipsis" style="font-size:12px;color:#889063">${icon("pin", 12)} ${esc(ev.location)}</div>
          </div>

          <div style="margin-bottom:14px;margin-top:auto">
            <div class="row" style="justify-content:space-between;font-size:11px;margin-bottom:5px">
              <span style="color:#889063;font-weight:500">Cupos disponibles</span>
              <span style="font-weight:700;color:${countColor}">${isFull ? "Agotado" : `${spots} de ${ev.capacity}`}</span>
            </div>
            <div class="bar" style="height:6px;border-radius:4px">
              <div class="bar-fill" style="width:${Math.max(0, spotsPercent)}%;background:${barBg};transition:width .5s ease"></div>
            </div>
          </div>

          ${cta}
        </div>
      </div>`;
  },

  renderConfirmModal() {
    if (!this.confirmId) return "";
    const ev = Data.events.find((e) => e.id === this.confirmId);
    const spots = UserApp.getSpots(ev.id);
    const low = spots <= 20;
    const tc = TYPE_STYLE[ev.type];
    return `
      <div class="modal-backdrop" style="background:rgba(76,61,25,.45);backdrop-filter:blur(8px)" data-click="userEvents:cancel" data-backdrop>
        <div class="modal" style="padding:0;max-width:440px;border-radius:24px;overflow:hidden">
          <div style="position:relative;height:160px">
            <img src="${esc(ev.image)}" alt="${esc(ev.name)}" style="width:100%;height:100%;object-fit:cover">
            <div class="img-shade" style="background:linear-gradient(to top,rgba(0,0,0,.7),transparent)"></div>
            <div style="position:absolute;bottom:14px;left:20px;right:20px">
              <span class="img-badge img-badge-lg" style="background:${tc.gradient};color:#e5d7c4">${TYPE_LABEL[ev.type]}</span>
              <h3 style="font-family:var(--font-title);font-size:20px;font-weight:700;color:#fff;margin:6px 0 0;line-height:1.3">${esc(ev.name)}</h3>
            </div>
          </div>
          <div style="padding:20px 24px 24px">
            <div class="col-stack" style="gap:6px;margin-bottom:16px">
              <div style="font-size:13px;color:#6b5626">📅 ${parseDate(ev.date).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })} · ${esc(ev.time)}</div>
              <div style="font-size:13px;color:#889063">📍 ${esc(ev.location)}</div>
            </div>
            <div style="padding:12px 16px;border-radius:12px;margin-bottom:20px;
                        background:${low ? "rgba(160,100,20,.1)" : "#f5efe6"};border:1px solid ${low ? "rgba(160,100,20,.2)" : "#e8ddd0"}">
              <span style="font-size:13px;font-weight:500">${low ? "⚡ " : ""}Quedan <strong>${spots} cupos</strong> disponibles</span>
            </div>
            <div class="modal-actions">
              <button class="btn btn-outline btn-block" style="border-radius:12px" data-click="userEvents:cancel">Cancelar</button>
              <button class="btn btn-block" style="border-radius:12px;font-weight:700;color:#e5d7c4;background:${tc.gradient};box-shadow:0 4px 12px rgba(0,0,0,.15)"
                      data-click="userEvents:confirm" data-id="${ev.id}">Confirmar inscripción</button>
            </div>
          </div>
        </div>
      </div>`;
  },

  render() {
    const list = this.filtered();

    const typePills = Object.entries(TYPE_LABEL).map(([k, label]) => {
      const active = this.typeFilter === k;
      return `
        <button class="pill pill-lg ${active ? "active" : ""}" data-click="userEvents:type" data-value="${k}"
                ${active ? `style="background:${TYPE_STYLE[k].gradient}"` : ""}>
          <span class="pill-dot" style="width:8px;height:8px;background:${active ? "rgba(255,255,255,.6)" : TYPE_STYLE[k].bg}"></span>${label}
        </button>`;
    }).join("");

    return `
      <div class="page page-user" style="--w:1200px">
        <div style="margin-bottom:28px">
          <div class="eyebrow" style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">Catálogo</div>
          <h1 class="page-title" style="font-size:34px;font-weight:700">Explorar eventos</h1>
          <p class="page-subtitle" style="font-size:14px">Encuentra tu próxima experiencia y regístrate fácilmente.</p>
        </div>

        <div class="filters" style="gap:12px;margin-bottom:20px">
          ${searchBox({ id: "uevents-search", placeholder: "Buscar eventos…", value: this.search, handler: "userEvents:search", maxWidth: 420, large: true })}
        </div>

        <div class="filters" style="margin-bottom:28px">
          <button class="pill pill-lg ${this.typeFilter === "todos" ? "active" : ""}" data-click="userEvents:type" data-value="todos"
                  ${this.typeFilter === "todos" ? `style="background:linear-gradient(135deg,#4c3d19,#6b5626);box-shadow:0 4px 12px rgba(76,61,25,.3)"` : ""}>Todos</button>
          ${typePills}
        </div>

        ${this.successId ? `
          <div class="toast">
            ${icon("check", 20, { color: "#cfbb99", width: 2.5 })}
            <span>¡Inscripción confirmada! Revisa "Mis inscripciones".</span>
          </div>` : ""}

        <div class="grid-cards" style="--min:300px">${list.map((ev) => this.renderCard(ev)).join("")}</div>

        ${list.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-title">Sin eventos</div>
            <div class="empty-state-text">Prueba con otro filtro</div>
          </div>` : ""}

        ${this.renderConfirmModal()}
      </div>`;
  },
};

registerInput({
  "userEvents:search": (el) => { UserEventsPage.search = el.value; rerender(); },
});

registerClick({
  "userEvents:type":   (el) => { UserEventsPage.typeFilter = el.dataset.value; rerender(); },
  "userEvents:ask":    (el) => { UserEventsPage.confirmId = el.dataset.id; rerender(); },
  "userEvents:cancel": () => { UserEventsPage.confirmId = null; rerender(); },

  "userEvents:confirm": (el) => {
    const page = UserEventsPage;
    UserApp.register(el.dataset.id);
    page.confirmId = null;
    page.successId = el.dataset.id;
    rerender();

    // El aviso verde desaparece solo a los 3,5 segundos
    clearTimeout(page.successTimer);
    page.successTimer = setTimeout(() => {
      page.successId = null;
      if (App.currentPage() === page) rerender();
    }, 3500);
  },
});
