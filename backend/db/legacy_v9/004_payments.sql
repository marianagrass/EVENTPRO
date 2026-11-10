-- ============================================================================
-- 004_payments.sql  —  Pagos, zonas, puntos de fidelización, comisiones y precios dinámicos
--
-- Cómo ejecutarlo: Neon Console → SQL Editor → pegar TODO el archivo → Run.
-- Requisito: 001_schema.sql y 002_seed.sql ya ejecutados.
-- Es seguro correrlo dos veces (usa IF NOT EXISTS / OR REPLACE). Va en una transacción.
--
-- Qué agrega (y qué parte de la matemática vive aquí, en el Modelo):
--   1. zones             → coeficiente C de cada zona (función a trozos de P(x))
--   2. users.loyalty_points + loyalty_ledger → puntos p de D(p)
--   3. payments          → una fila por compra: guarda B, x, C, descuentos y P(x) tal como se pagó
--   4. attendees.payment_id / zone_code → cada boleta apunta a su pago y su zona
--   5. events.base_price_cop / price_cop → precio base fijado por el Agente vs. precio vigente
--      (el algoritmo de precios dinámicos solo mueve price_cop) + price_adjustments (bitácora)
--   6. events.sales_state → 'disponible' | 'ultimos_cupos' | 'agotado'  (límite por la izquierda)
--   7. commission_rules + v_agent_activity → liquidación lineal del Agente
--   8. confirm_checkout() / cancel_registration() → transacciones atómicas y sin sobreventa
-- ============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. ZONAS  (C en  P(x) = B·x·C − D(p) )
--    Función a trozos:  C(zona) = 1.00 si general · 1.50 si preferencial · 2.50 si vip
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zones (
  code        TEXT         PRIMARY KEY CHECK (code ~ '^[a-z_]+$'),
  label       TEXT         NOT NULL,
  coefficient NUMERIC(4,2) NOT NULL CHECK (coefficient >= 1),
  sort_order  SMALLINT     NOT NULL DEFAULT 0
);
INSERT INTO zones (code, label, coefficient, sort_order) VALUES
  ('general',      'General',      1.00, 1),
  ('preferencial', 'Preferencial', 1.50, 2),
  ('vip',          'VIP',          2.50, 3)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. FIDELIZACIÓN  (p en D(p))
--    users.loyalty_points es el saldo; loyalty_ledger es el libro contable de cada movimiento
--    (suma de delta = saldo), así siempre se puede explicar de dónde salió cada punto.
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_points_nonneg') THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_points_nonneg CHECK (loyalty_points >= 0);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. EVENTOS: precio base vs. precio vigente + estado de ventas
-- ---------------------------------------------------------------------------
ALTER TABLE events ADD COLUMN IF NOT EXISTS base_price_cop INTEGER;
UPDATE events SET base_price_cop = price_cop WHERE base_price_cop IS NULL;
ALTER TABLE events ALTER COLUMN base_price_cop SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_base_price') THEN
    ALTER TABLE events ADD CONSTRAINT chk_events_base_price CHECK (base_price_cop >= 0);
  END IF;
END $$;

-- Un evento nuevo (o un INSERT que no diga el precio base) arranca con base = precio.
CREATE OR REPLACE FUNCTION trg_events_base_price() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.base_price_cop IS NULL THEN NEW.base_price_cop := NEW.price_cop; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS events_base_price ON events;
CREATE TRIGGER events_base_price BEFORE INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION trg_events_base_price();

