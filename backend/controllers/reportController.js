/* ==========================================================
   controllers/reportController.js — Reportes acumulados (integrales) y comisiones del Agente
   ========================================================== */
const { integrate, cumulative } = require("../lib/calculus");
const { HttpError, isUuid, handleError } = require("../lib/http-errors");

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

module.exports = function reportController({ pool }) {
  /**
   * Reporte del Admin: ingresos por mes de un año como ÁREA BAJO LA CURVA.
   *   f(t) = flujo de ingresos del día t (COP/día)  — viene de las boletas pagadas
   *   Ingreso del mes  = ∫ f(t) dt  sobre los días del mes   (suma de Riemann con Δt = 1 día)
   *   Acumulado F(t)   = ∫₀ᵗ f(t) dt                          (la primitiva numérica)
   * Se verifica contra un SUM() directo de SQL: ambos deben coincidir al peso.
   */
  async function monthlyRevenueData(year) {
    const flow = await pool.query(
      `WITH days AS (
         SELECT generate_series(make_date($1, 1, 1), make_date($1, 12, 31), interval '1 day')::DATE AS day
       ), sales AS (
         SELECT (a.registered_at AT TIME ZONE 'America/Bogota')::DATE AS day, SUM(a.price_paid_cop)::BIGINT AS revenue, COUNT(*)::INT AS tickets
           FROM attendees a JOIN events e ON e.id = a.event_id
          WHERE a.status IN ('confirmado', 'pendiente') AND e.status <> 'cancelado' AND a.price_paid_cop > 0
          GROUP BY 1
       )
       SELECT to_char(d.day, 'YYYY-MM-DD') AS day, COALESCE(s.revenue, 0)::BIGINT AS revenue, COALESCE(s.tickets, 0)::INT AS tickets
         FROM days d LEFT JOIN sales s ON s.day = d.day ORDER BY d.day`, [year]);
    const direct = await pool.query(
      `SELECT COALESCE(SUM(a.price_paid_cop), 0)::BIGINT AS total FROM attendees a JOIN events e ON e.id = a.event_id
        WHERE a.status IN ('confirmado', 'pendiente') AND e.status <> 'cancelado' AND a.price_paid_cop > 0
          AND (a.registered_at AT TIME ZONE 'America/Bogota')::DATE BETWEEN make_date($1, 1, 1) AND make_date($1, 12, 31)`, [year]);

    const byMonth = Array.from({ length: 12 }, () => ({ flow: [], tickets: 0, days: [] }));
    for (const r of flow.rows) {
      const m = Number(r.day.slice(5, 7)) - 1;
      byMonth[m].flow.push(Number(r.revenue));
      byMonth[m].days.push(r.day);
      byMonth[m].tickets += r.tickets;
    }
    const monthTotals = byMonth.map((m) => integrate(m.flow, 1, "riemann"));          // ∫ f dt por mes
    const running = cumulative(monthTotals, 1);                                        // F al cierre de cada mes
    const months = byMonth.map((m, i) => {
      const peak = m.flow.reduce((best, v, d) => (v > best.v ? { v, d } : best), { v: 0, d: -1 });
      return {
        month: i + 1, label: MONTHS[i], days: m.flow.length,
        revenueCop: monthTotals[i], cumulativeCop: running[i], tickets: m.tickets,
        avgDailyCop: m.flow.length ? Math.round(monthTotals[i] / m.flow.length) : 0,
        approxTrapezoidCop: Math.round(integrate(m.flow, 1, "trapezoid")),
        peakDay: peak.d >= 0 ? { date: m.days[peak.d], revenueCop: peak.v } : null,
      };
    });
    const total = monthTotals.reduce((a, b) => a + b, 0);
    const sqlTotal = Number(direct.rows[0].total);
    return { year, unit: "COP", method: "Suma de Riemann diaria (Δt = 1 día)", months, totalCop: total, check: { sqlTotalCop: sqlTotal, diffCop: total - sqlTotal, reconciled: total === sqlTotal } };
  }

  async function monthlyRevenue(req, res) {
    try {
      const year = req.query.year === undefined ? 2026 : Number(req.query.year);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new HttpError("Año inválido.", 400);
      res.json(await monthlyRevenueData(year));
    } catch (e) { handleError(res, e, "report.monthlyRevenue"); }
  }

  /**
   * Liquidación del Agente — función LINEAL:   L(E, T) = b·E + m·T
   *   E eventos gestionados · T entradas gestionadas (check-in hechos por el agente)
   *   b pago por evento · m pago por entrada      (tabla commission_rules)
   */
  async function agentCommission(req, res) {
    try {
      const id = req.params.id;
      if (!isUuid(id)) throw new HttpError("Identificador inválido.", 400);
      const act = await pool.query("SELECT agent_id, name, events_managed, tickets_managed FROM v_agent_activity WHERE agent_id = $1", [id]);
      if (!act.rows.length) throw new HttpError("No existe un agente con ese identificador.", 404);
      const rule = (await pool.query("SELECT per_event_cop, per_ticket_cop FROM commission_rules WHERE id = 1")).rows[0];
      const per = await pool.query(
        `WITH mine AS (
           SELECT id AS event_id FROM events WHERE created_by = $1
           UNION SELECT event_id FROM attendees WHERE checked_in_by = $1 AND checked_in_at IS NOT NULL)
         SELECT e.id, e.name, to_char(e.event_date, 'YYYY-MM-DD') AS date,
                (SELECT COUNT(*) FROM attendees a WHERE a.event_id = e.id AND a.checked_in_by = $1 AND a.checked_in_at IS NOT NULL)::INT AS tickets
           FROM mine JOIN events e ON e.id = mine.event_id ORDER BY e.event_date DESC`, [id]);
      const E = act.rows[0].events_managed, T = act.rows[0].tickets_managed;
      const b = rule.per_event_cop, m = rule.per_ticket_cop;
      res.json({
        agent: { id, name: act.rows[0].name },
        rule: { perEventCop: b, perTicketCop: m },
        eventsManaged: E, ticketsManaged: T,
        commissionCop: b * E + m * T,
        formula: `L(E, T) = ${b}·E + ${m}·T = ${b}·${E} + ${m}·${T}`,
        breakdown: per.rows.map((r) => ({ eventId: r.id, name: r.name, date: r.date, tickets: r.tickets, subtotalCop: b + m * r.tickets })),
      });
    } catch (e) { handleError(res, e, "report.agentCommission"); }
  }

  return { monthlyRevenueData, monthlyRevenue, agentCommission };
};
