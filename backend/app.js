/* ==========================================================
   backend/app.js — Arma la aplicación Express (sin abrir el puerto: así se puede probar)
   ========================================================== */
const express = require("express");
const cors = require("cors");
const coreRoutes = require("./routes/core");
const paymentRoutes = require("./routes/payments");
const createModels = require("./models");
const { handleError } = require("./lib/http-errors");

function createApp({ pool, traffic }) {
  const app = express();
  app.use(cors({ exposedHeaders: ["X-Queue-Ticket", "Retry-After"] }));
  app.use(express.json());

  app.get("/api/health", async (_req, res) => {
    try { await pool.query("SELECT 1"); res.json({ ok: true }); }
    catch (_) { res.status(503).json({ ok: false, error: "Sin conexión con la base de datos." }); }
  });

  const models = createModels(pool);
  const payments = paymentRoutes({ models, traffic });
  app.use("/api", coreRoutes({ models }));
  app.use("/api", payments.router);

  // JSON mal formado, rutas inexistentes y cualquier error que se escape
  app.use("/api", (_req, res) => res.status(404).json({ error: "Ruta no encontrada." }));
  app.use((err, _req, res, _next) => {
    if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "El cuerpo de la petición no es JSON válido." });
    return handleError(res, err, "app");
  });
  return { app, pricing: payments.pricing };
}

module.exports = { createApp };
