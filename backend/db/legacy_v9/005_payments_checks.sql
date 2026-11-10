-- ============================================================================
-- 005_payments_checks.sql  —  "¿Quedó bien el módulo de pagos?"  Ejecutar DESPUÉS de 004.
-- Cada consulta trae el resultado ESPERADO en el comentario (con los datos de 002_seed.sql).
-- ============================================================================

-- 1) Zonas (función a trozos de C)
SELECT code, coefficient FROM zones ORDER BY sort_order;     -- esperado: general 1.00 · preferencial 1.50 · vip 2.50

-- 2) El dinero total NO cambió al repartir las inscripciones ficticias por el año
SELECT SUM(price_paid_cop) AS recaudo
  FROM attendees a JOIN events e ON e.id = a.event_id
 WHERE a.status IN ('confirmado','pendiente') AND e.status <> 'cancelado';                      -- esperado: 229150000

-- 3) Ingresos por mes de 2026 (la versión SQL del reporte del Admin; el backend lo integra día a día y debe dar lo mismo)
SELECT to_char(date_trunc('month', registered_at AT TIME ZONE 'America/Bogota'), 'YYYY-MM') AS mes,
       SUM(price_paid_cop) AS ingresos
  FROM attendees WHERE status IN ('confirmado','pendiente')
 GROUP BY 1 ORDER BY 1;                                          -- esperado: de 2026-04 a 2026-10, suman 229150000

-- 4) Estado de ventas por evento (límite por la izquierda)
SELECT name, capacity, sales_state FROM events ORDER BY event_date;
-- esperado: ninguno "agotado"; "ultimos_cupos" si quedan ≤ 10 % del aforo

-- 5) Puntos: el saldo de cada usuario = suma de su libro contable
SELECT COUNT(*) AS cuentas_que_no_cuadran FROM users u
 WHERE u.loyalty_points <> COALESCE((SELECT SUM(delta) FROM loyalty_ledger l WHERE l.user_id = u.id), 0);   -- esperado: 0
SELECT name, loyalty_points, is_new_member(id) AS es_nuevo FROM users WHERE email = 'user@eventpro.com';     -- esperado: 140 puntos · es_nuevo = false

-- 6) Comisión lineal de los agentes: L = per_event_cop·E + per_ticket_cop·T
SELECT v.name, v.events_managed AS e, v.tickets_managed AS t,
       r.per_event_cop * v.events_managed + r.per_ticket_cop * v.tickets_managed AS comision_cop
  FROM v_agent_activity v CROSS JOIN commission_rules r ORDER BY comision_cop DESC;
-- esperado: Isabela Ruiz E=1 T=910 → 1.132.000 · Carmen López E=10 T=380 → 856.000 · los demás 0

-- 7) Reglas de negocio (quita los "--" de una en una; cada una debe fallar con el mensaje indicado)
--    a) Compra con precio desactualizado → "El precio del evento cambió mientras pagabas…"
-- SELECT * FROM confirm_checkout((SELECT id FROM events WHERE name LIKE 'ElectroFest%'),
--        (SELECT id FROM users WHERE email='user@eventpro.com'), 1,'general', 59000,1,59000, 0,0,0,59000, 59,'tarjeta','Visa','4242');
--    b) La fórmula se verifica en la tabla: total ≠ subtotal − descuentos → viola chk_payment_math
-- UPDATE payments SET total_cop = total_cop + 1;
