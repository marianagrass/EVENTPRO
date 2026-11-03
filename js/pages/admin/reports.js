/* ==========================================================
   pages/admin/reports.js — Dos tarjetas del dashboard del Admin
     RevenueReport  Ingresos por mes de 2026 como ÁREA BAJO LA CURVA
                    f(t) = ingresos del día t (COP/día) ·  ingreso del mes = ∫ f(t) dt ≈ Σ f(tᵢ)·Δt  (Δt = 1 día)
                    acumulado F(t) = ∫₀ᵗ f
     TrafficMonitor Modelo de saturación T(x) = k/(C−x) + Tb  y  T′(x) = k/(C−x)²  + simulador de carga
   Los números los calcula el servidor; aquí solo se dibujan.
   ========================================================== */
const RevenueReport = {
  year: 2026, status: "idle", data: null, error: "",
  invalidate() { if (this.status === "ok" || this.status === "error") this.status = "idle"; },
  ensure() {
    if (this.status !== "idle" || App.offline) return;
    this.status = "loading";
    api.get(`/admin/reports/revenue?year=${this.year}`)
      .then((d) => { this.data = d; this.status = "ok"; })
      .catch((e) => { this.error = e.message; this.status = "error"; })
      .finally(() => { if (App.mode === "admin" && App.adminView === "dashboard") rerender(); });
  },

  chart(months) {
    const W = 760, H = 270, L = 66, R = 78, T = 16, B = 34;
    const maxM = Math.max(...months.map((m) => m.revenueCop), 1), maxC = Math.max(...months.map((m) => m.cumulativeCop), 1);
    const slot = (W - L - R) / 12, bw = Math.min(34, slot - 10);
    const ym = (v) => T + (1 - v / maxM) * (H - T - B), yc = (v) => T + (1 - v / maxC) * (H - T - B);
    const cx = (i) => L + slot * i + slot / 2;
    const grid = [0, .25, .5, .75, 1].map((t) => {
      const yy = T + (1 - t) * (H - T - B);
      return `<line class="fin-grid" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/>
        <text class="fin-axis" x="${L - 8}" y="${yy + 4}" text-anchor="end">${copCompact(maxM * t)}</text>
        <text class="fin-axis" x="${W - R + 8}" y="${yy + 4}">${copCompact(maxC * t)}</text>`;
    }).join("");
    const bars = months.map((m, i) => `<rect class="rv-bar" x="${cx(i) - bw / 2}" y="${ym(m.revenueCop)}" width="${bw}" height="${Math.max(0, H - B - ym(m.revenueCop))}" rx="4"><title>${m.label}: ${cop(m.revenueCop)} (${m.tickets} entradas)</title></rect>`).join("");
    const pts = months.map((m, i) => `${cx(i)},${yc(m.cumulativeCop)}`).join(" ");
    const dots = months.map((m, i) => `<circle class="fin-dot" cx="${cx(i)}" cy="${yc(m.cumulativeCop)}" r="3.8"><title>Acumulado al cierre de ${m.label}: ${cop(m.cumulativeCop)}</title></circle>`).join("");
    const labels = months.map((m, i) => `<text class="fin-axis" x="${cx(i)}" y="${H - 10}" text-anchor="middle">${m.label}</text>`).join("");
    return `<svg class="fin-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos por mes de ${this.year} (barras) e ingreso acumulado (línea)">${grid}${bars}<polyline class="fin-line" points="${pts}" fill="none"/>${dots}${labels}</svg>
      <div class="fin-legend"><span><i class="fin-key fin-key-bar rv-key"></i>Ingreso del mes ∫ f(t) dt (eje izq.)</span><span><i class="fin-key fin-key-line"></i>Acumulado F(t) (eje der.)</span></div>`;
  },

  render() {
    this.ensure();
    const d = this.data;
    if (!d) return `<div class="card fin-card" style="margin-bottom:24px"><div class="card-head"><h2>Ingresos por mes · ${this.year}</h2></div>
      <div class="fin-pad"><p class="cm-muted">${this.status === "error" ? esc(this.error) : "Calculando el reporte…"}</p></div></div>`;
    const rows = d.months.map((m) => `
      <tr><td>${m.label}</td><td class="rv-num">${cop(m.revenueCop)}</td><td class="rv-num">${cop(m.cumulativeCop)}</td><td class="rv-num">${m.tickets}</td>
        <td class="rv-num">${cop(m.avgDailyCop)}</td><td>${m.peakDay ? `${m.peakDay.date.slice(8)} · ${cop(m.peakDay.revenueCop)}` : "—"}</td></tr>`).join("");
    const ok = d.check.reconciled;
    return `
      <div class="card fin-card" style="margin-bottom:24px">
        <div class="card-head"><h2>Ingresos por mes · ${d.year}</h2><span class="fin-note">Total ${cop(d.totalCop)}</span></div>
        <div class="fin-pad">
          <p class="rv-method"><code>Ingreso(mes) = ∫ f(t) dt ≈ Σ f(tᵢ)·Δt</code> con f = ingresos del día (COP/día) y Δt = 1 día. El acumulado es la integral desde el 1 de enero.</p>
          ${this.chart(d.months)}
          <p class="rv-check ${ok ? "is-ok" : "is-bad"}" role="status">${icon(ok ? "check" : "alert", 15, { width: 2.6 })} ${ok ? "Verificado: la integral coincide con la suma directa en SQL al peso." : `Diferencia de ${cop(Math.abs(d.check.diffCop))} frente a la suma en SQL: revisar.`}</p>
          <div class="table-scroll"><table class="table rv-table"><thead><tr><th>Mes</th><th>Ingreso ∫f</th><th>Acumulado F</th><th>Entradas</th><th>Promedio/día</th><th>Día pico</th></tr></thead><tbody>${rows}</tbody></table></div>
        </div>
      </div>`;
  },
};

