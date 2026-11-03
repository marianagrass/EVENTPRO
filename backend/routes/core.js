/* ==========================================================
   routes/core.js — CRUD de eventos, cuentas, asistentes y tareas
   (antes vivía todo dentro de server.js; ahora cada ruta usa handleError: nunca se filtra SQL al cliente)
   ========================================================== */
const express = require("express");
const { handleError, isUuid, HttpError } = require("../lib/http-errors");

module.exports = function coreRoutes({ pool }) {
  const r = express.Router();
  const q = (sql, params) => pool.query(sql, params);
  const needId = (v) => { if (!isUuid(v)) throw new HttpError("Identificador inválido.", 400); return v; };
  const route = (label, fn) => async (req, res) => { try { await fn(req, res); } catch (e) { handleError(res, e, label); } };

  /* ---------- GET ---------- */
  r.get("/events", route("GET /events", async (_req, res) => {
    const result = await q(`
      SELECT s.event_id AS id, s.name, s.type_code, s.event_date, e.start_time, e.location, e.description,
             e.image_url, s.capacity, s.price_cop, e.base_price_cop, e.status, s.availability, e.sales_state,
             e.is_featured, s.registered, s.revenue_cop, e.is_public,
             GREATEST(s.spots_left, 0) AS spots_left,
             COALESCE((SELECT array_agg(ec.category_code ORDER BY ec.category_code) FROM event_categories ec WHERE ec.event_id = s.event_id), '{}') AS categories
        FROM v_event_stats s JOIN events e ON e.id = s.event_id ORDER BY s.event_date ASC`);
    // revenue_cop es BIGINT → llega como texto: se convierte a número
    res.json(result.rows.map((row) => ({ ...row, revenue_cop: Number(row.revenue_cop) })));
  }));

  r.get("/accounts", route("GET /accounts", async (_req, res) => {
    const result = await q("SELECT id, name, email, role, status, phone, city, institution, loyalty_points, created_at, last_login_at FROM users ORDER BY created_at ASC");
    res.json(result.rows);
  }));

  r.get("/attendees", route("GET /attendees", async (_req, res) => {
    const result = await q(`
      SELECT a.id, a.user_id, a.name, a.email, a.phone, a.event_id, e.name AS event_name, a.status, a.zone_code,
             a.registered_at, a.checked_in_at
        FROM attendees a JOIN events e ON a.event_id = e.id`);
    res.json(result.rows);
  }));

  r.get("/tasks", route("GET /tasks", async (_req, res) => {
    const result = await q(`
      SELECT t.id, t.title, t.event_id, e.name AS event_name, t.assignee_id, u.name AS assignee, t.category, t.due_date, t.priority, t.status
        FROM tasks t LEFT JOIN events e ON t.event_id = e.id LEFT JOIN users u ON t.assignee_id = u.id`);
    res.json(result.rows);
  }));

  /* ---------- EVENTOS (Agente) ---------- */
  // price_cop = precio vigente (lo mueve el algoritmo de precios dinámicos); base_price_cop = precio fijado por el Agente.
  // Cuando el Agente edita el precio, ambos se igualan: se reinicia el ajuste dinámico.
  r.post("/events", route("POST /events", async (req, res) => {
    const b = req.body;
    const out = await q(
      `INSERT INTO events (name, type_code, event_date, start_time, location, description, image_url, capacity, price_cop, base_price_cop, status, availability, coordinator, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11, $12, $13) RETURNING id`,
      [b.name, b.type_code, b.event_date, b.start_time, b.location, b.description, b.image_url, b.capacity, b.price_cop, b.status, b.availability, b.coordinator, b.created_by]);
    res.json({ success: true, id: out.rows[0].id });
  }));

  r.put("/events/:id", route("PUT /events/:id", async (req, res) => {
    const b = req.body;
    await q(
      `UPDATE events SET name=$1, type_code=$2, event_date=$3, start_time=$4, location=$5, description=$6, image_url=$7,
              capacity=$8, price_cop=$9, base_price_cop=CASE WHEN $9 IS DISTINCT FROM price_cop THEN $9 ELSE base_price_cop END, status=$10, availability=$11, coordinator=$12, updated_at=now() WHERE id=$13`,
      [b.name, b.type_code, b.event_date, b.start_time, b.location, b.description, b.image_url, b.capacity, b.price_cop, b.status, b.availability, b.coordinator, needId(req.params.id)]);
    res.json({ success: true });
  }));

  r.delete("/events/:id", route("DELETE /events/:id", async (req, res) => {
    await q("DELETE FROM events WHERE id = $1", [needId(req.params.id)]);
    res.json({ success: true });
  }));

  r.put("/events/:id/availability", route("PUT availability", async (req, res) => {
    await q("UPDATE events SET availability = $1 WHERE id = $2", [req.body.availability, needId(req.params.id)]);
    res.json({ success: true });
  }));

  r.put("/events/:id/capacity", route("PUT capacity", async (req, res) => {
    await q("UPDATE events SET capacity = $1 WHERE id = $2", [req.body.capacity, needId(req.params.id)]);
    res.json({ success: true });
  }));

  /* ---------- CUENTAS (Admin) ---------- */
  r.post("/accounts", route("POST /accounts", async (req, res) => {
    await q("INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, crypt('123456', gen_salt('bf', 8)), $3)", [req.body.name, req.body.email, req.body.role]);
    res.json({ success: true });
  }));
  r.put("/accounts/:id/role", route("PUT role", async (req, res) => {
    await q("UPDATE users SET role = $1 WHERE id = $2", [req.body.role, needId(req.params.id)]);
    res.json({ success: true });
  }));
  r.put("/accounts/:id/status", route("PUT status", async (req, res) => {
    await q("UPDATE users SET status = $1 WHERE id = $2", [req.body.status, needId(req.params.id)]);
    res.json({ success: true });
  }));
  r.delete("/accounts/:id", route("DELETE account", async (req, res) => {
    await q("SELECT admin_delete_account($1, $2)", [req.body.adminId, needId(req.params.id)]);
    res.json({ success: true });
  }));
  r.put("/accounts/:id/profile", route("PUT profile", async (req, res) => {
    await q("UPDATE users SET name=$1, email=$2, phone=$3, city=$4, institution=$5, updated_at=now() WHERE id=$6",
      [req.body.name, req.body.email, req.body.phone, req.body.city, req.body.institution, needId(req.params.id)]);
    res.json({ success: true });
  }));

  /* ---------- ASISTENTES (Agente) ---------- */
  r.put("/attendees/:id/checkin", route("PUT checkin", async (req, res) => {
    await q("UPDATE attendees SET checked_in_at = CASE WHEN $1::boolean THEN now() ELSE null END, checked_in_by = CASE WHEN $1::boolean THEN $2::uuid ELSE null END WHERE id = $3",
      [req.body.checkin, req.body.agentId, needId(req.params.id)]);
    res.json({ success: true });
  }));
  r.put("/attendees/:id/status", route("PUT attendee status", async (req, res) => {
    await q("UPDATE attendees SET status = $1 WHERE id = $2", [req.body.status, needId(req.params.id)]);
    res.json({ success: true });
  }));
  r.post("/attendees/manual", route("POST manual attendee", async (req, res) => {
    const b = req.body;
    await q("INSERT INTO attendees (event_id, name, email, phone, status, price_paid_cop) VALUES ($1, $2, $3, $4, 'confirmado', (SELECT price_cop FROM events WHERE id=$1))", [b.eventId, b.name, b.email, b.phone]);
    res.json({ success: true });
  }));
  r.delete("/attendees/:id", route("DELETE attendee", async (req, res) => {
    await q("DELETE FROM attendees WHERE id = $1", [needId(req.params.id)]);
    res.json({ success: true });
  }));

  /* ---------- TAREAS (Agente) ---------- */
  r.post("/tasks", route("POST /tasks", async (req, res) => {
    const b = req.body;
    await q("INSERT INTO tasks (title, event_id, assignee_id, category, due_date, priority, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [b.title, b.eventId || null, b.assigneeId || null, b.category, b.dueDate || null, b.priority, b.status]);
    res.json({ success: true });
  }));
  r.put("/tasks/:id", route("PUT /tasks/:id", async (req, res) => {
    const b = req.body;
    await q("UPDATE tasks SET title=$1, event_id=$2, assignee_id=$3, category=$4, due_date=$5, priority=$6, status=$7, updated_at=now() WHERE id=$8",
      [b.title, b.eventId || null, b.assigneeId || null, b.category, b.dueDate || null, b.priority, b.status, needId(req.params.id)]);
    res.json({ success: true });
  }));
  r.put("/tasks/:id/status", route("PUT task status", async (req, res) => {
    await q("UPDATE tasks SET status=$1, updated_at=now() WHERE id=$2", [req.body.status, needId(req.params.id)]);
    res.json({ success: true });
  }));
  r.delete("/tasks/:id", route("DELETE /tasks/:id", async (req, res) => {
    await q("DELETE FROM tasks WHERE id=$1", [needId(req.params.id)]);
    res.json({ success: true });
  }));

  return r;
};
