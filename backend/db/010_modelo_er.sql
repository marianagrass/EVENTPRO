-- ============================================================================
-- 010_modelo_er.sql  —  Modelo Entidad-Relación aprobado por el tutor (DDL)
--
-- Qué hace (en este orden, dentro de UNA transacción: o queda todo o no queda nada):
--   0. LIMPIEZA  → borra las tablas del modelo anterior (REGISTRO_FINANCIERO, TAREA, INSCRIBE_RESERVA,
--                  USUARIO, USUARIO_BASE) y también todo lo que creó EventPro en las versiones V1–V9
--                  (users, events, attendees, tasks, payments…). Es seguro correrlo varias veces.
--   1. GEOGRAFÍA → PAIS, DEPARTAMENTO, CIUDAD
--   2. HERENCIA  → PERSONA, TELEFONO_PERSONA y las subclases CLIENTE, AGENTE, ADMINISTRADOR
--   3. CATÁLOGOS → ESTADO_EVENTO, ESTADO_RESERVA
--   4. NEGOCIO   → EVENTO, RESERVA
--
-- ⚠ ES DESTRUCTIVO: borra los datos de las tablas viejas. En Neon crea primero un branch de respaldo
--   (Console → Branches → Create branch) o exporta lo que necesites.
--
-- Cómo ejecutarlo: Neon Console → SQL Editor → pegar TODO el archivo → Run.
-- Después, en este orden:  011_soporte_negocio.sql → 012_catalogos.sql → 013_datos_demo.sql (opcional)
--
-- Las columnas son EXACTAMENTE las del ER; no se agregó ningún atributo a estas tablas.
-- ============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- crypt() / gen_salt(): contraseñas con bcrypt

-- ---------------------------------------------------------------------------
-- 0. LIMPIEZA
-- ---------------------------------------------------------------------------
-- 0.a  Tablas del modelo anterior que pidió el tutor eliminar
DROP TABLE IF EXISTS registro_financiero CASCADE;
DROP TABLE IF EXISTS tarea               CASCADE;
DROP TABLE IF EXISTS inscribe_reserva    CASCADE;
DROP TABLE IF EXISTS usuario             CASCADE;
DROP TABLE IF EXISTS usuario_base        CASCADE;

-- 0.b  Objetos de EventPro V1–V9 (esquema en inglés) que este modelo reemplaza
DROP VIEW     IF EXISTS v_agent_activity, v_public_events, v_user_growth_monthly, v_global_occupancy,
                        v_revenue_by_type, v_event_stats CASCADE;
