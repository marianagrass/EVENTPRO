/* Postgres en memoria (PGlite) con la misma interfaz mínima que pg.Pool. Solo para pruebas.
   Instalación opcional:  npm i -D @electric-sql/pglite
   Carga el modelo ER (010 → 013). */
const fs = require("fs");
const path = require("path");

const DEFAULT_FILES = ["010_modelo_er.sql", "011_soporte_negocio.sql", "012_catalogos.sql", "013_datos_demo.sql"];

async function createPglitePool({ files = DEFAULT_FILES } = {}) {
  const { PGlite, types } = require("@electric-sql/pglite");
  const { pgcrypto } = await import("@electric-sql/pglite/contrib/pgcrypto");
  // Igual que db.js con pg: NUMERIC (1700) llega como número, no como texto
  const db = new PGlite({ extensions: { pgcrypto }, parsers: { [types ? types.NUMERIC : 1700]: (v) => parseFloat(v) } });
  await db.exec("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  for (const f of files) await db.exec(fs.readFileSync(path.join(__dirname, "../../backend/db", f), "utf8"));
  return {
    query: async (sql, params) => { const r = await db.query(sql, params); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; },
    close: () => db.close(),
  };
}
const hasPglite = () => { try { require.resolve("@electric-sql/pglite"); return true; } catch (_) { return false; } };
module.exports = { createPglitePool, hasPglite, DEFAULT_FILES };
