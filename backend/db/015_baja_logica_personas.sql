-- ============================================================================
-- 015_baja_logica_personas.sql  —  BORRADO LÓGICO de cuentas (activar / desactivar) en lugar de DELETE
--
-- Requisito: 010 → 013 ya ejecutados.  NO es destructivo y es seguro correrlo varias veces (IF NOT EXISTS / OR REPLACE).
--
--   1. persona.activo BOOLEAN NOT NULL DEFAULT TRUE   → TRUE = la cuenta puede entrar y operar; FALSE = desactivada.
--      Una cuenta desactivada conserva TODO su historial (reservas, eventos, teléfonos): no se pierde ningún dato.
--   2. cambiar_estado_persona(admin, id [, activo])    → conmuta (o fija) el estado. Solo un Administrador.
--   3. Triggers: una cuenta desactivada no puede crear reservas ni eventos (defensa en la base, no solo en el front).
--   4. Se elimina eliminar_persona(): el borrado físico de cuentas ya no existe.
--
-- ⚠ Esto agrega UNA columna a PERSONA, que no está en el ER aprobado por el tutor: confírmalo con él
--   (alternativa equivalente: un catálogo estado_persona + llave foránea, como estado_evento / estado_reserva).
-- ============================================================================
BEGIN;

-- 1) La columna (las cuentas que ya existen quedan ACTIVAS)
ALTER TABLE persona ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
COMMENT ON COLUMN persona.activo IS 'Borrado lógico: TRUE = cuenta activa, FALSE = desactivada (conserva su historial).';
-- Índice parcial: solo indexa las desactivadas (pocas), para listarlas o contarlas rápido
CREATE INDEX IF NOT EXISTS idx_persona_inactivas ON persona (numero_identificacion) WHERE NOT activo;

-- 2) Conmutar el estado.  p_activo = NULL → invierte el estado actual; TRUE / FALSE → lo fija.  Devuelve el estado NUEVO.
CREATE OR REPLACE FUNCTION cambiar_estado_persona(p_admin VARCHAR, p_id VARCHAR, p_activo BOOLEAN DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_actual BOOLEAN;
  v_nuevo  BOOLEAN;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM administrador WHERE numero_identificacion = p_admin) THEN
    RAISE EXCEPTION 'Solo un administrador puede activar o desactivar cuentas.';
  END IF;
  IF p_admin = p_id THEN RAISE EXCEPTION 'No puedes desactivar tu propia cuenta.'; END IF;
  IF EXISTS (SELECT 1 FROM administrador WHERE numero_identificacion = p_id) THEN
    RAISE EXCEPTION 'No se puede cambiar el estado de otro administrador.';
  END IF;

  SELECT activo INTO v_actual FROM persona WHERE numero_identificacion = p_id FOR UPDATE;   -- bloquea la fila: dos clics seguidos no se pisan
  IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta no existe.'; END IF;

  v_nuevo := COALESCE(p_activo, NOT v_actual);
  UPDATE persona SET activo = v_nuevo WHERE numero_identificacion = p_id;                   -- ← el «borrado lógico»
  RETURN v_nuevo;
END $$;

-- 3) Una cuenta desactivada no crea reservas ni eventos
CREATE OR REPLACE FUNCTION trg_reserva_cuenta_activa() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT (SELECT activo FROM persona WHERE numero_identificacion = NEW.id_cliente) THEN
    RAISE EXCEPTION 'Tu cuenta está desactivada. Contacta al administrador de la plataforma.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS reserva_cuenta_activa ON reserva;
CREATE TRIGGER reserva_cuenta_activa BEFORE INSERT ON reserva FOR EACH ROW EXECUTE FUNCTION trg_reserva_cuenta_activa();

CREATE OR REPLACE FUNCTION trg_evento_cuenta_activa() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT (SELECT activo FROM persona WHERE numero_identificacion = NEW.id_agente) THEN
    RAISE EXCEPTION 'La cuenta del agente está desactivada: no puede crear eventos.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS evento_cuenta_activa ON evento;
CREATE TRIGGER evento_cuenta_activa BEFORE INSERT ON evento FOR EACH ROW EXECUTE FUNCTION trg_evento_cuenta_activa();

-- 4) Se acabó el borrado físico de cuentas
DROP FUNCTION IF EXISTS eliminar_persona(VARCHAR, VARCHAR);

COMMIT;

-- ---------------------------------------------------------------------------
-- La consulta de fondo (lo que hace cambiar_estado_persona, sin las validaciones):
--     UPDATE persona SET activo = NOT activo WHERE numero_identificacion = '1100000052' RETURNING activo;
-- Probar:  SELECT cambiar_estado_persona('1000000001', '1100000052');          -- → false  (desactivada)
--          SELECT cambiar_estado_persona('1000000001', '1100000052');          -- → true   (reactivada)
-- ---------------------------------------------------------------------------