DROP FUNCTION IF EXISTS confirm_checkout(UUID, UUID, INTEGER, TEXT, INTEGER, NUMERIC, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS cancel_registration(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS is_new_member(UUID) CASCADE;
DROP FUNCTION IF EXISTS refresh_event_sales_state(UUID) CASCADE;
DROP FUNCTION IF EXISTS sales_state_for(INTEGER, INTEGER, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS register_for_event(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS admin_delete_account(UUID, UUID) CASCADE;
DROP TABLE    IF EXISTS price_adjustments, loyalty_ledger, payments, commission_rules, zones,
                        audit_log, tasks, attendees, event_categories, events, categories, event_types, users CASCADE;
DROP FUNCTION IF EXISTS trg_attendees_sales_state() CASCADE;
DROP FUNCTION IF EXISTS trg_events_sales_state_cap() CASCADE;
DROP FUNCTION IF EXISTS trg_events_base_price() CASCADE;
DROP FUNCTION IF EXISTS trg_events_capacity_guard() CASCADE;
DROP FUNCTION IF EXISTS trg_events_default_category() CASCADE;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

-- 0.c  Objetos de ESTE modelo (para poder re-ejecutar el archivo desde cero)
DROP VIEW     IF EXISTS v_agente_actividad, v_evento_ventas CASCADE;
DROP TABLE    IF EXISTS ajuste_precio, reserva_pago, regla_comision, zona CASCADE;
DROP TABLE    IF EXISTS reserva, evento, estado_reserva, estado_evento,
                        telefono_persona, cliente, agente, administrador, persona,
                        ciudad, departamento, pais CASCADE;
DROP SEQUENCE IF EXISTS seq_codigo_evento CASCADE;
DROP FUNCTION IF EXISTS trg_persona_subclase_unica()  CASCADE;
DROP FUNCTION IF EXISTS trg_reserva_causa_cancelacion() CASCADE;
DROP FUNCTION IF EXISTS trg_evento_causa_cancelacion()  CASCADE;

-- ---------------------------------------------------------------------------
-- 1. MÓDULO DE UBICACIÓN GEOGRÁFICA   PAIS 1—N DEPARTAMENTO 1—N CIUDAD
-- ---------------------------------------------------------------------------
CREATE TABLE pais (
  id_pais     SERIAL       PRIMARY KEY,
  nombre_pais VARCHAR(100) NOT NULL,
  CONSTRAINT uq_pais_nombre UNIQUE (nombre_pais)
);

CREATE TABLE departamento (
  id_departamento     SERIAL       PRIMARY KEY,
  nombre_departamento VARCHAR(100) NOT NULL,
  id_pais             INTEGER      NOT NULL REFERENCES pais (id_pais) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT uq_departamento_por_pais UNIQUE (id_pais, nombre_departamento)
);
CREATE INDEX idx_departamento_pais ON departamento (id_pais);

CREATE TABLE ciudad (
  id_ciudad       SERIAL       PRIMARY KEY,
  nombre_ciudad   VARCHAR(100) NOT NULL,
  id_departamento INTEGER      NOT NULL REFERENCES departamento (id_departamento) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT uq_ciudad_por_departamento UNIQUE (id_departamento, nombre_ciudad)
);
CREATE INDEX idx_ciudad_departamento ON ciudad (id_departamento);

-- ---------------------------------------------------------------------------
-- 2. HERENCIA DE USUARIOS
--    PERSONA es la superclase. CLIENTE, AGENTE y ADMINISTRADOR comparten su llave primaria
--    (numero_identificacion), que además es llave foránea hacia PERSONA.
-- ---------------------------------------------------------------------------
CREATE TABLE persona (
  numero_identificacion VARCHAR(20)  PRIMARY KEY,
  nombre_completo       VARCHAR(150) NOT NULL,
  correo_electronico    VARCHAR(150) NOT NULL,
  contrasena            VARCHAR(255) NOT NULL,                       -- hash bcrypt (crypt/gen_salt), nunca texto plano
  direccion             VARCHAR(200),
  id_ciudad             INTEGER      NOT NULL REFERENCES ciudad (id_ciudad) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT uq_persona_correo        UNIQUE (correo_electronico),
  CONSTRAINT chk_persona_id_formato   CHECK (numero_identificacion ~ '^[A-Za-z0-9-]{5,20}$'),
  CONSTRAINT chk_persona_nombre       CHECK (length(btrim(nombre_completo)) >= 3),
  CONSTRAINT chk_persona_correo       CHECK (correo_electronico ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$')
);
-- El correo no distingue mayúsculas: Ana@x.co y ana@x.co son la misma cuenta
CREATE UNIQUE INDEX uq_persona_correo_ci ON persona (lower(correo_electronico));
CREATE INDEX idx_persona_ciudad ON persona (id_ciudad);

CREATE TABLE telefono_persona (
  id_telefono           SERIAL      PRIMARY KEY,
  numero_telefono       VARCHAR(20) NOT NULL,
  numero_identificacion VARCHAR(20) NOT NULL REFERENCES persona (numero_identificacion) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT chk_telefono_formato CHECK (numero_telefono ~ '^[0-9+() -]{7,20}$'),
  CONSTRAINT uq_telefono_por_persona UNIQUE (numero_identificacion, numero_telefono)
);
CREATE INDEX idx_telefono_persona ON telefono_persona (numero_identificacion);

CREATE TABLE cliente (
  numero_identificacion   VARCHAR(20) PRIMARY KEY REFERENCES persona (numero_identificacion) ON UPDATE CASCADE ON DELETE CASCADE,
  cantidad_puntos         INTEGER     NOT NULL DEFAULT 0,            -- puntos de fidelización (p en D(p))
  visualizacion_publicidad BOOLEAN    NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_cliente_puntos CHECK (cantidad_puntos >= 0)
);

CREATE TABLE agente (
  numero_identificacion VARCHAR(20)   PRIMARY KEY REFERENCES persona (numero_identificacion) ON UPDATE CASCADE ON DELETE CASCADE,
  comision              NUMERIC(12,2) NOT NULL DEFAULT 0,            -- L(E,T) = b·E + m·T  (se recalcula sola)
  experiencia           VARCHAR(200),
  CONSTRAINT chk_agente_comision CHECK (comision >= 0)
);

CREATE TABLE administrador (
  numero_identificacion VARCHAR(20)   PRIMARY KEY REFERENCES persona (numero_identificacion) ON UPDATE CASCADE ON DELETE CASCADE,
  salario               NUMERIC(12,2) NOT NULL,
  horario               VARCHAR(100)  NOT NULL,
  CONSTRAINT chk_administrador_salario CHECK (salario >= 0)
);

-- Una persona es Cliente, Agente o Administrador, nunca dos a la vez (especialización disjunta).
CREATE FUNCTION trg_persona_subclase_unica() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_TABLE_NAME <> 'cliente'       AND EXISTS (SELECT 1 FROM cliente       WHERE numero_identificacion = NEW.numero_identificacion))
  OR (TG_TABLE_NAME <> 'agente'        AND EXISTS (SELECT 1 FROM agente        WHERE numero_identificacion = NEW.numero_identificacion))
  OR (TG_TABLE_NAME <> 'administrador' AND EXISTS (SELECT 1 FROM administrador WHERE numero_identificacion = NEW.numero_identificacion)) THEN
    RAISE EXCEPTION 'Una persona solo puede ser Cliente, Agente o Administrador (no varios a la vez).';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cliente_subclase_unica       BEFORE INSERT ON cliente       FOR EACH ROW EXECUTE FUNCTION trg_persona_subclase_unica();
CREATE TRIGGER agente_subclase_unica        BEFORE INSERT ON agente        FOR EACH ROW EXECUTE FUNCTION trg_persona_subclase_unica();
CREATE TRIGGER administrador_subclase_unica BEFORE INSERT ON administrador FOR EACH ROW EXECUTE FUNCTION trg_persona_subclase_unica();

-- ---------------------------------------------------------------------------
-- 3. TABLAS DE CATÁLOGO (ESTADOS)    Sus filas se cargan en 012_catalogos.sql
-- ---------------------------------------------------------------------------
CREATE TABLE estado_evento (
  id_estado_evento SERIAL      PRIMARY KEY,
  nombre_estado    VARCHAR(50) NOT NULL,
  CONSTRAINT uq_estado_evento_nombre UNIQUE (nombre_estado)
);

CREATE TABLE estado_reserva (
  id_estado_reserva SERIAL      PRIMARY KEY,
  nombre_estado     VARCHAR(50) NOT NULL,
  CONSTRAINT uq_estado_reserva_nombre UNIQUE (nombre_estado)
);

-- ---------------------------------------------------------------------------
-- 4. EVENTO Y RESERVA
-- ---------------------------------------------------------------------------
-- Código legible del evento: EVT-000001, EVT-000002…
CREATE SEQUENCE seq_codigo_evento START 1;

CREATE TABLE evento (
  codigo_evento      VARCHAR(20)   PRIMARY KEY DEFAULT ('EVT-' || lpad(nextval('seq_codigo_evento')::text, 6, '0')),
  nombre_evento      VARCHAR(200)  NOT NULL,
  descripcion        TEXT,
  teatro             VARCHAR(150)  NOT NULL,                         -- recinto / lugar donde ocurre
  fecha_hora_inicio  TIMESTAMP     NOT NULL,                         -- hora local de Colombia
  fecha_hora_fin     TIMESTAMP     NOT NULL,
  capacidad_total    INTEGER       NOT NULL,
  precio_base        NUMERIC(12,2) NOT NULL,                         -- B en P(x) = B·x·C − D(p)
  observaciones      TEXT,
  causa_cancelacion  TEXT          NULL,                             -- solo se llena al cancelar el evento
  id_ciudad          INTEGER       NOT NULL REFERENCES ciudad (id_ciudad)                    ON UPDATE CASCADE ON DELETE RESTRICT,
  id_estado_evento   INTEGER       NOT NULL REFERENCES estado_evento (id_estado_evento)      ON UPDATE CASCADE ON DELETE RESTRICT,
  id_agente          VARCHAR(20)   NOT NULL REFERENCES agente (numero_identificacion)        ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_evento_codigo     CHECK (codigo_evento ~ '^[A-Za-z0-9-]{3,20}$'),
  CONSTRAINT chk_evento_nombre     CHECK (length(btrim(nombre_evento)) >= 3),
  CONSTRAINT chk_evento_fechas     CHECK (fecha_hora_fin > fecha_hora_inicio),
  CONSTRAINT chk_evento_capacidad  CHECK (capacidad_total BETWEEN 1 AND 1000000),
  CONSTRAINT chk_evento_precio     CHECK (precio_base >= 0),
  CONSTRAINT chk_evento_causa      CHECK (causa_cancelacion IS NULL OR length(btrim(causa_cancelacion)) >= 3)
);
CREATE INDEX idx_evento_inicio  ON evento (fecha_hora_inicio);
CREATE INDEX idx_evento_estado  ON evento (id_estado_evento);
CREATE INDEX idx_evento_agente  ON evento (id_agente);
CREATE INDEX idx_evento_ciudad  ON evento (id_ciudad);

CREATE TABLE reserva (
  id_reserva         SERIAL        PRIMARY KEY,
  fecha_hora_reserva TIMESTAMP     NOT NULL DEFAULT (now() AT TIME ZONE 'America/Bogota'),
  valor_total        NUMERIC(12,2) NOT NULL,                         -- P(x): lo que realmente se pagó
  numero_entradas    INTEGER       NOT NULL,                         -- x
  observaciones      TEXT,
  causa_cancelacion  TEXT          NULL,                             -- solo se llena al cancelar la reserva
  id_cliente         VARCHAR(20)   NOT NULL REFERENCES cliente (numero_identificacion)       ON UPDATE CASCADE ON DELETE RESTRICT,
  codigo_evento      VARCHAR(20)   NOT NULL REFERENCES evento (codigo_evento)                ON UPDATE CASCADE ON DELETE RESTRICT,
  id_estado_reserva  INTEGER       NOT NULL REFERENCES estado_reserva (id_estado_reserva)    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_reserva_valor     CHECK (valor_total >= 0),
  CONSTRAINT chk_reserva_entradas  CHECK (numero_entradas BETWEEN 1 AND 10),
  CONSTRAINT chk_reserva_causa     CHECK (causa_cancelacion IS NULL OR length(btrim(causa_cancelacion)) >= 3)
);
CREATE INDEX idx_reserva_cliente ON reserva (id_cliente);
CREATE INDEX idx_reserva_evento  ON reserva (codigo_evento, id_estado_reserva);
CREATE INDEX idx_reserva_fecha   ON reserva (fecha_hora_reserva);

-- Los estados de cancelación exigen causa (y solo ellos la admiten). Se valida por nombre del catálogo.
CREATE FUNCTION trg_reserva_causa_cancelacion() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_nombre TEXT;
BEGIN
  SELECT nombre_estado INTO v_nombre FROM estado_reserva WHERE id_estado_reserva = NEW.id_estado_reserva;
  IF v_nombre = 'Cancelada' AND (NEW.causa_cancelacion IS NULL OR length(btrim(NEW.causa_cancelacion)) < 3) THEN
    RAISE EXCEPTION 'Para cancelar una reserva debes indicar la causa de la cancelación.';
  END IF;
  IF v_nombre IS DISTINCT FROM 'Cancelada' AND NEW.causa_cancelacion IS NOT NULL THEN
    RAISE EXCEPTION 'La causa de cancelación solo se registra en reservas canceladas.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reserva_causa BEFORE INSERT OR UPDATE OF id_estado_reserva, causa_cancelacion ON reserva
  FOR EACH ROW EXECUTE FUNCTION trg_reserva_causa_cancelacion();

CREATE FUNCTION trg_evento_causa_cancelacion() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_nombre TEXT;
BEGIN
  SELECT nombre_estado INTO v_nombre FROM estado_evento WHERE id_estado_evento = NEW.id_estado_evento;
  IF v_nombre = 'Cancelado' AND (NEW.causa_cancelacion IS NULL OR length(btrim(NEW.causa_cancelacion)) < 3) THEN
    RAISE EXCEPTION 'Para cancelar un evento debes indicar la causa de la cancelación.';
  END IF;
  IF v_nombre IS DISTINCT FROM 'Cancelado' AND NEW.causa_cancelacion IS NOT NULL THEN
    RAISE EXCEPTION 'La causa de cancelación solo se registra en eventos cancelados.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER evento_causa BEFORE INSERT OR UPDATE OF id_estado_evento, causa_cancelacion ON evento
  FOR EACH ROW EXECUTE FUNCTION trg_evento_causa_cancelacion();

COMMIT;
