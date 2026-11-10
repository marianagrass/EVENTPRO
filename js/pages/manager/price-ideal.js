/* ==========================================================
   pages/manager/price-ideal.js — «Precio ideal sugerido» en el formulario de eventos del Agente

   El navegador NO calcula nada: manda tipo, aforo, precio actual y (si el Agente quiere) M y k a
   POST /api/events/price-suggestion y dibuja la respuesta del servidor:
     D(x) = M − kx · I(x) = Mx − kx² · I′(x) = M − 2kx = 0 ⇒ x* = M/2k · I″(x) = −2k < 0 ⇒ máximo
   M y k se estiman solos con el historial; quedan visibles (y editables) en «Ver el cálculo».
   ========================================================== */
const PriceIdeal = {
  status: "idle",          // idle | loading | ok | error
  data: null, error: "",
  open: false,             // «Ver el cálculo y ajustar» desplegado
  manual: { M: "", k: "" },// vacío = automático
  _seq: 0, _timer: null,

  /** Al abrir el formulario: estado limpio y primer cálculo */
  start() { this.status = "idle"; this.data = null; this.error = ""; this.open = false; this.manual = { M: "", k: "" }; this.schedule(0); },
  stop() { clearTimeout(this._timer); this._seq++; },

  form() { return MgrEventsPage.form; },
  num(s) { const n = Number(String(s).trim().replace(",", ".")); return String(s).trim() !== "" && Number.isFinite(n) ? n : null; },

  schedule(ms = 350) {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.run(), ms);
  },

  async run() {
    if (!MgrEventsPage.modal) return;
    const f = this.form(), seq = ++this._seq;
    if (!(f.capacity >= 1)) { this.status = "idle"; this.data = null; this.paint(); return; }
    this.status = this.data ? this.status : "loading"; this.paint();
    const body = { typeCode: f.type, capacity: Math.round(f.capacity), eventId: MgrEventsPage.editingId || undefined, currentPrice: f.price >= 0 ? f.price : undefined };
    if (this.manual.M.trim() !== "") body.M = this.manual.M.trim();
    if (this.manual.k.trim() !== "") body.k = this.manual.k.trim();
    try {
      const d = await api.post("/events/price-suggestion", body);
      if (seq !== this._seq) return;
      this.data = d; this.status = "ok"; this.error = "";
    } catch (e) {
      if (seq !== this._seq) return;
      this.status = "error"; this.error = e.code === "NETWORK" ? "No hay conexión con el servidor para calcular el precio ideal." : e.message;
    }
    this.paint();
  },

  /** Repinta solo el resultado (los campos M y k no se tocan: no pierden el cursor al escribir) */
  paint() { const el = document.getElementById("pi-result"); if (el) el.innerHTML = this.result(); },

  usePrice() {
    const d = this.data; if (!d) return;
    const price = d.recommended.price;
    this.form().price = price;
    const input = document.querySelector('.modal [data-key="price"]');
    if (input) input.value = price;
    this.schedule(0);
  },

  /* ---------- vista ---------- */
  millions(v) { return Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1).replace(".", ",")} M` : cop(v); },
  k1000(k) { return (k * 1000).toFixed(2).replace(".", ",").replace(/,?0+$/, ""); },

  chart(d) {
    const c = d.curve, W = 520, H = 190, L = 12, R = 12, T = 14, B = 28;
    const maxI = Math.max(...c.revenue, 1);
    const X = (x) => L + (x / c.maxX) * (W - L - R), Y = (v) => T + (1 - Math.max(0, v) / maxI) * (H - T - B);
    const pts = c.xs.map((x, i) => `${X(x).toFixed(1)},${Y(c.revenue[i]).toFixed(1)}`);
    const area = `${X(0)},${H - B} ${pts.join(" ")} ${X(c.maxX)},${H - B}`;
    const best = d.recommended.price, cur = c.currentPrice;
    const mark = (x, cls, label, anchor, dy) => `<line class="pi-vline ${cls}" x1="${X(x)}" x2="${X(x)}" y1="${T}" y2="${H - B}"/><text class="pi-lbl ${cls}" x="${X(x)}" y="${H - B + dy}" text-anchor="${anchor}">${label}</text>`;
    return `<svg class="pi-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos según el precio del boleto: la parábola I(x) tiene su máximo en ${cop(d.optimum.price)}">
      <polygon class="pi-area" points="${area}"/><polyline class="pi-curve" points="${pts.join(" ")}" fill="none"/>
      <line class="pi-axis" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/>
      ${cur !== null && cur > 0 && cur <= c.maxX ? mark(cur, "is-cur", `Tu precio ${copCompact(cur)}`, cur > c.maxX * 0.7 ? "end" : "start", 14) : ""}
      ${mark(Math.min(best, c.maxX), "is-best", `Ideal ${copCompact(best)}`, best > c.maxX * 0.7 ? "end" : "middle", cur !== null && cur > 0 && Math.abs(cur - best) < c.maxX * 0.18 ? 26 : 14)}
      <circle class="pi-peak" cx="${X(d.optimum.price)}" cy="${Y(d.optimum.revenue)}" r="5.5"/>
      <text class="pi-lbl" x="${L}" y="${H - 4}">$0</text><text class="pi-lbl" x="${W - R}" y="${H - 4}" text-anchor="end">${copCompact(c.maxX)}</text></svg>`;
  },

  steps(d) {
    const g = d.guarantee, s = d.steps;
    return `
      <ol class="pi-steps">
        <li><span>Demanda</span><code>${esc(s.demand)}</code></li>
        <li><span>Ingresos</span><code>${esc(s.revenue)}</code></li>
        <li><span>1.ª derivada</span><code>${esc(s.firstDerivative)}</code></li>
        <li><span>Punto crítico</span><code>${esc(s.criticalEquation)} = ${cop(d.optimum.price)}</code></li>
        <li class="is-proof"><span>2.ª derivada</span><code>${esc(s.secondDerivative)} &lt; 0</code>
          <em>${icon("check", 14, { width: 2.8 })} Cóncava hacia abajo: x* es un máximo global, no un mínimo.</em></li>
      </ol>
      <p class="pi-numbers">Con ese precio: demanda D(x*) = M/2 = <strong>${Math.round(d.optimum.demand)}</strong> boletos · ingreso máximo I(x*) = M²/4k = <strong>${this.millions(d.optimum.revenue)}</strong>.</p>`;
  },

  result() {
    if (this.status === "idle") return `<p class="pi-muted">Escribe el aforo del evento para calcular el precio ideal.</p>`;
    if (!this.data && this.status === "loading") return `<p class="pi-muted" aria-busy="true">Calculando el precio ideal…</p>`;
    if (this.status === "error" && !this.data) return `<p class="pi-error" role="alert">${esc(this.error)}</p>`;
    const d = this.data, r = d.recommended, m = d.model, f = this.form();
    const same = Number(f.price) === r.price;
    const src = m.source === "historial" ? `Basado en <strong>${m.samples} eventos pagos</strong> parecidos · ajuste R² ${String(m.r2).replace(".", ",")} · confianza <strong>${m.confidence}</strong>`
      : m.source === "manual" ? `Con los valores de <strong>M</strong> y <strong>k</strong> que definiste`
      : `<strong>Estimación inicial</strong> (aún sin datos suficientes) · confianza baja`;
    const cmp = d.compare && d.compare.currentPrice > 0 && !same
      ? `<p class="pi-compare">Con tu precio actual (<strong>${cop(d.compare.currentPrice)}</strong>) el modelo estima ≈ ${d.compare.expectedTickets} boletos y <strong>${this.millions(d.compare.expectedRevenue)}</strong>.
         Con el ideal: <strong class="${d.compare.gainCop >= 0 ? "is-gain" : ""}">${d.compare.gainCop >= 0 ? "+" : "−"}${this.millions(Math.abs(d.compare.gainCop))}</strong> según el modelo.</p>` : "";
    return `
      ${this.status === "error" ? `<p class="pi-error" role="alert">${esc(this.error)} <span>Se muestra el último cálculo válido.</span></p>` : ""}
      <div class="pi-main">
        <div><span class="pi-label">Precio ideal del boleto (zona general)</span><strong class="pi-price">${cop(r.price)}</strong>
          <span class="pi-sub">≈ ${r.expectedTickets} boletos · ingresos ≈ <strong>${this.millions(r.expectedRevenue)}</strong>${r.soldOutExpected ? " · agota el aforo" : ""}</span></div>
        ${same ? `<span class="pi-ok">${icon("check", 16, { width: 2.8 })} Ya usas el precio ideal</span>`
               : `<button type="button" class="btn btn-primary" data-click="priceIdeal:use">Usar este precio</button>`}
      </div>
      ${cmp}
      ${d.warnings.length ? `<ul class="pi-warn">${d.warnings.map((w) => `<li>${icon("alert", 14, { width: 2.4 })}<span>${esc(w)}</span></li>`).join("")}</ul>` : ""}
      ${this.chart(d)}
      <p class="pi-src">${src}${this.manual.M.trim() || this.manual.k.trim() ? ` <button type="button" class="pi-link" data-click="priceIdeal:reset">Volver a la estimación automática</button>` : ""}</p>
      ${this.open ? this.steps(d) : ""}`;
  },

  inputs() {
    const d = this.data, m = d ? d.model : null;
    const phM = m ? String(m.auto.M).replace(".", ",") : "automático", phK = m ? String(m.auto.k).replace(".", ",") : "automático";
    return `
      <div class="pi-fields">
        <div class="co-field"><label class="field-label" for="pi-M">Mercado máximo M <small>(personas que irían si fuera gratis)</small></label>
          <input id="pi-M" class="input" inputmode="decimal" data-input="priceIdeal:field" data-key="M" value="${esc(this.manual.M)}" placeholder="Automático: ${esc(phM)}"></div>
        <div class="co-field"><label class="field-label" for="pi-k">Sensibilidad k <small>(boletos que se pierden por cada $1 más)</small></label>
          <input id="pi-k" class="input" inputmode="decimal" data-input="priceIdeal:field" data-key="k" value="${esc(this.manual.k)}" placeholder="Automático: ${esc(phK)}"></div>
      </div>
      <p class="pi-hint">Dejar un campo vacío = lo estima el sistema. ${m ? `Con los valores actuales, a ${cop(m.zeroDemandPrice)} (= M/k) nadie compraría y cada $1.000 de aumento cuesta ≈ ${this.k1000(m.k)} boletos.` : ""}
