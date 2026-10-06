/* ==========================================================
   pages/admin/calendar.js — Calendario mensual de eventos
   ========================================================== */

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const CalendarPage = {
  year: 2026,
  month: 8,          // 0 = enero … 8 = septiembre
  selected: null,    // fecha "YYYY-MM-DD" seleccionada

  dateString(day) {
    return `${this.year}-${String(this.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  },

  /* Lista de celdas: null = hueco, número = día del mes */
  cells() {
    const daysInMonth = new Date(this.year, this.month + 1, 0).getDate();
    let offset = new Date(this.year, this.month, 1).getDay() - 1; // la semana empieza en lunes
    if (offset < 0) offset = 6;
    const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  },

  renderCell(day, i, today) {
    if (!day) return `<div class="cal-cell cal-empty"></div>`;
    const ds = this.dateString(day);
    const dayEvents = Data.events.filter((e) => e.date === ds);
    const isToday = today.getFullYear() === this.year && today.getMonth() === this.month && today.getDate() === day;
    const isSel = this.selected === ds;

    const blocks = dayEvents.slice(0, 3).map((ev) => `
      <div class="cal-event" style="background:${TYPE_STYLE[ev.type].gradient}">
        <span class="cal-event-name">${esc(ev.name.length > 18 ? ev.name.slice(0, 17) + "…" : ev.name)}</span>
        <span class="cal-event-meta">${esc(ev.time)} · ${TYPE_LABEL[ev.type]}</span>
      </div>`).join("");

    return `
      <div class="cal-cell ${isSel ? "selected" : ""}" data-click="calendar:toggle" data-date="${ds}">
        <span class="cal-day ${isToday ? "today" : ""}">${day}</span>
        <div class="cal-events">
          ${blocks}
          ${dayEvents.length > 3 ? `<div class="cal-more">+${dayEvents.length - 3} más</div>` : ""}
        </div>
      </div>`;
  },

  renderSelected() {
    if (!this.selected) return "";
    const evs = Data.events.filter((e) => e.date === this.selected);
    const title = parseDate(this.selected).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

    const body = evs.length === 0
      ? `<p style="font-size:13px;color:#cfbb99">Sin eventos este día</p>`
      : evs.map((ev) => `
          <div class="cal-detail">
            <div style="background:${TYPE_STYLE[ev.type].gradient};padding:8px 12px">
              <div style="font-size:12px;font-weight:700;color:#e5d7c4">${TYPE_LABEL[ev.type]}</div>
              <div style="font-size:13px;font-weight:700;color:#fff;margin-top:2px;line-height:1.3">${esc(ev.name)}</div>
            </div>
            <div style="padding:8px 12px;background:#faf7f3">
              <div style="font-size:12px;color:#889063">${esc(ev.time)} · ${esc(ev.location.split(",")[0])}</div>
              <div style="font-size:12px;color:#cfbb99;margin-top:3px">${ev.registered} / ${ev.capacity} asistentes</div>
            </div>
          </div>`).join("");

    return `<div class="card card-md side-card"><h3>${title}</h3>${body}</div>`;
  },

  renderNext30() {
    const today = new Date();
    const items = Data.events
      .filter((e) => { const diff = (parseDate(e.date).getTime() - today.getTime()) / 86400000; return diff >= 0 && diff <= 30; })
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((ev) => `
        <div class="next-item" data-click="calendar:set" data-date="${ev.date}">
          <div class="next-bar" style="background:${TYPE_STYLE[ev.type].gradient}"></div>
          <div>
            <div style="font-size:13px;font-weight:600;color:#4c3d19;line-height:1.3">${esc(ev.name.split(" ").slice(0, 4).join(" "))}</div>
            <div style="font-size:11px;color:#889063;margin-top:2px">
              ${parseDate(ev.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} · ${esc(ev.time)}
            </div>
          </div>
        </div>`).join("");
    return `<div class="card card-md side-card"><h3>Próximos 30 días</h3>${items}</div>`;
  },

  render() {
    const today = new Date();

    const legend = Object.keys(TYPE_LABEL).map((k) => `
      <div class="row" style="gap:10px;margin-bottom:10px">
        <div style="width:28px;height:14px;border-radius:4px;flex-shrink:0;background:${TYPE_STYLE[k].gradient}"></div>
        <span style="font-size:13px">${TYPE_LABEL[k]}</span>
      </div>`).join("");

    return `
      <div class="page" style="--w:1180px">
        ${pageHeader({ eyebrow: "Vista", title: "Calendario" })}

        <div class="grid-calendar">
          <div class="card">
            <div class="card-head" style="padding:20px 24px">
              <button class="icon-btn" data-click="calendar:prev">${icon("left", 16)}</button>
              <h2 class="cal-month">${MONTHS[this.month]} ${this.year}</h2>
              <button class="icon-btn" data-click="calendar:next">${icon("right", 16)}</button>
            </div>
            <div class="cal-grid cal-weekdays">
              ${WEEKDAYS.map((d) => `<div>${d}</div>`).join("")}
            </div>
            <div class="cal-grid">
              ${this.cells().map((day, i) => this.renderCell(day, i, today)).join("")}
            </div>
          </div>

          <div class="side-col">
            <div class="card card-md side-card"><h3>Tipos de evento</h3>${legend}</div>
            ${this.renderSelected()}
            ${this.renderNext30()}
          </div>
        </div>
      </div>`;
  },
};

registerClick({
  "calendar:prev": () => {
    if (CalendarPage.month === 0) { CalendarPage.month = 11; CalendarPage.year--; } else { CalendarPage.month--; }
    rerender();
  },
  "calendar:next": () => {
    if (CalendarPage.month === 11) { CalendarPage.month = 0; CalendarPage.year++; } else { CalendarPage.month++; }
    rerender();
  },
  "calendar:toggle": (el) => {
    CalendarPage.selected = CalendarPage.selected === el.dataset.date ? null : el.dataset.date;
    rerender();
  },
  "calendar:set": (el) => { CalendarPage.selected = el.dataset.date; rerender(); },
});
