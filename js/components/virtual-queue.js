/* ==========================================================
   components/virtual-queue.js — Pantalla de «Fila Virtual» (sala de espera)

   La muestra CheckoutModal cuando el backend responde 429 QUEUE_REQUIRED o status "queued":
   el middleware de tráfico midió que T'(x+1) = k/(C−x−1)² superó el umbral crítico, es decir, que cada
   usuario adicional empeoraría demasiado el tiempo de respuesta. Aquí el usuario espera su turno
   (el front consulta /api/queue/status cada 2 s) y entra solo al pago cuando le toca.
   ========================================================== */
const VirtualQueue = {
  whyOpen: false,
  startPosition: 0,                 // posición con la que entró (para dibujar el avance)

  etaText(seconds) {
    if (!seconds || seconds < 45) return "menos de 1 minuto";
    return `unos ${Math.max(1, Math.round(seconds / 60))} min`;
  },

  fmt(n, d = 2) { return n === null || n === undefined ? "∞" : Number(n).toFixed(d).replace(/\.?0+$/, ""); },

  render(snap) {
    const pos = snap && snap.position ? snap.position : 1;
    const ahead = snap && snap.ahead !== undefined ? snap.ahead : Math.max(0, pos - 1);
    const total = Math.max(this.startPosition, pos);
    const done = total > 1 ? Math.round(((total - pos) / (total - 1)) * 100) : 0;
    const m = (snap && snap.metrics) || null;
    const why = m ? `
      <div class="vq-why-body" id="vq-why">
        <p>El servidor mide cuánto <strong>empeora el tiempo de respuesta con cada usuario adicional</strong>. Con
          <em>x</em> usuarios pagando a la vez:</p>
        <p class="vq-math">T(x) = k / (C − x) + T<sub>b</sub> &nbsp;·&nbsp; T′(x) = k / (C − x)²</p>
        <div class="vq-stats">
          <div><span>Usuarios pagando (x)</span><strong>${m.x} / ${m.C}</strong></div>
          <div><span>Tiempo de respuesta T(x)</span><strong>${this.fmt(m.latencyMs)} ms</strong></div>
          <div><span>Aceleración T′(x)</span><strong class="${m.saturated ? "is-hot" : ""}">${this.fmt(m.dTdx, 3)}</strong></div>
          <div><span>Umbral crítico</span><strong>${this.fmt(m.criticalDT, 2)}</strong></div>
        </div>
        <p>Si T′(x) pasa del umbral, el pago se protege con esta fila para que el sistema no se sature.</p>
      </div>` : "";
    return `
      <div class="vq" role="status" aria-live="polite">
        <div class="vq-ring" aria-hidden="true"><span class="vq-pulse"></span><span class="vq-pulse vq-pulse-2"></span>
          <div class="vq-core"><small>Tu turno</small><b>${pos}</b></div></div>
        <h4 class="vq-title">Estás en la fila virtual</h4>
        <p class="vq-text">Hay muchas personas pagando en este momento. <strong>No cierres esta ventana</strong>: pasarás al pago automáticamente cuando sea tu turno.</p>
        <div class="vq-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${done}" aria-label="Avance en la fila"><i style="width:${Math.max(6, done)}%"></i></div>
        <div class="vq-meta">
          <div>${icon("users", 16, { width: 2 })}<span>Delante de ti: <strong>${ahead}</strong></span></div>
          <div>${icon("hourglass", 16, { width: 2 })}<span>Espera aproximada: <strong>${this.etaText(snap && snap.etaSeconds)}</strong></span></div>
        </div>
        <button type="button" class="vq-whybtn" data-click="checkout:toggleWhy" aria-expanded="${this.whyOpen}" aria-controls="vq-why">
          ${icon("activity", 15, { width: 2 })} ¿Por qué hay fila? ${icon(this.whyOpen ? "down" : "right", 14, { width: 2.4 })}</button>
        ${this.whyOpen ? why : ""}
        <button type="button" class="btn btn-outline btn-block vq-leave" data-click="checkout:leave">Salir de la fila</button>
      </div>`;
  },
};
registerClick({ "checkout:toggleWhy": () => { VirtualQueue.whyOpen = !VirtualQueue.whyOpen; rerender(); } });
