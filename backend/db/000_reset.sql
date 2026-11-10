-- ============================================================================
-- 000_reset.sql  —  BORRA TODO lo que creó EventPro (modelo ER + capa de soporte + esquema viejo V1–V9).
-- Úsalo solo en desarrollo, para empezar de cero. ⚠ Destruye todos los datos. En producción NO se ejecuta nunca.
-- Después se vuelve a correr 010 → 011 → 012 → 013.
-- (Para migrar sin pasar por aquí basta con correr 010: ya incluye todos los DROP.)
-- ============================================================================
BEGIN;
DROP VIEW     IF EXISTS v_agente_actividad, v_evento_ventas CASCADE;
DROP VIEW     IF EXISTS v_agent_activity, v_public_events, v_user_growth_monthly, v_global_occupancy, v_revenue_by_type, v_event_stats CASCADE;
DROP TABLE    IF EXISTS ajuste_precio, reserva_pago, regla_comision, zona CASCADE;
DROP TABLE    IF EXISTS reserva, evento, estado_reserva, estado_evento, telefono_persona, cliente, agente, administrador, persona, ciudad, departamento, pais CASCADE;
DROP TABLE    IF EXISTS registro_financiero, tarea, inscribe_reserva, usuario, usuario_base CASCADE;
DROP TABLE    IF EXISTS price_adjustments, loyalty_ledger, payments, commission_rules, zones, audit_log, tasks, attendees, event_categories, events, categories, event_types, users CASCADE;
DROP SEQUENCE IF EXISTS seq_codigo_evento CASCADE;
DROP FUNCTION IF EXISTS confirmar_reserva(VARCHAR, VARCHAR, INTEGER, TEXT, NUMERIC, NUMERIC, NUMERIC, INTEGER, NUMERIC, NUMERIC, NUMERIC, INTEGER, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS cancelar_reserva(INTEGER, VARCHAR, TEXT) CASCADE;
DROP FUNCTION IF EXISTS anular_reserva_interna(INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS cancelar_evento(VARCHAR, VARCHAR, TEXT) CASCADE;
DROP FUNCTION IF EXISTS cambiar_disponibilidad_evento(VARCHAR, TEXT) CASCADE;
DROP FUNCTION IF EXISTS aplicar_ajuste_precio(VARCHAR, NUMERIC, NUMERIC, TEXT, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS registrar_persona(VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, INTEGER, TEXT, VARCHAR, JSONB) CASCADE;
DROP FUNCTION IF EXISTS actualizar_perfil_persona(VARCHAR, VARCHAR, VARCHAR, VARCHAR, INTEGER, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS cambiar_rol_persona(VARCHAR, TEXT) CASCADE;
DROP FUNCTION IF EXISTS eliminar_persona(VARCHAR, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS recalcular_comision_agente(VARCHAR), refrescar_estado_evento(VARCHAR), estado_ventas_para(INTEGER, INTEGER, NUMERIC),
                        es_cliente_nuevo(VARCHAR), precio_vigente(VARCHAR), inscritos_evento(VARCHAR), id_estado_reserva_de(TEXT),
                        id_estado_evento_de(TEXT), en_carga_masiva() CASCADE;
DROP FUNCTION IF EXISTS trg_reserva_aforo(), trg_reserva_despues(), trg_evento_aforo(), trg_evento_despues_aforo(), trg_evento_precio_base(),
                        trg_evento_comision(), trg_reserva_causa_cancelacion(), trg_evento_causa_cancelacion(), trg_persona_subclase_unica() CASCADE;
-- esquema viejo V1–V9
DROP FUNCTION IF EXISTS confirm_checkout(UUID, UUID, INTEGER, TEXT, INTEGER, NUMERIC, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS cancel_registration(UUID, UUID), is_new_member(UUID), refresh_event_sales_state(UUID), sales_state_for(INTEGER, INTEGER, NUMERIC),
                        register_for_event(UUID, UUID), admin_delete_account(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS trg_attendees_sales_state(), trg_events_sales_state_cap(), trg_events_base_price(), trg_events_capacity_guard(),
                        trg_events_default_category(), set_updated_at() CASCADE;
COMMIT;
