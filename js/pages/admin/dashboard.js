/* ==========================================================
   pages/admin/dashboard.js — Finanzas y estadísticas globales (Admin)
   El Admin NO opera eventos: aquí solo ve métricas de toda la plataforma:
     · Dinero recaudado (precio × inscritos de cada evento)
     · Ingresos por categoría (tipo de evento)
     · Crecimiento de usuarios registrados (cuentas con rol «user», por mes)
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

  /** Usuarios registrados por mes: nuevos y acumulados */
  userGrowth() {
    const users = Data.accounts.filter((a) => a.role === "user");
    if (!users.length) return [];
    const keys = users.map((u) => u.createdAt.slice(0, 7)).sort();
    let [y, m] = keys[0].split("-").map(Number);
    const [ey, em] = keys[keys.length - 1].split("-").map(Number);
    const out = [];
    let acc = 0;
    while (y < ey || (y === ey && m <= em)) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const added = users.filter((u) => u.createdAt.startsWith(key)).length;
      acc += added;
      out.push({ key, label: new Date(y, m - 1, 1).toLocaleString("es-CO", { month: "short" }).replace(".", ""), added, total: acc });
      if (++m > 12) { m = 1; y++; }
    }
    return out;
  },
};

const DashboardPage = {
  /* Gráfico de línea: usuarios acumulados + barras de nuevos usuarios por mes */
  growthChart(series) {
    if (series.length < 2) return `<p class="fin-empty">Aún no hay suficientes datos de registro.</p>`;
    const W = 640, H = 250, L = 40, R = 14, T = 16, B = 34;
    const maxT = Math.max(...series.map((s) => s.total));
    const niceMax = Math.ceil(maxT / 10) * 10 || 10;
    const x = (i) => L + (i * (W - L - R)) / (series.length - 1);
    const y = (v) => T + (1 - v / niceMax) * (H - T - B);
    const maxAdd = Math.max(...series.map((s) => s.added)) || 1;
    const bw = Math.min(26, (W - L - R) / series.length - 10);

    const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const v = Math.round(niceMax * t), yy = y(v);
      return `<line class="fin-grid" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="fin-axis" x="${L - 8}" y="${yy + 4}" text-anchor="end">${v}</text>`;
    }).join("");
    const bars = series.map((s, i) => {
      const h = (s.added / maxAdd) * 54;
      return `<rect class="fin-bar" x="${x(i) - bw / 2}" y="${H - B - h}" width="${bw}" height="${h}" rx="4"><title>${s.added} nuevos en ${s.label}</title></rect>`;
    }).join("");
    const pts = series.map((s, i) => `${x(i)},${y(s.total)}`).join(" ");
    const area = `${L},${H - B} ${pts} ${x(series.length - 1)},${H - B}`;
    const dots = series.map((s, i) => `<circle class="fin-dot" cx="${x(i)}" cy="${y(s.total)}" r="4.5"><title>${s.total} usuarios al cierre de ${s.label}</title></circle>`).join("");
    const labels = series.map((s, i) => `<text class="fin-axis" x="${x(i)}" y="${H - 10}" text-anchor="middle">${s.label}</text>`).join("");
    return `
      <svg class="fin-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Usuarios registrados por mes: de ${series[0].total} en ${series[0].label} a ${series[series.length - 1].total} en ${series[series.length - 1].label}">
        ${grid}${bars}
        <polygon class="fin-area" points="${area}"/>
        <polyline class="fin-line" points="${pts}" fill="none"/>
        ${dots}${labels}
      </svg>
      <div class="fin-legend"><span><i class="fin-key fin-key-line"></i>Usuarios acumulados</span><span><i class="fin-key fin-key-bar"></i>Nuevos por mes</span></div>`;
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
    const growth = FinanceStats.userGrowth();
    const cats = FinanceStats.byCategory();
    const users = Data.accounts.filter((a) => a.role === "user");
    const last = growth[growth.length - 1], prev = growth[growth.length - 2];
    const growthPct = last && prev && prev.total ? Math.round(((last.total - prev.total) / prev.total) * 100) : 0;

    const kpis = [
      { label: "Dinero total recaudado", value: copCompact(t.revenue), sub: `${cop(t.revenue)} · ${cop(t.realized)} ya realizados`, ic: "dollar" },
      { label: "Usuarios registrados",   value: users.length, sub: `${last ? last.added : 0} nuevos este mes · ${growthPct >= 0 ? "+" : ""}${growthPct}% de crecimiento`, ic: "users" },
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
        <td style="font-size:13px">${esc(priceLabel(e))}</td>
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
            <div class="card-head"><h2>Crecimiento de usuarios registrados</h2><span class="fin-note">${users.length} cuentas de usuario</span></div>
            <div class="fin-pad">${this.growthChart(growth)}</div>
          </div>
          <div class="card fin-card">
            <div class="card-head"><h2>Ocupación global</h2></div>
            <div class="fin-pad fin-occ">
              ${this.donut(t.occupancy)}
              <p>${t.reg.toLocaleString("es-CO")} inscritos de ${t.cap.toLocaleString("es-CO")} cupos en ${FinanceStats.events().length} eventos.</p>
            </div>
          </div>
        </div>

        <div class="card fin-card" style="margin-bottom:24px">
          <div class="card-head"><h2>Ingresos por categoría</h2><span class="fin-note">Total ${cop(t.revenue)}</span></div>
          <div class="fin-pad fin-cats">${catRows || `<p class="fin-empty">Aún no hay ingresos.</p>`}</div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Recaudo por evento</h2><span class="fin-note">Recaudo = precio × inscritos</span></div>
          <div class="table-scroll"><table class="table">
            <thead><tr><th>Evento</th><th>Categoría</th><th>Precio</th><th>Ocupación</th><th>Recaudo</th><th>Estado</th></tr></thead>
            <tbody>${evRows}</tbody>
          </table></div>
        </div>
      </div>`;
  },
};
