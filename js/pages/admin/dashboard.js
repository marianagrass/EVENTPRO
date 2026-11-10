/* ==========================================================
   pages/admin/dashboard.js — Finanzas y estadísticas globales (Admin)
   El Admin NO opera eventos: aquí solo ve métricas de toda la plataforma:
     · Dinero recaudado (suma de lo pagado por cada inscrito)
     · Reporte de ingresos por mes (integral) y monitor de tráfico (reports.js)
     · Ingresos por categoría (tipo de evento)
     · Clientes registrados por ciudad (CLIENTE → PERSONA → CIUDAD)
     · Ocupación global (inscritos / aforo)
   Todo se calcula en vivo con Data.events y Data.accounts: si el Agente cambia un precio
   o el Admin elimina una cuenta, las cifras se actualizan.
   ========================================================== */

const copCompact = (v) => `$ ${new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`;

const FinanceStats = {
  /** Eventos que cuentan para el recaudo (los cancelados no) */
  events() { return Data.events.filter((e) => e.status !== "cancelado"); },

  totals() {
    const evs = this.events();
    const revenue   = evs.reduce((s, e) => s + eventRevenue(e), 0);
    const realized  = evs.filter((e) => e.status === "completado").reduce((s, e) => s + eventRevenue(e), 0);
    const tickets   = evs.filter((e) => e.price > 0).reduce((s, e) => s + e.registered, 0);
    const reg = evs.reduce((s, e) => s + e.registered, 0), cap = evs.reduce((s, e) => s + e.capacity, 0);
    return { revenue, realized, projected: revenue - realized, tickets, reg, cap, occupancy: percent(reg, cap) };
  },

  /** Ingresos por tipo de evento, de mayor a menor */
  byCategory() {
    const map = {};
    this.events().forEach((e) => { map[e.type] = (map[e.type] || 0) + eventRevenue(e); });
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    return Object.entries(map).map(([type, value]) => ({ type, value, share: percent(value, total) })).sort((a, b) => b.value - a.value);
  },

  /** Clientes por ciudad (PERSONA.id_ciudad → CIUDAD): las 8 ciudades con más clientes */
  clientsByCity() {
    const map = new Map();
    Data.accounts.filter((a) => a.role === "user").forEach((u) => { const k = u.city || "Sin ciudad"; map.set(k, (map.get(k) || 0) + 1); });
    return [...map.entries()].map(([city, n]) => ({ city, n })).sort((x, y) => y.n - x.n).slice(0, 8);
  },
};

