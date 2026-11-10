-- ============================================================================
-- 003_checks.sql  —  "¿Quedó bien la base?" Ejecutar DESPUÉS de 001 y 002.
-- Cada consulta trae el resultado ESPERADO en el comentario. Si coincide, la base está lista.
-- (Los números son los mismos que muestra hoy el panel de Finanzas de la app.)
-- ============================================================================

-- 1) Tablas y filas
SELECT 'users' AS tabla, COUNT(*) AS filas FROM users            -- esperado: 58
UNION ALL SELECT 'events',     COUNT(*) FROM events              -- esperado: 10
UNION ALL SELECT 'event_types',COUNT(*) FROM event_types         -- esperado: 7
UNION ALL SELECT 'categories', COUNT(*) FROM categories          -- esperado: 5
UNION ALL SELECT 'tasks',      COUNT(*) FROM tasks;              -- esperado: 10

-- 2) Cuentas por rol y estado  → agent:5 activo 4 + 1 suspendido · user:52 · admin:1
SELECT role, status, COUNT(*) FROM users GROUP BY role, status ORDER BY role, status;

-- 3) Finanzas del Admin
SELECT SUM(revenue_cop) AS dinero_recaudado FROM v_event_stats WHERE status <> 'cancelado';   -- esperado: 229150000
SELECT * FROM v_global_occupancy;                                    -- esperado: registered 7641 · capacity 10600 · occupancy_pct 72
SELECT SUM(registered) AS boletas_vendidas FROM v_event_stats WHERE price_cop > 0;            -- esperado: 6162
SELECT * FROM v_revenue_by_type ORDER BY revenue_cop DESC;           -- esperado: Fiesta 208150000 · Concierto 15300000 · Cultural 5700000 · el resto 0
SELECT * FROM v_user_growth_monthly ORDER BY month;                  -- esperado: 8 meses (mar–oct 2026); el último total_users = 52

-- 4) Home público: 8 eventos activos con categorías
SELECT name, event_date, price_cop, spots_left, categories FROM v_public_events ORDER BY event_date;   -- esperado: 8 filas

-- 5) Reglas de negocio (cada una debe fallar con el mensaje indicado)
--    a) Aforo menor que los inscritos  → "El aforo (5) no puede ser menor a los 1450 inscritos actuales."
-- UPDATE events SET capacity = 5 WHERE name LIKE 'Color Fest%';
--    b) Inscripción repetida  → "Ya estás inscrito en este evento."
-- SELECT register_for_event(
--   (SELECT id FROM events WHERE name LIKE 'Guerra de Bandas%'),
--   (SELECT id FROM users  WHERE email = 'user@eventpro.com'));
--    c) Check-in a un asistente cancelado → viola chk_checkin_confirmed
-- UPDATE attendees SET checked_in_at = now() WHERE status = 'cancelado';
-- (quita los "--" de una en una para probarlas; las tres deben dar error)