const TrafficMonitor = {
  m: null, users: 60, seconds: 90, error: "", timer: null,
  start() { if (!this.timer) { this.timer = setInterval(() => this.poll(), 2000); this.poll(); } },
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } },
  active() { return App.mode === "admin" && App.adminView === "dashboard" && !App.offline; },
  async poll() {
    if (!this.active()) { this.stop(); return; }
    try { this.m = await api.get("/traffic/metrics"); this.error = ""; } catch (e) { this.error = e.message; }
    const host = document.getElementById("tm-live");
    if (host) host.innerHTML = this.live(); else rerender();     // solo se repinta la zona viva: el control deslizante no se interrumpe
  },

  curve(m) {
    // T'(x) = k/(C−x)² sobre [0, C−1) con el umbral crítico: el cruce es x_max = C − √(k/umbral)
    const W = 420, H = 150, L = 8, R = 8, T = 10, B = 22, top = m.criticalDT * 3;
    const X = (x) => L + (x / m.C) * (W - L - R), Y = (v) => T + (1 - Math.min(v, top) / top) * (H - T - B);
    let pts = ""; for (let x = 0; x <= m.C - 1; x += 1) pts += `${X(x).toFixed(1)},${Y(m.k / ((m.C - x) ** 2)).toFixed(1)} `;
    const xm = m.maxConcurrent;
    return `<svg class="tm-curve" viewBox="0 0 ${W} ${H}" role="img" aria-label="Curva de aceleración T′(x) y umbral crítico; límite de ${xm} usuarios concurrentes">
      <line class="fin-grid" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
      <line class="tm-thr" x1="${L}" x2="${W - R}" y1="${Y(m.criticalDT)}" y2="${Y(m.criticalDT)}"/>
      <text class="fin-axis" x="${W - R}" y="${Y(m.criticalDT) - 4}" text-anchor="end">umbral ${m.criticalDT}</text>
      <polyline class="tm-line" points="${pts}" fill="none"/>
      <line class="tm-xmax" x1="${X(xm)}" x2="${X(xm)}" y1="${T}" y2="${H - B}"/>
      <text class="fin-axis" x="${X(xm) - 4}" y="${T + 10}" text-anchor="end">x máx = ${xm}</text>
      <circle class="tm-now ${m.saturated ? "is-hot" : ""}" cx="${X(Math.min(m.x, m.C - 1))}" cy="${Y(m.dTdx ?? top)}" r="6"/>
      <text class="fin-axis" x="${L}" y="${H - 6}">0</text><text class="fin-axis" x="${W - R}" y="${H - 6}" text-anchor="end">C = ${m.C}</text></svg>`;
  },

  live() {
    const m = this.m;
    if (!m) return `<p class="cm-muted">${esc(this.error || "Leyendo el estado del servidor…")}</p>`;
    const f = (v, d = 2) => (v === null || v === undefined ? "∞" : Number(v).toFixed(d).replace(/\.?0+$/, ""));
    const pct = Math.min(100, Math.round((m.x / m.C) * 100));
    return `
      <div class="tm-status ${m.saturated ? "is-hot" : "is-ok"}" role="status">${icon(m.saturated ? "alert" : "check", 15, { width: 2.6 })}
        ${m.saturated ? "Saturado: los nuevos pagos entran a la Fila Virtual" : "Normal: los pagos entran directo"}</div>
      <div class="tm-kpis">
        <div><span>Usuarios x / C</span><strong>${m.x} / ${m.C}</strong></div>
        <div><span>T(x)</span><strong>${f(m.latencyMs)} ms</strong></div>
        <div><span>T′(x)</span><strong class="${m.saturated ? "is-hot" : ""}">${f(m.dTdx, 3)}</strong><small>umbral ${f(m.criticalDT)}</small></div>
        <div><span>En fila</span><strong>${m.queued}</strong><small>${m.admitted} pagando · ${m.simulated} simulados</small></div>
      </div>
      <div class="bar" style="height:8px;margin:10px 0 12px" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Uso de conexiones"><div class="bar-fill" style="width:${pct}%;background:${m.saturated ? "var(--danger)" : "var(--grad-primary)"}"></div></div>
      ${this.curve(m)}`;
  },

  render() {
    if (this.active()) this.start();
    const max = this.m ? this.m.C * 2 : 200;
    return `
      <div class="card fin-card" style="margin-bottom:24px">
        <div class="card-head"><h2>Tráfico del servidor</h2><span class="fin-note"><code>T(x) = k/(C−x) + Tb</code> · <code>T′(x) = k/(C−x)²</code></span></div>
        <div class="fin-pad tm">
          <div id="tm-live" class="tm-live">${this.live()}</div>
          <div class="tm-sim">
            <h3>Simular carga</h3>
            <p class="cm-muted">Suma usuarios ficticios pagando a la vez para ver cómo se activa la Fila Virtual. Solo demostración.</p>
            <label class="field-label" for="tm-users">Usuarios simultáneos: <strong id="tm-users-n">${this.users}</strong></label>
            <input id="tm-users" type="range" min="0" max="${max}" step="5" value="${this.users}" data-input="traffic:users" class="tm-range">
            <label class="field-label" for="tm-secs">Duración</label>
            <select id="tm-secs" class="input" data-input="traffic:secs">${[[30, "30 segundos"], [90, "90 segundos"], [300, "5 minutos"]].map(([v, l]) => `<option value="${v}" ${v === this.seconds ? "selected" : ""}>${l}</option>`).join("")}</select>
            <div class="row" style="gap:8px;margin-top:12px"><button class="btn btn-primary" style="flex:1" data-click="traffic:simulate">Simular</button><button class="btn btn-outline" style="flex:1" data-click="traffic:stop">Detener</button></div>
          </div>
        </div>
      </div>`;
  },
};
registerInput({
  "traffic:users": (el) => { TrafficMonitor.users = +el.value; const n = document.getElementById("tm-users-n"); if (n) n.textContent = el.value; },
  "traffic:secs": (el) => { TrafficMonitor.seconds = +el.value; },
});
registerClick({
  "traffic:simulate": async () => { if (await apiSend("POST", "/traffic/simulate", { users: TrafficMonitor.users, seconds: TrafficMonitor.seconds })) TrafficMonitor.poll(); },
  "traffic:stop": async () => { if (await apiSend("POST", "/traffic/simulate", { users: 0, seconds: 1 })) TrafficMonitor.poll(); },
});
