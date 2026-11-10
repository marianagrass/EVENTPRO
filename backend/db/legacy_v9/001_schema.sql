-- ============================================================================
-- 001_schema.sql  —  Estructura de la base de datos de EventPro (PostgreSQL / Neon)
--
-- Reemplaza al antiguo 002_agent_role.sql (carpeta legacy/), que dependía de un
-- 001 que nunca estuvo en el repositorio y del modelo anterior (asignación de
-- eventos por agente, presupuesto). Este esquema refleja la versión v6 de la app:
--   · Usuario  : explora e inscribe.            (rol 'user')
--   · Agente   : opera TODOS los eventos.        (rol 'agent'  = "manager" en el front)
--   · Admin    : finanzas y cuentas, sin eventos. (rol 'admin')
--
-- Cómo ejecutarlo: Neon Console → SQL Editor → pegar TODO el archivo → Run.
-- Va dentro de una transacción: si algo falla, no queda nada a medias.
-- ============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. CUENTAS
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL CHECK (length(btrim(name)) > 0),
  email         TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,                 -- NUNCA la contraseña en claro: hash bcrypt
  role          TEXT        NOT NULL DEFAULT 'user'    CHECK (role   IN ('user', 'agent', 'admin')),
  status        TEXT        NOT NULL DEFAULT 'activo'  CHECK (status IN ('activo', 'suspendido')),
  phone         TEXT,
  city          TEXT,
  institution   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
-- Correo único sin importar mayúsculas (Ana@x.co = ana@x.co)
CREATE UNIQUE INDEX users_email_unique    ON users (lower(email));
CREATE INDEX        idx_users_role_status ON users (role, status);   -- tabla de cuentas del Admin
CREATE INDEX        idx_users_created_at  ON users (created_at);     -- crecimiento mensual