ALTER TABLE events ADD COLUMN IF NOT EXISTS sales_state TEXT NOT NULL DEFAULT 'disponible';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_events_sales_state') THEN
    ALTER TABLE events ADD CONSTRAINT chk_events_sales_state
      CHECK (sales_state IN ('disponible', 'ultimos_cupos', 'agotado'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS price_adjustments (   -- bitácora del precio dinámico
  id              BIGSERIAL     PRIMARY KEY,
  event_id        UUID          NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  old_price_cop   INTEGER       NOT NULL,
  new_price_cop   INTEGER       NOT NULL,
  reason          TEXT          NOT NULL,
  demand_rate_cop NUMERIC(14,2),                 -- dI/dt en el pico, COP por hora
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_adj_event ON price_adjustments (event_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. CONTROL DE AFORO — límite por la izquierda
--    Sea s = inscritos / aforo.  Cuando s → 1⁻ el estado pasa a 'ultimos_cupos' y, al llegar
--    s = 1, a 'agotado'.  "Últimos cupos" = quedan ≤ max(1, ⌈10 % del aforo⌉) boletas.
--    (La misma regla está en backend/lib/capacity.js para validar antes de cobrar.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sales_state_for(p_capacity INTEGER, p_registered INTEGER, p_threshold NUMERIC DEFAULT 0.10)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_capacity - p_registered <= 0                                   THEN 'agotado'
    WHEN p_capacity - p_registered <= GREATEST(1, CEIL(p_capacity * p_threshold)) THEN 'ultimos_cupos'
    ELSE 'disponible'
  END
$$;

CREATE OR REPLACE FUNCTION refresh_event_sales_state(p_event UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_cap INTEGER; v_reg INTEGER; v_new TEXT;
BEGIN
  SELECT capacity INTO v_cap FROM events WHERE id = p_event;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT COUNT(*) INTO v_reg FROM attendees WHERE event_id = p_event AND status IN ('confirmado', 'pendiente');
  v_new := sales_state_for(v_cap, v_reg);
  UPDATE events SET sales_state = v_new WHERE id = p_event AND sales_state IS DISTINCT FROM v_new;
END $$;

-- Cada vez que cambian las inscripciones de un evento, su estado se recalcula solo.
CREATE OR REPLACE FUNCTION trg_attendees_sales_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM refresh_event_sales_state(NEW.event_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM refresh_event_sales_state(OLD.event_id);
  ELSE
    PERFORM refresh_event_sales_state(OLD.event_id);
    IF NEW.event_id <> OLD.event_id THEN PERFORM refresh_event_sales_state(NEW.event_id); END IF;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS attendees_sales_state ON attendees;
CREATE TRIGGER attendees_sales_state
  AFTER INSERT OR DELETE OR UPDATE OF status, event_id ON attendees
  FOR EACH ROW EXECUTE FUNCTION trg_attendees_sales_state();

-- Si el Agente cambia el aforo, el estado también se actualiza.
CREATE OR REPLACE FUNCTION trg_events_sales_state_cap() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_reg INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_reg FROM attendees WHERE event_id = NEW.id AND status IN ('confirmado', 'pendiente');
  NEW.sales_state := sales_state_for(NEW.capacity, v_reg);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS events_sales_state_cap ON events;
CREATE TRIGGER events_sales_state_cap BEFORE UPDATE OF capacity ON events
  FOR EACH ROW WHEN (NEW.capacity IS DISTINCT FROM OLD.capacity)
  EXECUTE FUNCTION trg_events_sales_state_cap();

-- ---------------------------------------------------------------------------
-- 5. PAGOS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT         NOT NULL UNIQUE
                                    DEFAULT ('EP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))),
  user_id              UUID         REFERENCES users (id) ON DELETE SET NULL,
  event_id             UUID         NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  zone_code            TEXT         NOT NULL REFERENCES zones (code),
  quantity             INTEGER      NOT NULL CHECK (quantity BETWEEN 1 AND 10),        -- x
  unit_price_cop       INTEGER      NOT NULL CHECK (unit_price_cop >= 0),             -- B (vigente al pagar)
  zone_coefficient     NUMERIC(4,2) NOT NULL CHECK (zone_coefficient >= 1),           -- C
  subtotal_cop         INTEGER      NOT NULL CHECK (subtotal_cop >= 0),               -- B·x·C
  points_used          INTEGER      NOT NULL DEFAULT 0 CHECK (points_used >= 0),
  loyalty_discount_cop INTEGER      NOT NULL DEFAULT 0 CHECK (loyalty_discount_cop >= 0),
  welcome_discount_cop INTEGER      NOT NULL DEFAULT 0 CHECK (welcome_discount_cop >= 0),
  total_cop            INTEGER      NOT NULL CHECK (total_cop >= 0),                  -- P(x)
  points_earned        INTEGER      NOT NULL DEFAULT 0 CHECK (points_earned >= 0),
  method               TEXT         NOT NULL CHECK (method IN ('tarjeta', 'pse', 'nequi', 'gratis')),
  card_brand           TEXT,
  card_last4           TEXT         CHECK (card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$'),  -- NUNCA el número completo
  status               TEXT         NOT NULL DEFAULT 'pagado' CHECK (status IN ('pagado', 'reembolsado')),
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- La base verifica la fórmula: P(x) = subtotal − descuentos
  CONSTRAINT chk_payment_math CHECK (total_cop = subtotal_cop - loyalty_discount_cop - welcome_discount_cop)
);
CREATE INDEX IF NOT EXISTS idx_payments_user  ON payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_event ON payments (event_id);

CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  payment_id UUID        REFERENCES payments (id) ON DELETE SET NULL,
  delta      INTEGER     NOT NULL CHECK (delta <> 0),
  reason     TEXT        NOT NULL CHECK (reason IN ('compra', 'canje', 'reembolso_compra', 'reembolso_canje', 'ajuste')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_user ON loyalty_ledger (user_id, created_at DESC);

ALTER TABLE attendees ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments (id) ON DELETE SET NULL;
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS zone_code  TEXT NOT NULL DEFAULT 'general' REFERENCES zones (code);
CREATE INDEX IF NOT EXISTS idx_attendees_payment ON attendees (payment_id);
CREATE INDEX IF NOT EXISTS idx_attendees_registered ON attendees (registered_at);

-- "Nuevo ingreso": una cuenta que nunca ha tenido ninguna inscripción ni ningún pago (ni siquiera cancelados:
-- así no se puede repetir la oferta comprando y cancelando).
CREATE OR REPLACE FUNCTION is_new_member(p_user UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM attendees WHERE user_id = p_user)
     AND NOT EXISTS (SELECT 1 FROM payments  WHERE user_id = p_user)
$$;

-- ---------------------------------------------------------------------------
-- 6. COMISIONES DEL AGENTE  —  L(E, T) = b·E + m·T   (función lineal)
--      E = eventos que ha gestionado (creó o en los que hizo check-in)
--      T = entradas que ha gestionado (check-in hechos por él)
--      b = pago por evento · m = pago por entrada
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS commission_rules (
  id             SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),     -- una sola regla vigente
  per_event_cop  INTEGER     NOT NULL DEFAULT 40000 CHECK (per_event_cop  >= 0),   -- b
  per_ticket_cop INTEGER     NOT NULL DEFAULT 1200  CHECK (per_ticket_cop >= 0),   -- m
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO commission_rules (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE VIEW v_agent_activity AS
WITH checkins AS (
  SELECT checked_in_by AS agent_id, event_id, id AS attendee_id
    FROM attendees WHERE checked_in_by IS NOT NULL AND checked_in_at IS NOT NULL
), managed AS (
  SELECT created_by AS agent_id, id AS event_id FROM events WHERE created_by IS NOT NULL
  UNION
  SELECT agent_id, event_id FROM checkins
)
SELECT u.id AS agent_id, u.name,
       (SELECT COUNT(*) FROM managed  m WHERE m.agent_id = u.id)::INTEGER AS events_managed,
       (SELECT COUNT(*) FROM checkins c WHERE c.agent_id = u.id)::INTEGER AS tickets_managed
  FROM users u
 WHERE u.role = 'agent';

-- Datos de demostración: los check-in de los eventos ya realizados quedan a nombre de los agentes activos
-- (el 1.º evento realizado → 1.er agente activo, el 2.º → el siguiente…). Solo toca filas sin agente.
WITH agents AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) - 1 AS n FROM users WHERE role = 'agent' AND status = 'activo'
), evs AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY event_date, id) - 1 AS n
    FROM events WHERE id IN (SELECT event_id FROM attendees WHERE checked_in_at IS NOT NULL AND checked_in_by IS NULL)
)
UPDATE attendees a SET checked_in_by = ag.id
  FROM evs e JOIN agents ag ON ag.n = e.n % (SELECT COUNT(*) FROM agents)
 WHERE a.event_id = e.id AND a.checked_in_at IS NOT NULL AND a.checked_in_by IS NULL
   AND (SELECT COUNT(*) FROM agents) > 0;

-- Datos de demostración: repartir las inscripciones ficticias a lo largo de 2026 para que el reporte
-- mensual del Admin tenga forma de curva (hay más ventas cerca de la fecha del evento).
-- Solo toca las filas "Asistente de prueba N" del seed; las compras reales no se tocan.
UPDATE attendees a
   SET registered_at = GREATEST(
         TIMESTAMPTZ '2026-01-05 10:00:00-05',
         LEAST(now() - interval '2 hours', (e.event_date + e.start_time) AT TIME ZONE 'America/Bogota')
         - make_interval(days  => (150 * power((abs(hashtext(a.id::text)::BIGINT) % 1000) / 1000.0, 2.2))::INT,
                         hours => (abs(hashtext(a.id::text || 'h')::BIGINT) % 12)::INT))
  FROM events e
 WHERE e.id = a.event_id AND a.payment_id IS NULL AND a.name LIKE 'Asistente de prueba %';

-- Puntos iniciales de demostración: 1 punto por cada $1.000 gastados antes de existir el sistema
-- + un bono de lanzamiento de 100 puntos. Solo cuentas «user» activas SIN movimientos en el libro
-- (así no se pisa nada si se vuelve a ejecutar este archivo).
WITH hist AS (
  SELECT user_id, FLOOR(SUM(price_paid_cop) / 1000)::INT AS pts
    FROM attendees WHERE user_id IS NOT NULL AND status = 'confirmado' AND payment_id IS NULL
   GROUP BY user_id
), cand AS (
  SELECT u.id, COALESCE(h.pts, 0) + 100 AS pts
    FROM users u LEFT JOIN hist h ON h.user_id = u.id
   WHERE u.role = 'user' AND u.status = 'activo'
     AND NOT EXISTS (SELECT 1 FROM loyalty_ledger l WHERE l.user_id = u.id)
), grant_pts AS (
  UPDATE users u SET loyalty_points = u.loyalty_points + c.pts FROM cand c WHERE u.id = c.id
  RETURNING u.id, c.pts
)
INSERT INTO loyalty_ledger (user_id, delta, reason) SELECT id, pts, 'ajuste' FROM grant_pts;

-- Estado de ventas de todos los eventos con los datos actuales
UPDATE events e SET sales_state = sales_state_for(
  e.capacity,
  (SELECT COUNT(*)::INT FROM attendees a WHERE a.event_id = e.id AND a.status IN ('confirmado', 'pendiente')));

-- ---------------------------------------------------------------------------
-- 7. TRANSACCIONES ATÓMICAS
-- ---------------------------------------------------------------------------

-- Confirma una compra. El controlador de Node YA calculó P(x); aquí se REVALIDA todo bajo bloqueo
-- (precio vigente, aforo, puntos, oferta de bienvenida) y se guarda en un solo paso: o queda todo o nada.
CREATE OR REPLACE FUNCTION confirm_checkout(
  p_event UUID, p_user UUID, p_quantity INTEGER, p_zone TEXT,
  p_unit_price INTEGER, p_coef NUMERIC, p_subtotal INTEGER,
  p_points_used INTEGER, p_loyalty_discount INTEGER, p_welcome_discount INTEGER, p_total INTEGER,
  p_points_earned INTEGER, p_method TEXT, p_brand TEXT, p_last4 TEXT
) RETURNS TABLE (payment_id UUID, code TEXT, points_earned INTEGER, new_balance INTEGER)
LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE
  v_ev      events%ROWTYPE;
  v_u       users%ROWTYPE;
  v_coef    NUMERIC;
  v_active  INTEGER;
  v_pay     UUID;
  v_code    TEXT;
  v_each    INTEGER;
  i         INTEGER;
BEGIN
  SELECT * INTO v_ev FROM events WHERE id = p_event FOR UPDATE;           -- bloquea el evento: nadie más vende a la vez
  IF NOT FOUND THEN RAISE EXCEPTION 'Este evento ya no está disponible.'; END IF;
  SELECT * INTO v_u FROM users WHERE id = p_user FOR UPDATE;
  IF NOT FOUND OR v_u.status <> 'activo' THEN RAISE EXCEPTION 'Esta cuenta no puede inscribirse.'; END IF;

  IF v_ev.availability <> 'open' OR v_ev.status IN ('completado', 'cancelado') THEN
    RAISE EXCEPTION 'Las inscripciones de este evento no están abiertas.';
  END IF;
  IF EXISTS (SELECT 1 FROM attendees WHERE event_id = p_event AND user_id = p_user AND status <> 'cancelado') THEN
    RAISE EXCEPTION 'Ya estás inscrito en este evento.';
  END IF;
  IF p_quantity < 1 OR p_quantity > 10 THEN RAISE EXCEPTION 'Cantidad de entradas inválida.'; END IF;

  -- ¿cambió el precio mientras el usuario pagaba? (precios dinámicos)
  IF p_unit_price <> v_ev.price_cop THEN
    RAISE EXCEPTION 'El precio del evento cambió mientras pagabas. Revisa el nuevo total e inténtalo de nuevo.';
  END IF;
  SELECT coefficient INTO v_coef FROM zones WHERE zones.code = p_zone;
  IF NOT FOUND OR v_coef <> p_coef THEN RAISE EXCEPTION 'La zona seleccionada no es válida.'; END IF;
  IF ROUND(p_unit_price * p_quantity * v_coef) <> p_subtotal THEN RAISE EXCEPTION 'El subtotal no coincide con B·x·C.'; END IF;

  -- aforo: sin sobreventa
  SELECT COUNT(*) INTO v_active FROM attendees WHERE event_id = p_event AND status IN ('confirmado', 'pendiente');
  IF v_active + p_quantity > v_ev.capacity THEN
    IF v_ev.capacity - v_active <= 0 THEN RAISE EXCEPTION 'Este evento se quedó sin cupos.'; END IF;
    RAISE EXCEPTION 'Solo quedan % cupos para este evento.', v_ev.capacity - v_active;
  END IF;

  -- puntos y oferta de bienvenida
  IF p_points_used > v_u.loyalty_points THEN RAISE EXCEPTION 'No tienes suficientes puntos de fidelización.'; END IF;
  IF p_welcome_discount > 0 AND NOT is_new_member(p_user) THEN
    RAISE EXCEPTION 'La oferta de nuevo ingreso ya no está disponible para esta cuenta.';
  END IF;

  INSERT INTO payments (user_id, event_id, zone_code, quantity, unit_price_cop, zone_coefficient, subtotal_cop,
                        points_used, loyalty_discount_cop, welcome_discount_cop, total_cop, points_earned,
                        method, card_brand, card_last4)
  VALUES (p_user, p_event, p_zone, p_quantity, p_unit_price, v_coef, p_subtotal,
          p_points_used, p_loyalty_discount, p_welcome_discount, p_total, p_points_earned,
          p_method, p_brand, p_last4)
  RETURNING id, payments.code INTO v_pay, v_code;

  -- una fila por boleta: la 1.ª es del comprador; las demás son acompañantes (sin cuenta)
  v_each := p_total / p_quantity;
  FOR i IN 1..p_quantity LOOP
    INSERT INTO attendees (event_id, user_id, name, email, phone, status, price_paid_cop, payment_id, zone_code)
    VALUES (p_event,
            CASE WHEN i = 1 THEN p_user END,
            CASE WHEN i = 1 THEN v_u.name ELSE 'Acompañante ' || (i - 1) || ' de ' || v_u.name END,
            CASE WHEN i = 1 THEN v_u.email END,
            CASE WHEN i = 1 THEN v_u.phone END,
            'confirmado',
            CASE WHEN i = 1 THEN p_total - v_each * (p_quantity - 1) ELSE v_each END,   -- el residuo va a la 1.ª
            v_pay, p_zone);
  END LOOP;

  -- puntos: se descuentan los canjeados y se acreditan los ganados
  IF p_points_used > 0 THEN
    INSERT INTO loyalty_ledger (user_id, payment_id, delta, reason) VALUES (p_user, v_pay, -p_points_used, 'canje');
  END IF;
  IF p_points_earned > 0 THEN
    INSERT INTO loyalty_ledger (user_id, payment_id, delta, reason) VALUES (p_user, v_pay, p_points_earned, 'compra');
  END IF;
  UPDATE users SET loyalty_points = loyalty_points - p_points_used + p_points_earned WHERE id = p_user;

  RETURN QUERY SELECT v_pay, v_code, p_points_earned, (SELECT loyalty_points FROM users WHERE id = p_user);
END $$;

-- Cancela la inscripción de un usuario. Si venía de un pago: cancela todas sus boletas, marca el pago
-- como reembolsado y revierte los puntos (devuelve los canjeados y retira los ganados).
CREATE OR REPLACE FUNCTION cancel_registration(p_event UUID, p_user UUID) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_row attendees%ROWTYPE;
  v_pay payments%ROWTYPE;
  v_take INTEGER;
BEGIN
  SELECT * INTO v_row FROM attendees
   WHERE event_id = p_event AND user_id = p_user AND status <> 'cancelado' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No tienes una inscripción activa en este evento.'; END IF;

  IF v_row.payment_id IS NULL THEN
    IF v_row.checked_in_at IS NOT NULL THEN RAISE EXCEPTION 'Ya hiciste check-in: no se puede cancelar.'; END IF;
    UPDATE attendees SET status = 'cancelado' WHERE id = v_row.id;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM attendees WHERE payment_id = v_row.payment_id AND checked_in_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Ya hiciste check-in: no se puede cancelar.';
  END IF;
  SELECT * INTO v_pay FROM payments WHERE id = v_row.payment_id FOR UPDATE;

  UPDATE attendees SET status = 'cancelado' WHERE payment_id = v_row.payment_id AND status <> 'cancelado';
  UPDATE payments  SET status = 'reembolsado' WHERE id = v_pay.id;

  IF v_pay.points_used > 0 THEN
    INSERT INTO loyalty_ledger (user_id, payment_id, delta, reason) VALUES (p_user, v_pay.id, v_pay.points_used, 'reembolso_canje');
  END IF;
  SELECT LEAST(v_pay.points_earned, loyalty_points + v_pay.points_used) INTO v_take FROM users WHERE id = p_user;
  IF v_take > 0 THEN
    INSERT INTO loyalty_ledger (user_id, payment_id, delta, reason) VALUES (p_user, v_pay.id, -v_take, 'reembolso_compra');
  END IF;
  UPDATE users SET loyalty_points = loyalty_points + v_pay.points_used - COALESCE(v_take, 0) WHERE id = p_user;
END $$;

COMMIT;
