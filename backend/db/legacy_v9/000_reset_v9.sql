-- ============================================================================
-- 000_reset.sql  —  BORRA TODO lo que creó EventPro. Úsalo solo en desarrollo.
-- Sirve para "empezar de cero" si te equivocaste al correr 001 o 002.
-- ⚠ En producción NO se ejecuta nunca: destruye todos los datos.
-- ============================================================================
BEGIN;
-- Módulo de pagos (004_payments.sql)
DROP VIEW     IF EXISTS v_agent_activity CASCADE;
DROP FUNCTION IF EXISTS confirm_checkout(UUID, UUID, INTEGER, TEXT, INTEGER, NUMERIC, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS cancel_registration(UUID, UUID);
DROP FUNCTION IF EXISTS is_new_member(UUID);
DROP FUNCTION IF EXISTS refresh_event_sales_state(UUID) CASCADE;
DROP FUNCTION IF EXISTS sales_state_for(INTEGER, INTEGER, NUMERIC);
DROP TABLE    IF EXISTS price_adjustments, loyalty_ledger, payments, commission_rules, zones CASCADE;
DROP FUNCTION IF EXISTS trg_attendees_sales_state() CASCADE;
DROP FUNCTION IF EXISTS trg_events_sales_state_cap() CASCADE;
DROP FUNCTION IF EXISTS trg_events_base_price() CASCADE;
DROP VIEW     IF EXISTS v_public_events, v_user_growth_monthly, v_global_occupancy, v_revenue_by_type, v_event_stats CASCADE;
DROP FUNCTION IF EXISTS register_for_event(UUID, UUID);
DROP FUNCTION IF EXISTS admin_delete_account(UUID, UUID);
DROP TABLE    IF EXISTS audit_log, tasks, attendees, event_categories, events, categories, event_types, users CASCADE;
DROP FUNCTION IF EXISTS set_updated_at();
DROP FUNCTION IF EXISTS trg_events_capacity_guard();
DROP FUNCTION IF EXISTS trg_events_default_category();
COMMIT;
