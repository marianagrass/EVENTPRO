/* ==========================================================
   controllers/reportController.js — Reportes acumulados (integrales) y comisiones del Agente
   ========================================================== */
const { integrate, cumulative } = require("../lib/calculus");
const { HttpError, isId, handleError } = require("../lib/http-errors");

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

module.exports = function reportController({ models }) {
  const { reporte } = models;
  /**
   * Reporte del Admin: ingresos por mes de un año como ÁREA BAJO LA CURVA.
   *   f(t) = flujo de ingresos del día t (COP/día)  — viene de las boletas pagadas
   *   Ingreso del mes  = ∫ f(t) dt  sobre los días del mes   (suma de Riemann con Δt = 1 día)
   *   Acumulado F(t)   = ∫₀ᵗ f(t) dt                          (la primitiva numérica)
   * Se verifica contra un SUM() directo de SQL: ambos deben coincidir al peso.
   */
  async function monthlyRevenueData(year) {
    const flow = await reporte.flujoDiario(year);            // f(t): ingresos de cada día (COP/día)
    const sqlTotal = await reporte.totalDirecto(year);       // SUM() directo, para contrastar
    const byMonth = Array.from({ length: 12 }, () => ({ flow: [], tickets: 0, days: [] }));
    for (const r of flow) {
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
   *   E eventos gestionados (EVENTO.id_agente) · T entradas confirmadas vendidas en sus eventos
   *   b pago por evento · m pago por entrada      (tabla regla_comision)
   */
  async function agentCommission(req, res) {
    try {
      const id = req.params.id;
      if (!isId(id)) throw new HttpError("Identificador inválido.", 400);
      const act = await reporte.actividadAgente(id);
      if (!act) throw new HttpError("No existe un agente con ese identificador.", 404);
      const rule = await reporte.reglaComision();
      const per = await reporte.desgloseAgente(id);
      const E = act.eventos_gestionados, T = act.entradas_gestionadas;
      const b = rule.b, m = rule.m;
      res.json({
        agent: { id, name: act.nombre_completo },
        rule: { perEventCop: b, perTicketCop: m },
        eventsManaged: E, ticketsManaged: T,
        commissionCop: b * E + m * T,
        storedCommissionCop: await reporte.comisionGuardada(id),        // AGENTE.comision (la mantiene la base)
        formula: `L(E, T) = ${b}·E + ${m}·T = ${b}·${E} + ${m}·${T}`,
        breakdown: per.map((r) => ({ eventId: r.id, name: r.name, date: r.date, tickets: r.tickets, subtotalCop: b + m * r.tickets })),
      });
    } catch (e) { handleError(res, e, "report.agentCommission"); }
  }

  return { monthlyRevenueData, monthlyRevenue, agentCommission };
};
