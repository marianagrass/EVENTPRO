/* Postgres en memoria (PGlite) con la misma interfaz mínima que pg.Pool. Solo para pruebas.
   Instalación opcional:  npm i -D @electric-sql/pglite */
const fs = require("fs");
const path = require("path");

async function createPglitePool({ files = ["001_schema.sql", "002_seed.sql", "004_payments.sql"] } = {}) {
  const { PGlite } = require("@electric-sql/pglite");
  const { pgcrypto } = await import("@electric-sql/pglite/contrib/pgcrypto");
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  for (const f of files) await db.exec(fs.readFileSync(path.join(__dirname, "../../backend/db", f), "utf8"));
  return {
    query: async (sql, params) => { const r = await db.query(sql, params); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; },
    close: () => db.close(),
  };
}
const hasPglite = () => { try { require.resolve("@electric-sql/pglite"); return true; } catch (_) { return false; } };
module.exports = { createPglitePool, hasPglite };