const DashboardPage = {
  /* Barras horizontales: clientes registrados por ciudad */
  cityBars(rows) {
    if (!rows.length) return `<p class="fin-empty">Aún no hay clientes registrados.</p>`;
    const max = Math.max(...rows.map((r) => r.n), 1);
    return `<div class="col-stack" style="gap:12px">${rows.map((r) => `
      <div><div class="row" style="justify-content:space-between;font-size:13px;margin-bottom:4px"><span>${esc(r.city)}</span><strong>${r.n}</strong></div>
        <div class="bar bar-thin"><div class="bar-fill" style="width:${Math.round((r.n / max) * 100)}%;background:var(--primary-fg)"></div></div></div>`).join("")}</div>`;
  },

  donut(pct) {
    const r = 54, c = 2 * Math.PI * r;
    return `
      <svg class="fin-donut" viewBox="0 0 140 140" role="img" aria-label="Ocupación global ${pct}%">
        <circle class="fin-donut-bg" cx="70" cy="70" r="${r}" fill="none" stroke-width="14"/>
        <circle class="fin-donut-fg" cx="70" cy="70" r="${r}" fill="none" stroke-width="14" stroke-linecap="round"
                stroke-dasharray="${(pct / 100) * c} ${c}" transform="rotate(-90 70 70)"/>
        <text class="fin-donut-n" x="70" y="76" text-anchor="middle">${pct}%</text>
      </svg>`;
  },

  render() {
    const t = FinanceStats.totals();
    const byCity = FinanceStats.clientsByCity();
    const cats = FinanceStats.byCategory();
    const users = Data.accounts.filter((a) => a.role === "user");
    const cityCount = new Set(users.map((u) => u.city)).size;

    const kpis = [
      { label: "Dinero total recaudado", value: copCompact(t.revenue), sub: `${cop(t.revenue)} · ${cop(t.realized)} ya realizados`, ic: "dollar" },
      { label: "Usuarios registrados",   value: users.length, sub: `en ${cityCount} ${cityCount === 1 ? "ciudad" : "ciudades"} · ${Data.accounts.length} cuentas en total`, ic: "users" },
      { label: "Ocupación global",       value: `${t.occupancy}%`, sub: `${t.reg.toLocaleString("es-CO")} inscritos de ${t.cap.toLocaleString("es-CO")} cupos`, ic: "gauge" },
      { label: "Boletas vendidas",       value: t.tickets.toLocaleString("es-CO"), sub: "en eventos con cover o boletería", ic: "ticket" },
    ].map((k) => `
      <div class="kpi fin-kpi">
        <span class="fin-kpi-ic">${icon(k.ic, 20, { width: 1.8 })}</span>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value">${k.value}</div>
        <div class="kpi-sub">${esc(k.sub)}</div>
      </div>`).join("");

    const catRows = cats.map((c) => `
      <div class="fin-cat">
        <div class="fin-cat-top"><span><i class="pill-dot" style="background:${TYPE_COLOR[c.type]}"></i>${esc(TYPE_LABEL[c.type])}</span><strong>${cop(c.value)}</strong></div>
        <div class="bar" style="height:8px"><div class="bar-fill" style="width:${c.share}%;background:${TYPE_STYLE[c.type].gradient}"></div></div>
        <div class="fin-cat-share">${c.share}% del recaudo</div>
      </div>`).join("");

    const evRows = FinanceStats.events().map((e) => ({ e, rev: eventRevenue(e) })).sort((a, b) => b.rev - a.rev).map(({ e, rev }) => `
      <tr>
        <td><div style="font-size:14px;font-weight:500;max-width:340px" class="ellipsis">${esc(e.name)}</div>
            <div style="font-size:12px;color:var(--muted)">${parseDate(e.date).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}</div></td>
        <td><span class="chip acct-type" style="--c:${TYPE_COLOR[e.type]}">${esc(TYPE_LABEL[e.type])}</span></td>
        <td style="font-size:13px">${esc(priceLabel(e))}${e.price > 0 ? `<div style="font-size:11px;color:var(--muted)">zona general</div>` : ""}</td>
        <td style="font-size:13px">${e.registered} / ${e.capacity}<div class="bar bar-thin" style="width:90px;margin-top:5px"><div class="bar-fill" style="width:${percent(e.registered, e.capacity)}%;background:${TYPE_COLOR[e.type]}"></div></div></td>
        <td style="font-size:14px;font-weight:700">${rev > 0 ? cop(rev) : "—"}</td>
        <td><span class="badge ${e.status === "completado" ? "st-completado" : "st-planificado"}">${e.status === "completado" ? "Realizado" : "Proyectado"}</span></td>
      </tr>`).join("");

    const today = capFirst(new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    return `
      <div class="page" style="--w:1680px">
        ${pageHeader({ eyebrow: today, title: "Finanzas y estadísticas", subtitle: `Bienvenida, ${esc(Session.firstName)}. Métricas globales de toda la plataforma.` })}

        <div class="grid-kpi">${kpis}</div>

        <div class="fin-grid2">
          <div class="card fin-card">
            <div class="card-head"><h2>Clientes por ciudad</h2><span class="fin-note">${users.length} clientes</span></div>
            <div class="fin-pad">${this.cityBars(byCity)}</div>
          </div>
          <div class="card fin-card">
            <div class="card-head"><h2>Ocupación global</h2></div>
            <div class="fin-pad fin-occ">
              ${this.donut(t.occupancy)}
              <p>${t.reg.toLocaleString("es-CO")} inscritos de ${t.cap.toLocaleString("es-CO")} cupos en ${FinanceStats.events().length} eventos.</p>
            </div>
          </div>
        </div>

        ${RevenueReport.render()}

        <div class="card fin-card" style="margin-bottom:24px">
          <div class="card-head"><h2>Ingresos por categoría</h2><span class="fin-note">Total ${cop(t.revenue)}</span></div>
          <div class="fin-pad fin-cats">${catRows || `<p class="fin-empty">Aún no hay ingresos.</p>`}</div>
        </div>

        ${TrafficMonitor.render()}

        <div class="card">
          <div class="card-head"><h2>Recaudo por evento</h2><span class="fin-note">Recaudo real: lo pagado por cada inscrito</span></div>
          <div class="table-scroll"><table class="table">
            <thead><tr><th>Evento</th><th>Categoría</th><th>Precio</th><th>Ocupación</th><th>Recaudo</th><th>Estado</th></tr></thead>
            <tbody>${evRows}</tbody>
          </table></div>
        </div>
      </div>`;
  },
};
