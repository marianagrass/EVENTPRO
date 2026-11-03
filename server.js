/* ==========================================================
   server.js — Punto de entrada del backend (Node + Express + PostgreSQL/Neon)
   Arranque:  npm start     (necesita el archivo .env con DATABASE_URL; ver backend/.env.example)
   ========================================================== */
require("dotenv").config();                     // PRIMERO: db.js lee DATABASE_URL al cargarse
const pool = require("./db");
const { traffic } = require("./backend/lib/traffic");
const { createApp } = require("./backend/app");

const { app, pricing } = createApp({ pool, traffic });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API de EventPro corriendo en el puerto ${PORT}`);

  // Turnos de pago: expira y asciende a la fila cada segundo
  setInterval(() => traffic.tick(), 1000).unref();

  // Precios dinámicos: revisa cada minuto los eventos de pago abiertos (apágalo con DYNPRICE_JOB=off)
  if (process.env.DYNPRICE_JOB !== "off") {
    setInterval(() => { pricing.evaluateAllOpen().catch((e) => console.error("[precios dinámicos]", e.message)); }, 60 * 1000).unref();
  }
});
