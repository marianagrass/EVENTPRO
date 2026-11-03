/* ==========================================================
   routes/payments.js — Pagos, reportes, comisiones, precios dinámicos y fila virtual
   ========================================================== */
const express = require("express");
const checkoutController = require("../controllers/checkoutController");
const reportController = require("../controllers/reportController");
const pricingController = require("../controllers/pricingController");
const { handleError } = require("../lib/http-errors");

module.exports = function paymentRoutes({ pool, traffic }) {
  const r = express.Router();
  const pricing = pricingController({ pool });
  const checkout = checkoutController({ pool, traffic, onSale: (eventId) => pricing.evaluateEvent(eventId, { apply: true }) });
  const reports = reportController({ pool });

  /* ----- Checkout: pasa primero por el middleware de fila virtual (T'(x) > umbral → 429 + fila) ----- */
  r.get("/zones", checkout.zones);
  r.post("/checkout/quote", traffic.virtualQueueGate, checkout.quote);
  r.post("/checkout", traffic.virtualQueueGate, checkout.pay);
  r.post("/unregister", checkout.cancel);                       // cancelar inscripción (con reembolso simulado)

  /* ----- Fila virtual ----- */
  r.post("/queue/enter", (req, res) => {
    const userId = req.body && req.body.userId;
    res.json(traffic.enter(userId || null));
  });
  r.get("/queue/status/:ticket", (req, res) => res.json(traffic.status(req.params.ticket)));
  r.post("/queue/leave", (req, res) => { traffic.release(req.body && req.body.ticket); res.json({ success: true }); });

  /* ----- Monitor y simulador de carga (solo demostración; se desactiva con TRAFFIC_SIM=off) ----- */
  r.get("/traffic/metrics", (_req, res) => res.json(traffic.metrics()));
  r.post("/traffic/simulate", (req, res) => {
    if (!traffic.cfg.simulationEnabled) return res.status(403).json({ error: "El simulador de carga está desactivado." });
    const { users, seconds } = req.body || {};
    res.json(traffic.simulate(Number(users), Number(seconds)));
  });

  /* ----- Reportes ----- */
  r.get("/admin/reports/revenue", reports.monthlyRevenue);          // Admin: ∫ ingresos por mes
  r.get("/agents/:id/commission", reports.agentCommission);         // Agente: L(E,T) = b·E + m·T

  /* ----- Precios dinámicos ----- */
  r.get("/events/:id/pricing", pricing.show);                       // análisis (no cambia nada)
  r.post("/events/:id/pricing/evaluate", pricing.evaluate);         // evalúa y aplica si hay pico

  r.use((err, _req, res, _next) => handleError(res, err, "payments"));
  return { router: r, pricing, checkout, reports };
};