</p>`;
  },

  render() {
    return `
      <section class="pi" id="pi-panel" aria-label="Precio ideal sugerido">
        <div class="pi-head"><h3>${icon("trending", 17, { width: 2.4 })} Precio ideal sugerido</h3>
          <span class="pi-chip">I′(x) = M − 2kx = 0 ⇒ x = M / 2k</span></div>
        <div id="pi-result" aria-live="polite">${this.result()}</div>
        <button type="button" class="pi-toggle" data-click="priceIdeal:toggle" aria-expanded="${this.open}" aria-controls="pi-adv">
          ${this.open ? "Ocultar el cálculo" : "Ver el cálculo y ajustar M y k"} ${icon(this.open ? "up" : "down", 14, { width: 2.6 })}</button>
        <div id="pi-adv" ${this.open ? "" : "hidden"}>${this.open ? this.inputs() : ""}</div>
      </section>`;
  },
};

registerInput({
  "priceIdeal:field": (el) => { PriceIdeal.manual[el.dataset.key] = el.value; PriceIdeal.schedule(); },
});
registerClick({
  "priceIdeal:use": () => PriceIdeal.usePrice(),
  "priceIdeal:toggle": () => { PriceIdeal.open = !PriceIdeal.open; rerender(); },
  "priceIdeal:reset": () => { PriceIdeal.manual = { M: "", k: "" }; PriceIdeal.schedule(0); rerender(); },
});
