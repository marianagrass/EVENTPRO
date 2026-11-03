/* ==========================================================
   lib/traffic.js — Protección del servidor: modelo de saturación + fila virtual

   Modelo racional de latencia (x = usuarios concurrentes en el pago):

       T(x)  = k / (C − x) + Tb          tiempo de respuesta estimado (ms)
       T'(x) = k / (C − x)²              cuánto empeora cada usuario adicional (ms por usuario)

   Con pocos usuarios T' es casi 0; al acercarse x a C (asíntota vertical) T' se dispara.
   Regla del middleware:  si  T'(x + 1) > umbral crítico  →  el usuario NO entra al pago: se encola.
   Despejando:  k/(C−x)² ≤ d  ⇔  x ≤ C − √(k/d)   (x_max). Con los valores por defecto x_max = 80.

   Es una SIMULACIÓN: x = turnos de pago activos + carga simulada (POST /api/traffic/simulate).
   El estado vive en memoria (un solo proceso). Con varias instancias del servidor habría que
   moverlo a Redis o a una tabla de Postgres; la lógica no cambia.
   ========================================================== */
const crypto = require("crypto");
const { traffic: defaults } = require("../config/business");
const { latency, latencyRate, maxConcurrentForRate } = require("./calculus");

function createTraffic(overrides = {}, clock = () => Date.now()) {
  const cfg = { ...defaults, ...overrides };
  const params = { C: cfg.C, k: cfg.k, Tb: cfg.Tb };
  const maxConcurrent = maxConcurrentForRate(params, cfg.criticalDT);

  const admitted = new Map();   // ticket → { userId, since, expiresAt }
  const queue = [];             // [{ ticket, userId, enteredAt, lastPoll }]
  const phantom = { users: 0, until: 0 };

  const simulatedUsers = (now) => (phantom.until > now ? phantom.users : 0);
  const load = (now) => admitted.size + simulatedUsers(now);               // x
  /** ¿Cabe un usuario más sin pasar el umbral?  T'(x+1) ≤ umbral */
  const canAdmit = (now) => {
    const next = load(now) + 1;
    return next < cfg.C && latencyRate(next, params) <= cfg.criticalDT;
  };

  function purge(now) {
    for (const [ticket, s] of admitted) if (s.expiresAt <= now) admitted.delete(ticket);
    for (let i = queue.length - 1; i >= 0; i--) if (now - queue[i].lastPoll > cfg.queueStaleS * 1000) queue.splice(i, 1);
  }
  function admit(ticket, userId, now) {
    admitted.set(ticket, { userId, since: now, expiresAt: now + cfg.sessionTtlS * 1000 });
  }
  function promote(now) {
    while (queue.length && canAdmit(now)) {
      const q = queue.shift();
      admit(q.ticket, q.userId, now);
    }
  }
  function tick(now = clock()) { purge(now); promote(now); }

  function metrics(now = clock()) {
    const x = load(now);
    const T = latency(x, params), dT = latencyRate(x, params);
    return {
      x, C: cfg.C, k: cfg.k, Tb: cfg.Tb,
      latencyMs: Number.isFinite(T) ? Math.round(T * 100) / 100 : null,         // T(x)
      dTdx: Number.isFinite(dT) ? Math.round(dT * 10000) / 10000 : null,        // T'(x)
      criticalDT: cfg.criticalDT, maxConcurrent,
      admitted: admitted.size, queued: queue.length, simulated: simulatedUsers(now),
      saturated: !canAdmit(now),
    };
  }

  function snapshot(ticket, now = clock()) {
    const a = admitted.get(ticket);
    if (a) return { status: "admitted", ticket, expiresInS: Math.max(0, Math.round((a.expiresAt - now) / 1000)), metrics: metrics(now) };
    const idx = queue.findIndex((q) => q.ticket === ticket);
    if (idx >= 0) {
      const eta = Math.max(5, Math.ceil(((idx + 1) * cfg.avgSessionS) / Math.max(1, maxConcurrent)));
      return { status: "queued", ticket, position: idx + 1, ahead: idx, etaSeconds: eta, metrics: metrics(now) };
    }
    return { status: "unknown", ticket, metrics: metrics(now) };
  }

  /** Puerta de entrada al pago: o te dan turno ahora, o quedas en la fila (FIFO). */
  function enter(userId = null, now = clock()) {
    tick(now);
    if (userId) {
      for (const [ticket, s] of admitted) if (s.userId === userId) return snapshot(ticket, now);
      const q = queue.find((e) => e.userId === userId);
      if (q) { q.lastPoll = now; return snapshot(q.ticket, now); }
    }
    const ticket = crypto.randomUUID();
    if (queue.length === 0 && canAdmit(now)) admit(ticket, userId, now);
    else queue.push({ ticket, userId, enteredAt: now, lastPoll: now });
    return snapshot(ticket, now);
  }

  function status(ticket, now = clock()) {
    tick(now);
    const q = queue.find((e) => e.ticket === ticket);
    if (q) q.lastPoll = now;
    return snapshot(ticket, now);
  }

  const touch = (ticket, now = clock()) => { const s = admitted.get(ticket); if (s) s.expiresAt = now + cfg.sessionTtlS * 1000; };
  const isAdmitted = (ticket, now = clock()) => { tick(now); return admitted.has(ticket); };
  function release(ticket, now = clock()) {
    admitted.delete(ticket);
    const i = queue.findIndex((e) => e.ticket === ticket);
    if (i >= 0) queue.splice(i, 1);
    tick(now);
  }
  function simulate(users, seconds, now = clock()) {
    phantom.users = Math.max(0, Math.min(Math.floor(users) || 0, cfg.C * 2));
    phantom.until = now + Math.max(1, Math.min(Math.floor(seconds) || 60, 3600)) * 1000;
    tick(now);
    return metrics(now);
  }
  function reset() { admitted.clear(); queue.length = 0; phantom.users = 0; phantom.until = 0; }

  /**
   * MIDDLEWARE de Express. Se pone delante de las rutas del pago:
   *   · con turno vigente (cabecera X-Queue-Ticket)  → pasa
   *   · sin turno y T'(x+1) ≤ umbral                  → se le da turno al vuelo y pasa
   *   · sin turno y T'(x+1) > umbral                  → 429 + datos de la fila: el front muestra la «Fila Virtual»
   */
  function virtualQueueGate(req, res, next) {
    const now = clock();
    tick(now);
    const given = req.get("X-Queue-Ticket");
    if (given && admitted.has(given)) {
      touch(given, now);
      req.queueTicket = given;
      return next();
    }
    const userId = (req.body && req.body.userId) || null;
    const snap = enter(userId, now);
    if (snap.status === "admitted") {
      req.queueTicket = snap.ticket;
      res.set("X-Queue-Ticket", snap.ticket);
      return next();
    }
    res.set("Retry-After", String(Math.min(30, snap.etaSeconds || 5)));
    return res.status(429).json({ code: "QUEUE_REQUIRED", queue: true, error: "Hay mucha gente pagando ahora. Te pusimos en la fila virtual.", ...snap });
  }

  return { cfg, params, maxConcurrent, tick, metrics, enter, status, touch, release, isAdmitted, simulate, reset, virtualQueueGate, snapshot };
}

module.exports = { createTraffic, traffic: createTraffic() };