-- ---------------------------------------------------------------------------
-- 2. CATÁLOGOS (listas fijas que antes eran TYPE_LABEL / HOME_CATEGORIES en el front)
-- ---------------------------------------------------------------------------
CREATE TABLE categories (            -- píldoras del Home: Fiestas, Cultura, Deportes...
  code       TEXT     PRIMARY KEY,
  label      TEXT     NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE event_types (           -- tipo de evento: Fiesta, Concierto, Deportivo...
  code             TEXT PRIMARY KEY,
  label            TEXT NOT NULL,
  color            TEXT NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  default_category TEXT REFERENCES categories (code)   -- categoría que recibe un evento nuevo de este tipo
);

-- ---------------------------------------------------------------------------
-- 3. EVENTOS
-- ---------------------------------------------------------------------------
CREATE TABLE events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL CHECK (length(btrim(name)) > 0),
  type_code    TEXT        NOT NULL REFERENCES event_types (code),
  event_date   DATE        NOT NULL,
  start_time   TIME        NOT NULL DEFAULT '00:00',
  location     TEXT        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  image_url    TEXT,
  capacity     INTEGER     NOT NULL CHECK (capacity >= 1),        -- aforo máximo
  price_cop    INTEGER     NOT NULL DEFAULT 0 CHECK (price_cop >= 0),   -- 0 = gratis (COP no usa decimales)
  status       TEXT        NOT NULL DEFAULT 'planificado'
                           CHECK (status IN ('planificado', 'en_progreso', 'completado', 'cancelado')),
  availability TEXT        NOT NULL DEFAULT 'open'                -- lo controla el Agente
                           CHECK (availability IN ('open', 'paused', 'closed')),
  is_public    BOOLEAN     NOT NULL DEFAULT true,
  is_featured  BOOLEAN     NOT NULL DEFAULT false,
  coordinator  TEXT,
  created_by   UUID        REFERENCES users (id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_date            ON events (event_date);
CREATE INDEX idx_events_public_listing  ON events (status, availability, is_public);

-- Un evento puede estar en varias categorías del Home (relación muchos a muchos)
CREATE TABLE event_categories (
  event_id      UUID NOT NULL REFERENCES events (id)      ON DELETE CASCADE,
  category_code TEXT NOT NULL REFERENCES categories (code) ON DELETE CASCADE,
  PRIMARY KEY (event_id, category_code)
);

-- ---------------------------------------------------------------------------
-- 4. ASISTENTES / INSCRIPCIONES
--    "Inscritos" y "recaudo" NO se guardan como número: se CALCULAN con estas filas.
--    price_paid_cop congela el precio del momento: si el Agente cambia el precio
--    después, el dinero ya recaudado no se altera.
-- ---------------------------------------------------------------------------
CREATE TABLE attendees (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  user_id        UUID        REFERENCES users (id) ON DELETE SET NULL,   -- NULL = registrado a mano por el Agente
  name           TEXT        NOT NULL,
  email          TEXT,
  phone          TEXT,
  status         TEXT        NOT NULL DEFAULT 'confirmado'
                             CHECK (status IN ('confirmado', 'pendiente', 'cancelado')),
  price_paid_cop INTEGER     NOT NULL DEFAULT 0 CHECK (price_paid_cop >= 0),
  registered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_in_at  TIMESTAMPTZ,
  checked_in_by  UUID        REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_checkin_confirmed CHECK (checked_in_at IS NULL OR status = 'confirmado')
);
-- Un usuario no puede tener dos inscripciones activas al mismo evento
-- (si canceló, puede volver a inscribirse: la cancelada no cuenta)
CREATE UNIQUE INDEX attendees_one_active_per_user
  ON attendees (event_id, user_id) WHERE user_id IS NOT NULL AND status <> 'cancelado';
CREATE INDEX idx_attendees_event_status ON attendees (event_id, status);
CREATE INDEX idx_attendees_user         ON attendees (user_id);

-- ---------------------------------------------------------------------------
-- 5. TAREAS (tablero Kanban del Agente)
-- ---------------------------------------------------------------------------
CREATE TABLE tasks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL CHECK (length(btrim(title)) > 0),
  event_id    UUID        REFERENCES events (id) ON DELETE SET NULL,
  assignee_id UUID        REFERENCES users  (id) ON DELETE SET NULL,
  category    TEXT,
  due_date    DATE,
  priority    TEXT        NOT NULL DEFAULT 'media'     CHECK (priority IN ('alta', 'media', 'baja')),
  status      TEXT        NOT NULL DEFAULT 'pendiente' CHECK (status   IN ('pendiente', 'en_progreso', 'completado')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_status ON tasks (status);

-- ---------------------------------------------------------------------------
-- 6. BITÁCORA (quién hizo qué: suspender cuentas, eliminar eventos, cambiar precios...)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
  id         BIGSERIAL   PRIMARY KEY,
  actor_id   UUID        REFERENCES users (id) ON DELETE SET NULL,
  entity     TEXT        NOT NULL,          -- 'account' | 'event' | 'attendee' | 'task'
  entity_id  UUID,
  action     TEXT        NOT NULL,          -- 'suspend' | 'activate' | 'delete' | 'update_price' ...
  old_value  JSONB,
  new_value  JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_log (entity, entity_id);

-- ---------------------------------------------------------------------------
-- 7. TRIGGERS (reglas que la base hace sola, aunque el backend falle o se olvide)
-- ---------------------------------------------------------------------------
CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_users_updated  BEFORE UPDATE ON users  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_tasks_updated  BEFORE UPDATE ON tasks  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- El aforo nunca puede bajar de los inscritos actuales (misma regla que el formulario del Agente)
CREATE FUNCTION trg_events_capacity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_active INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_active
    FROM attendees WHERE event_id = NEW.id AND status IN ('confirmado', 'pendiente');
  IF NEW.capacity < v_active THEN
    RAISE EXCEPTION 'El aforo (%) no puede ser menor a los % inscritos actuales.', NEW.capacity, v_active
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER events_capacity_guard
  BEFORE UPDATE OF capacity ON events
  FOR EACH ROW WHEN (NEW.capacity IS DISTINCT FROM OLD.capacity)
  EXECUTE FUNCTION trg_events_capacity_guard();

-- Un evento nuevo recibe automáticamente la categoría por defecto de su tipo
CREATE FUNCTION trg_events_default_category() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO event_categories (event_id, category_code)
  SELECT NEW.id, t.default_category FROM event_types t
   WHERE t.code = NEW.type_code AND t.default_category IS NOT NULL
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER events_default_category AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION trg_events_default_category();

-- ---------------------------------------------------------------------------
-- 8. FUNCIONES DE NEGOCIO
-- ---------------------------------------------------------------------------

-- Inscribir a un usuario SIN sobreventa. FOR UPDATE bloquea la fila del evento:
-- si dos personas piden el último cupo a la vez, la segunda espera y luego ve "sin cupos".
CREATE FUNCTION register_for_event(p_event UUID, p_user UUID) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_ev     events%ROWTYPE;
  v_u      users%ROWTYPE;
  v_active INTEGER;
  v_id     UUID;
BEGIN
  SELECT * INTO v_ev FROM events WHERE id = p_event FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este evento ya no está disponible.';
  END IF;

  SELECT * INTO v_u FROM users WHERE id = p_user;
  IF NOT FOUND OR v_u.status <> 'activo' THEN
    RAISE EXCEPTION 'Esta cuenta no puede inscribirse.';
  END IF;

  IF v_ev.availability <> 'open' OR v_ev.status IN ('completado', 'cancelado') THEN
    RAISE EXCEPTION 'Las inscripciones de este evento no están abiertas.';
  END IF;

  IF EXISTS (SELECT 1 FROM attendees WHERE event_id = p_event AND user_id = p_user AND status <> 'cancelado') THEN
    RAISE EXCEPTION 'Ya estás inscrito en este evento.';
  END IF;

  SELECT COUNT(*) INTO v_active
    FROM attendees WHERE event_id = p_event AND status IN ('confirmado', 'pendiente');
  IF v_active >= v_ev.capacity THEN
    RAISE EXCEPTION 'Este evento se quedó sin cupos.';
  END IF;

  INSERT INTO attendees (event_id, user_id, name, email, phone, status, price_paid_cop)
  VALUES (p_event, p_user, v_u.name, v_u.email, v_u.phone, 'confirmado', v_ev.price_cop)
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

-- Eliminar una cuenta "definitivamente" sin romper las finanzas:
-- las inscripciones del usuario se conservan pero ANONIMIZADAS (el dinero recaudado sigue contando).
CREATE FUNCTION admin_delete_account(p_admin UUID, p_target UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_t users%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin AND role = 'admin' AND status = 'activo') THEN
    RAISE EXCEPTION 'Solo un administrador puede eliminar cuentas.';
  END IF;

  SELECT * INTO v_t FROM users WHERE id = p_target FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La cuenta no existe.';
  END IF;
  IF v_t.role = 'admin' THEN
    RAISE EXCEPTION 'Las cuentas de administrador no se eliminan desde este módulo.';
  END IF;

  INSERT INTO audit_log (actor_id, entity, entity_id, action, old_value)
  VALUES (p_admin, 'account', p_target, 'delete', jsonb_build_object('role', v_t.role, 'created_at', v_t.created_at));

  UPDATE attendees SET name = 'Cuenta eliminada', email = NULL, phone = NULL WHERE user_id = p_target;
  DELETE FROM users WHERE id = p_target;
END $$;

-- ---------------------------------------------------------------------------
-- 9. VISTAS (consultas ya armadas: el backend solo hace SELECT * FROM ...)
-- ---------------------------------------------------------------------------

-- Una fila por evento con inscritos, cupos libres y dinero recaudado
CREATE VIEW v_event_stats AS
SELECT e.id AS event_id, e.name, e.type_code, e.event_date, e.status, e.availability,
       e.capacity, e.price_cop,
       COUNT(a.id) FILTER (WHERE a.status IN ('confirmado', 'pendiente'))::INTEGER AS registered,
       (e.capacity - COUNT(a.id) FILTER (WHERE a.status IN ('confirmado', 'pendiente')))::INTEGER AS spots_left,
       COALESCE(SUM(a.price_paid_cop) FILTER (WHERE a.status IN ('confirmado', 'pendiente')), 0)::BIGINT AS revenue_cop
  FROM events e
  LEFT JOIN attendees a ON a.event_id = e.id
 GROUP BY e.id;

-- Admin · "Ingresos por categoría"
CREATE VIEW v_revenue_by_type AS
SELECT t.code AS type_code, t.label, COALESCE(SUM(s.revenue_cop), 0)::BIGINT AS revenue_cop
  FROM event_types t
  LEFT JOIN v_event_stats s ON s.type_code = t.code AND s.status <> 'cancelado'
 GROUP BY t.code, t.label;

-- Admin · "Ocupación global"
CREATE VIEW v_global_occupancy AS
SELECT COALESCE(SUM(registered), 0)::BIGINT AS registered,
       COALESCE(SUM(capacity), 0)::BIGINT   AS capacity,
       CASE WHEN COALESCE(SUM(capacity), 0) = 0 THEN 0
            ELSE ROUND(100.0 * SUM(registered) / SUM(capacity))::INTEGER END AS occupancy_pct
  FROM v_event_stats
 WHERE status <> 'cancelado';

-- Admin · "Crecimiento de usuarios" (nuevos por mes y acumulado)
CREATE VIEW v_user_growth_monthly AS
SELECT month, new_users, (SUM(new_users) OVER (ORDER BY month))::INTEGER AS total_users
  FROM (SELECT date_trunc('month', created_at)::DATE AS month, COUNT(*)::INTEGER AS new_users
          FROM users WHERE role = 'user' GROUP BY 1) m;

-- Home público: eventos visibles, con cupos y categorías
CREATE VIEW v_public_events AS
SELECT s.event_id AS id, s.name, s.type_code, s.event_date, e.start_time, e.location, e.description,
       e.image_url, s.capacity, s.price_cop, s.availability, e.is_featured, s.registered,
       GREATEST(s.spots_left, 0) AS spots_left,
       COALESCE((SELECT array_agg(ec.category_code ORDER BY ec.category_code)
                   FROM event_categories ec WHERE ec.event_id = s.event_id), '{}') AS categories
  FROM v_event_stats s
  JOIN events e ON e.id = s.event_id
 WHERE e.is_public AND e.status NOT IN ('completado', 'cancelado');

COMMIT;
