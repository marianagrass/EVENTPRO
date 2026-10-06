// Referencia (Express). El frontend NO es seguridad: esto sí.
const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.sendStatus(403);

// El rol viaja en el JWT; las asignaciones se consultan en BD (cambian).
async function requireEventAssignment(req, res, next) {
  if (req.user.role === "admin") return next();
  const ok = await db.exists(
    `SELECT 1 FROM event_agents WHERE event_id=$1 AND agent_id=$2 AND revoked_at IS NULL`,
    [req.params.eventId, req.user.id]);
  return ok ? next() : res.sendStatus(404);          // 404: no revela si el evento existe
}

// Cadena de rutas del Agente (validate = Zod/Joi en modo strict: solo { availability } o { capacity })
// router.patch("/manager/events/:eventId/capacity", authenticate, requireRole("agent"), requireEventAssignment, validate(capacitySchema), setCapacity);
// Check-in anti-IDOR:
//   UPDATE attendees SET checked_in_at=now(), checked_in_by=$agent
//   WHERE id=$attendeeId AND event_id=$eventId AND status='confirmado'
// Aforo atómico: UPDATE events SET capacity=$1 WHERE id=$2
//   AND $1 >= (SELECT COUNT(*) FROM attendees WHERE event_id=$2 AND status IN ('confirmado','pendiente'))
module.exports = { requireRole, requireEventAssignment };
