/* ==========================================================
   db.js — Conexión a PostgreSQL (Neon)
   La cadena de conexión viene de .env (DATABASE_URL). NUNCA se escribe aquí ni se sube a Git.
   ========================================================== */
require("dotenv").config();                     // idempotente: también funciona si alguien importa db.js solo
const { Pool } = require("pg");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL. Copia backend/.env.example a .env y pega tu cadena de conexión de Neon.");
}

const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url || "");

const pool = new Pool({
  connectionString: url,
  // Neon trae certificado válido: se VERIFICA (no se desactiva la validación). Si la cadena ya trae
  // ?sslmode=..., esa opción manda. En una base local sin SSL se desactiva.
  ssl: isLocal ? false : { rejectUnauthorized: true },
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => console.error("[db] error en una conexión inactiva:", err.message));

module.exports = pool;
