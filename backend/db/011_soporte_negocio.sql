-- ============================================================================
-- 011_soporte_negocio.sql  —  Capa de soporte de la lógica de negocio sobre el modelo ER
--
-- Requisito: 010_modelo_er.sql ya ejecutado.  Es seguro correrlo varias veces (OR REPLACE / IF NOT EXISTS).
--
-- ⚠ ESTE ARCHIVO NO ES PARTE DEL ER DEL TUTOR. Contiene lo mínimo para que NO se pierda la matemática
--   ya implementada (P(x), precios dinámicos, comisiones, fila virtual…) sin tocar las tablas del ER:
--
--     zona            → coeficiente C de P(x) = B·x·C − D(p)            (función a trozos)
--     reserva_pago    → detalle del cobro de una RESERVA (1 a 1): zona, descuentos, método, puntos
--     ajuste_precio   → bitácora del precio dinámico (el precio_base del Agente nunca se sobrescribe)
--     regla_comision  → las constantes b y m de  L(E,T) = b·E + m·T
--
--   Si el tutor prefiere que no existan, bastaría con quitar este archivo y desactivar los módulos de pagos:
--   las tablas del ER (010) funcionan solas.
-- ============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. TABLAS DE SOPORTE
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zona (                       -- C en P(x):  1.00 general · 1.50 preferencial · 2.50 vip
  codigo      TEXT         PRIMARY KEY CHECK (codigo ~ '^[a-z_]+$'),
  etiqueta    TEXT         NOT NULL,
  coeficiente NUMERIC(4,2) NOT NULL CHECK (coeficiente >= 1),
  orden       SMALLINT     NOT NULL DEFAULT 0
);
INSERT INTO zona (codigo, etiqueta, coeficiente, orden) VALUES
  ('general',      'General',      1.00, 1),
  ('preferencial', 'Preferencial', 1.50, 2),
  ('vip',          'VIP',          2.50, 3)
ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE IF NOT EXISTS reserva_pago (               -- detalle del cobro de una reserva (1 a 1)
  id_reserva             INTEGER       PRIMARY KEY REFERENCES reserva (id_reserva) ON DELETE CASCADE,
  codigo_pago            TEXT          NOT NULL UNIQUE
                                       DEFAULT ('EP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))),
  zona                   TEXT          NOT NULL DEFAULT 'general' REFERENCES zona (codigo),
  coeficiente            NUMERIC(4,2)  NOT NULL DEFAULT 1 CHECK (coeficiente >= 1),            -- C
  precio_unitario        NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),                  -- B vigente al pagar
  subtotal               NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),                         -- B·x·C
  puntos_usados          INTEGER       NOT NULL DEFAULT 0 CHECK (puntos_usados >= 0),
  descuento_fidelizacion NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (descuento_fidelizacion >= 0),
  descuento_bienvenida   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (descuento_bienvenida >= 0),
  puntos_ganados         INTEGER       NOT NULL DEFAULT 0 CHECK (puntos_ganados >= 0),
  metodo                 TEXT          NOT NULL CHECK (metodo IN ('tarjeta', 'pse', 'nequi', 'gratis')),
  marca                  TEXT,
  ultimos4               TEXT          CHECK (ultimos4 IS NULL OR ultimos4 ~ '^[0-9]{4}$'),    -- NUNCA el número completo
  reembolsado            BOOLEAN       NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ajuste_precio (              -- bitácora del precio dinámico
  id              BIGSERIAL     PRIMARY KEY,
  codigo_evento   VARCHAR(20)   NOT NULL REFERENCES evento (codigo_evento) ON UPDATE CASCADE ON DELETE CASCADE,
  precio_anterior NUMERIC(12,2) NOT NULL,
  precio_nuevo    NUMERIC(12,2) NOT NULL CHECK (precio_nuevo >= 0),
  motivo          TEXT          NOT NULL,
  tasa_demanda    NUMERIC(14,2),                        -- dI/dt en el pico, COP por hora
  vigente         BOOLEAN       NOT NULL DEFAULT TRUE,  -- FALSE cuando el Agente cambia el precio_base (se reinicia el ajuste)
  creado_en       TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ajuste_evento ON ajuste_precio (codigo_evento, id DESC);

CREATE TABLE IF NOT EXISTS regla_comision (             -- L(E,T) = b·E + m·T
  id                SMALLINT      PRIMARY KEY DEFAULT 1 CHECK (id = 1),    -- una sola regla vigente
  valor_por_evento  NUMERIC(12,2) NOT NULL DEFAULT 40000 CHECK (valor_por_evento  >= 0),   -- b
  valor_por_entrada NUMERIC(12,2) NOT NULL DEFAULT 1200  CHECK (valor_por_entrada >= 0),   -- m
  actualizado_en    TIMESTAMPTZ   NOT NULL DEFAULT now()
);
INSERT INTO regla_comision (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. FUNCIONES AUXILIARES
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION id_estado_evento_de(p_nombre TEXT) RETURNS INTEGER LANGUAGE sql STABLE AS $$
  SELECT id_estado_evento FROM estado_evento WHERE nombre_estado = p_nombre
$$;
CREATE OR REPLACE FUNCTION id_estado_reserva_de(p_nombre TEXT) RETURNS INTEGER LANGUAGE sql STABLE AS $$
  SELECT id_estado_reserva FROM estado_reserva WHERE nombre_estado = p_nombre
$$;

-- Entradas vendidas de un evento = Σ numero_entradas de las reservas Confirmada / Pendiente
CREATE OR REPLACE FUNCTION inscritos_evento(p_codigo VARCHAR) RETURNS INTEGER LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(r.numero_entradas), 0)::INTEGER
    FROM reserva r JOIN estado_reserva er ON er.id_estado_reserva = r.id_estado_reserva
   WHERE r.codigo_evento = p_codigo AND er.nombre_estado IN ('Confirmada', 'Pendiente')
$$;

-- Precio vigente = último ajuste dinámico vigente, o el precio_base si no hay (o si el Agente lo cambió después)
CREATE OR REPLACE FUNCTION precio_vigente(p_codigo VARCHAR) RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT a.precio_nuevo FROM ajuste_precio a WHERE a.codigo_evento = p_codigo AND a.vigente ORDER BY a.id DESC LIMIT 1),
    (SELECT e.precio_base FROM evento e WHERE e.codigo_evento = p_codigo))
$$;

-- "Nuevo ingreso": un cliente que nunca ha tenido ninguna reserva (ni cancelada: así no se repite la oferta)
CREATE OR REPLACE FUNCTION es_cliente_nuevo(p_cliente VARCHAR) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM reserva WHERE id_cliente = p_cliente)
$$;

-- CONTROL DE AFORO — límite por la izquierda.  s = inscritos / aforo.  Cuando s → 1⁻ el estado pasa a
-- 'ultimos_cupos' y al llegar a s = 1 a 'agotado'. "Últimos cupos" = quedan ≤ max(1, ⌈10 % del aforo⌉).
-- (La misma regla está en backend/lib/capacity.js para validar ANTES de cobrar.)
CREATE OR REPLACE FUNCTION estado_ventas_para(p_capacidad INTEGER, p_inscritos INTEGER, p_umbral NUMERIC DEFAULT 0.10)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_capacidad - p_inscritos <= 0                                            THEN 'agotado'
    WHEN p_capacidad - p_inscritos <= GREATEST(1, CEIL(p_capacidad * p_umbral))    THEN 'ultimos_cupos'
    ELSE 'disponible'
  END
$$;

-- Mantiene al día ESTADO_EVENTO ∈ {Disponible, Últimos cupos, Agotado}. Si el evento está Pausado, Cerrado,
-- Cancelado o Finalizado (decisión manual) NO se toca.
CREATE OR REPLACE FUNCTION refrescar_estado_evento(p_codigo VARCHAR) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_cap INTEGER; v_actual TEXT; v_nuevo TEXT;
BEGIN
  SELECT e.capacidad_total, s.nombre_estado INTO v_cap, v_actual
    FROM evento e JOIN estado_evento s ON s.id_estado_evento = e.id_estado_evento WHERE e.codigo_evento = p_codigo;
  IF NOT FOUND OR v_actual NOT IN ('Disponible', 'Últimos cupos', 'Agotado') THEN RETURN; END IF;
  v_nuevo := CASE estado_ventas_para(v_cap, inscritos_evento(p_codigo))
               WHEN 'agotado' THEN 'Agotado' WHEN 'ultimos_cupos' THEN 'Últimos cupos' ELSE 'Disponible' END;
  IF v_nuevo <> v_actual THEN
    UPDATE evento SET id_estado_evento = id_estado_evento_de(v_nuevo) WHERE codigo_evento = p_codigo;
  END IF;
END $$;

-- COMISIÓN DEL AGENTE — función LINEAL  L(E, T) = b·E + m·T
--   E = eventos suyos no cancelados · T = entradas confirmadas vendidas en esos eventos
-- El resultado queda guardado en AGENTE.comision.
CREATE OR REPLACE FUNCTION recalcular_comision_agente(p_agente VARCHAR) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_e INTEGER; v_t INTEGER; v_b NUMERIC; v_m NUMERIC;
BEGIN
  IF p_agente IS NULL THEN RETURN; END IF;
  SELECT valor_por_evento, valor_por_entrada INTO v_b, v_m FROM regla_comision WHERE id = 1;
  SELECT COUNT(*)::INTEGER INTO v_e
    FROM evento e JOIN estado_evento s ON s.id_estado_evento = e.id_estado_evento
   WHERE e.id_agente = p_agente AND s.nombre_estado <> 'Cancelado';
  SELECT COALESCE(SUM(r.numero_entradas), 0)::INTEGER INTO v_t
    FROM reserva r JOIN evento e ON e.codigo_evento = r.codigo_evento
         JOIN estado_evento s  ON s.id_estado_evento = e.id_estado_evento
         JOIN estado_reserva er ON er.id_estado_reserva = r.id_estado_reserva
   WHERE e.id_agente = p_agente AND s.nombre_estado <> 'Cancelado' AND er.nombre_estado = 'Confirmada';
  UPDATE agente SET comision = COALESCE(v_b, 0) * v_e + COALESCE(v_m, 0) * v_t WHERE numero_identificacion = p_agente;
END $$;

-- ---------------------------------------------------------------------------
-- 3. TRIGGERS DE INTEGRIDAD DEL NEGOCIO
--    La carga masiva (datos demo) los pospone con  set_config('eventpro.carga_masiva','on',true)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION en_carga_masiva() RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('eventpro.carga_masiva', true), '') = 'on'
$$;

-- Sin sobreventa: ninguna reserva activa puede pasar el aforo (aunque alguien inserte a mano)
CREATE OR REPLACE FUNCTION trg_reserva_aforo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_nombre TEXT; v_cap INTEGER; v_act INTEGER;
BEGIN
  SELECT nombre_estado INTO v_nombre FROM estado_reserva WHERE id_estado_reserva = NEW.id_estado_reserva;
  IF v_nombre IN ('Confirmada', 'Pendiente') THEN
    SELECT capacidad_total INTO v_cap FROM evento WHERE codigo_evento = NEW.codigo_evento;
    SELECT COALESCE(SUM(r.numero_entradas), 0) INTO v_act
      FROM reserva r JOIN estado_reserva er ON er.id_estado_reserva = r.id_estado_reserva
     WHERE r.codigo_evento = NEW.codigo_evento AND er.nombre_estado IN ('Confirmada', 'Pendiente')
       AND (TG_OP = 'INSERT' OR r.id_reserva <> NEW.id_reserva);
    IF v_act + NEW.numero_entradas > v_cap THEN
      IF v_cap - v_act <= 0 THEN RAISE EXCEPTION 'Este evento se quedó sin cupos.' USING ERRCODE = 'check_violation'; END IF;
      RAISE EXCEPTION 'Solo quedan % cupos para este evento.', v_cap - v_act USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS reserva_aforo ON reserva;
CREATE TRIGGER reserva_aforo BEFORE INSERT OR UPDATE OF id_estado_reserva, numero_entradas ON reserva
  FOR EACH ROW EXECUTE FUNCTION trg_reserva_aforo();

-- Después de cada cambio en las reservas: se recalcula el estado del evento y la comisión de su agente
CREATE OR REPLACE FUNCTION trg_reserva_despues() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_codigo VARCHAR;
BEGIN
  IF en_carga_masiva() THEN RETURN NULL; END IF;
  v_codigo := COALESCE(NEW.codigo_evento, OLD.codigo_evento);
  PERFORM refrescar_estado_evento(v_codigo);
  PERFORM recalcular_comision_agente((SELECT id_agente FROM evento WHERE codigo_evento = v_codigo));
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS reserva_despues ON reserva;
CREATE TRIGGER reserva_despues AFTER INSERT OR DELETE OR UPDATE OF id_estado_reserva, numero_entradas ON reserva
  FOR EACH ROW EXECUTE FUNCTION trg_reserva_despues();

-- El aforo nunca baja de lo ya vendido
CREATE OR REPLACE FUNCTION trg_evento_aforo() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_ins INTEGER;
BEGIN
  v_ins := inscritos_evento(NEW.codigo_evento);
  IF NEW.capacidad_total < v_ins THEN
    RAISE EXCEPTION 'El aforo (%) no puede ser menor a los % inscritos actuales.', NEW.capacidad_total, v_ins USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS evento_aforo ON evento;
CREATE TRIGGER evento_aforo BEFORE UPDATE OF capacidad_total ON evento
  FOR EACH ROW WHEN (NEW.capacidad_total IS DISTINCT FROM OLD.capacidad_total) EXECUTE FUNCTION trg_evento_aforo();

CREATE OR REPLACE FUNCTION trg_evento_despues_aforo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN PERFORM refrescar_estado_evento(NEW.codigo_evento); RETURN NULL; END $$;
DROP TRIGGER IF EXISTS evento_despues_aforo ON evento;
CREATE TRIGGER evento_despues_aforo AFTER UPDATE OF capacidad_total ON evento
  FOR EACH ROW WHEN (NEW.capacidad_total IS DISTINCT FROM OLD.capacidad_total) EXECUTE FUNCTION trg_evento_despues_aforo();

-- Si el Agente cambia el precio_base, el ajuste dinámico se reinicia (la bitácora se conserva, pero ya no es vigente)
CREATE OR REPLACE FUNCTION trg_evento_precio_base() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN UPDATE ajuste_precio SET vigente = FALSE WHERE codigo_evento = NEW.codigo_evento AND vigente; RETURN NULL; END $$;
DROP TRIGGER IF EXISTS evento_precio_base ON evento;
CREATE TRIGGER evento_precio_base AFTER UPDATE OF precio_base ON evento
  FOR EACH ROW WHEN (NEW.precio_base IS DISTINCT FROM OLD.precio_base) EXECUTE FUNCTION trg_evento_precio_base();

-- La comisión depende de qué eventos tiene el agente y de si están cancelados
CREATE OR REPLACE FUNCTION trg_evento_comision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF en_carga_masiva() THEN RETURN NULL; END IF;
  PERFORM recalcular_comision_agente(NEW.id_agente);
  IF TG_OP = 'UPDATE' AND OLD.id_agente <> NEW.id_agente THEN PERFORM recalcular_comision_agente(OLD.id_agente); END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS evento_comision ON evento;
CREATE TRIGGER evento_comision AFTER INSERT OR UPDATE OF id_agente, id_estado_evento ON evento
  FOR EACH ROW EXECUTE FUNCTION trg_evento_comision();

-- ---------------------------------------------------------------------------
-- 4. VISTAS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_evento_ventas AS
SELECT x.*,
       GREATEST(x.capacidad_total - x.inscritos, 0)                      AS cupos_disponibles,
       estado_ventas_para(x.capacidad_total, x.inscritos)                AS estado_ventas
  FROM (
    SELECT e.codigo_evento, e.nombre_evento, e.capacidad_total, e.precio_base,
           precio_vigente(e.codigo_evento)                                                                   AS precio_vigente,
           COALESCE(SUM(r.numero_entradas) FILTER (WHERE er.nombre_estado IN ('Confirmada', 'Pendiente')), 0)::INTEGER AS inscritos,
           COALESCE(SUM(r.valor_total)     FILTER (WHERE er.nombre_estado IN ('Confirmada', 'Pendiente')), 0)::NUMERIC AS ingresos
      FROM evento e
      LEFT JOIN reserva r         ON r.codigo_evento = e.codigo_evento
      LEFT JOIN estado_reserva er ON er.id_estado_reserva = r.id_estado_reserva
     GROUP BY e.codigo_evento
  ) x;

-- E y T de L(E,T) por agente
CREATE OR REPLACE VIEW v_agente_actividad AS
SELECT a.numero_identificacion AS id_agente, p.nombre_completo,
       (SELECT COUNT(*) FROM evento e JOIN estado_evento s ON s.id_estado_evento = e.id_estado_evento
         WHERE e.id_agente = a.numero_identificacion AND s.nombre_estado <> 'Cancelado')::INTEGER AS eventos_gestionados,
       (SELECT COALESCE(SUM(r.numero_entradas), 0) FROM reserva r
          JOIN evento e ON e.codigo_evento = r.codigo_evento
          JOIN estado_evento s ON s.id_estado_evento = e.id_estado_evento
          JOIN estado_reserva er ON er.id_estado_reserva = r.id_estado_reserva
         WHERE e.id_agente = a.numero_identificacion AND s.nombre_estado <> 'Cancelado' AND er.nombre_estado = 'Confirmada')::INTEGER AS entradas_gestionadas
  FROM agente a JOIN persona p ON p.numero_identificacion = a.numero_identificacion;

-- ---------------------------------------------------------------------------
-- 5. OPERACIONES ATÓMICAS (cada una es una sola transacción: o queda todo o nada)
-- ---------------------------------------------------------------------------

-- 5.1  Registrar una persona con su subclase y su teléfono
--      p_rol: 'cliente' | 'agente' | 'administrador'
--      p_datos (JSON) según el rol:  cliente {visualizacion_publicidad}  ·  agente {experiencia}  ·  administrador {salario, horario}
CREATE OR REPLACE FUNCTION registrar_persona(
  p_id VARCHAR, p_nombre VARCHAR, p_correo VARCHAR, p_clave TEXT, p_direccion VARCHAR,
  p_id_ciudad INTEGER, p_rol TEXT, p_telefono VARCHAR DEFAULT NULL, p_datos JSONB DEFAULT '{}'::jsonb
) RETURNS VARCHAR LANGUAGE plpgsql AS $$
BEGIN
  IF p_clave IS NULL OR length(p_clave) < 6 THEN RAISE EXCEPTION 'La contraseña es demasiado corta.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM ciudad WHERE id_ciudad = p_id_ciudad) THEN RAISE EXCEPTION 'La ciudad seleccionada no existe.'; END IF;
  IF EXISTS (SELECT 1 FROM persona WHERE numero_identificacion = p_id) THEN
    RAISE EXCEPTION 'Ya existe una persona con ese número de identificación.' USING ERRCODE = 'unique_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM persona WHERE lower(correo_electronico) = lower(p_correo)) THEN
    RAISE EXCEPTION 'Ya existe una cuenta con este correo.' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO persona (numero_identificacion, nombre_completo, correo_electronico, contrasena, direccion, id_ciudad)
  VALUES (p_id, btrim(p_nombre), lower(btrim(p_correo)), crypt(p_clave, gen_salt('bf', 8)), NULLIF(btrim(COALESCE(p_direccion, '')), ''), p_id_ciudad);

  IF p_rol = 'cliente' THEN
    INSERT INTO cliente (numero_identificacion, visualizacion_publicidad)
    VALUES (p_id, COALESCE((p_datos ->> 'visualizacion_publicidad')::boolean, TRUE));
  ELSIF p_rol = 'agente' THEN
    INSERT INTO agente (numero_identificacion, experiencia) VALUES (p_id, NULLIF(p_datos ->> 'experiencia', ''));
  ELSIF p_rol = 'administrador' THEN
    INSERT INTO administrador (numero_identificacion, salario, horario)
    VALUES (p_id, COALESCE((p_datos ->> 'salario')::numeric, 0), COALESCE(NULLIF(p_datos ->> 'horario', ''), 'Por definir'));
  ELSE
    RAISE EXCEPTION 'Rol inválido: usa cliente, agente o administrador.';
  END IF;

  IF p_telefono IS NOT NULL AND btrim(p_telefono) <> '' THEN
    INSERT INTO telefono_persona (numero_telefono, numero_identificacion) VALUES (btrim(p_telefono), p_id);
  END IF;
  RETURN p_id;
END $$;

-- 5.2  Editar datos básicos (el teléfono principal se crea, cambia o —si llega vacío— se borra)
CREATE OR REPLACE FUNCTION actualizar_perfil_persona(
  p_id VARCHAR, p_nombre VARCHAR, p_correo VARCHAR, p_direccion VARCHAR, p_id_ciudad INTEGER, p_telefono VARCHAR
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_tel INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM persona WHERE numero_identificacion = p_id) THEN RAISE EXCEPTION 'La persona no existe.'; END IF;
  IF EXISTS (SELECT 1 FROM persona WHERE lower(correo_electronico) = lower(p_correo) AND numero_identificacion <> p_id) THEN
    RAISE EXCEPTION 'Ya existe una cuenta con este correo.' USING ERRCODE = 'unique_violation';
  END IF;
  UPDATE persona SET nombre_completo = btrim(p_nombre), correo_electronico = lower(btrim(p_correo)),
                     direccion = NULLIF(btrim(COALESCE(p_direccion, '')), ''), id_ciudad = p_id_ciudad
   WHERE numero_identificacion = p_id;
  IF p_telefono IS NOT NULL THEN
    IF btrim(p_telefono) = '' THEN
      DELETE FROM telefono_persona WHERE numero_identificacion = p_id;
    ELSE
      SELECT id_telefono INTO v_tel FROM telefono_persona WHERE numero_identificacion = p_id ORDER BY id_telefono LIMIT 1;
      IF v_tel IS NULL THEN INSERT INTO telefono_persona (numero_telefono, numero_identificacion) VALUES (btrim(p_telefono), p_id);
      ELSE UPDATE telefono_persona SET numero_telefono = btrim(p_telefono) WHERE id_telefono = v_tel; END IF;
    END IF;
  END IF;
END $$;

-- 5.3  Cambiar entre Cliente ↔ Agente (el Administrador no cambia de rol)
CREATE OR REPLACE FUNCTION cambiar_rol_persona(p_id VARCHAR, p_rol TEXT) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM administrador WHERE numero_identificacion = p_id) THEN
    RAISE EXCEPTION 'No se puede cambiar el rol de un administrador.';
  END IF;
  IF p_rol = 'agente' THEN
    IF NOT EXISTS (SELECT 1 FROM cliente WHERE numero_identificacion = p_id) THEN RAISE EXCEPTION 'Esa persona ya es agente o no existe.'; END IF;
    IF EXISTS (SELECT 1 FROM reserva WHERE id_cliente = p_id) THEN
      RAISE EXCEPTION 'Esta persona tiene reservas a su nombre: no se puede convertir en agente.';
    END IF;
    DELETE FROM cliente WHERE numero_identificacion = p_id;
    INSERT INTO agente (numero_identificacion) VALUES (p_id);
  ELSIF p_rol = 'cliente' THEN
    IF NOT EXISTS (SELECT 1 FROM agente WHERE numero_identificacion = p_id) THEN RAISE EXCEPTION 'Esa persona ya es cliente o no existe.'; END IF;
    IF EXISTS (SELECT 1 FROM evento WHERE id_agente = p_id) THEN
      RAISE EXCEPTION 'Este agente tiene eventos a su cargo: no se puede convertir en cliente.';
    END IF;
    DELETE FROM agente WHERE numero_identificacion = p_id;
    INSERT INTO cliente (numero_identificacion) VALUES (p_id);
  ELSE
    RAISE EXCEPTION 'Rol inválido: usa cliente o agente.';
  END IF;
END $$;

-- 5.4  Eliminar una cuenta (solo un Administrador; nunca a sí mismo ni a otro administrador)
CREATE OR REPLACE FUNCTION eliminar_persona(p_admin VARCHAR, p_id VARCHAR) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM administrador WHERE numero_identificacion = p_admin) THEN
    RAISE EXCEPTION 'Solo un administrador puede eliminar cuentas.';
  END IF;
  IF p_admin = p_id THEN RAISE EXCEPTION 'No puedes eliminar tu propia cuenta.'; END IF;
  IF EXISTS (SELECT 1 FROM administrador WHERE numero_identificacion = p_id) THEN RAISE EXCEPTION 'No se puede eliminar a otro administrador.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM persona WHERE numero_identificacion = p_id) THEN RAISE EXCEPTION 'La cuenta no existe.'; END IF;
  IF EXISTS (SELECT 1 FROM evento WHERE id_agente = p_id) THEN
    RAISE EXCEPTION 'Este agente tiene eventos a su cargo: reasígnalos o cancélalos antes de eliminarlo.';
  END IF;
  IF EXISTS (SELECT 1 FROM reserva WHERE id_cliente = p_id) THEN
    RAISE EXCEPTION 'Este cliente tiene reservas registradas: no se puede eliminar para conservar el historial.';
  END IF;
  DELETE FROM persona WHERE numero_identificacion = p_id;     -- borra en cascada su subclase y sus teléfonos
END $$;

-- 5.5  CONFIRMAR UNA RESERVA (checkout).  El controlador de Node YA calculó P(x); aquí se REVALIDA todo bajo
--      bloqueo (precio vigente, aforo, puntos, oferta de bienvenida) y se guarda en un solo paso.
CREATE OR REPLACE FUNCTION confirmar_reserva(
  p_evento VARCHAR, p_cliente VARCHAR, p_cantidad INTEGER, p_zona TEXT,
  p_precio_unitario NUMERIC, p_coef NUMERIC, p_subtotal NUMERIC,
  p_puntos_usados INTEGER, p_desc_fidelizacion NUMERIC, p_desc_bienvenida NUMERIC, p_total NUMERIC,
  p_puntos_ganados INTEGER, p_metodo TEXT, p_marca TEXT, p_ultimos4 TEXT
) RETURNS TABLE (reserva_id INTEGER, pago_codigo TEXT, pts_ganados INTEGER, pts_saldo INTEGER)
LANGUAGE plpgsql AS $$
DECLARE
  v_ev      evento%ROWTYPE;
  v_estado  TEXT;
  v_puntos  INTEGER;
  v_coef    NUMERIC;
  v_activos INTEGER;
  v_id      INTEGER;
  v_codigo  TEXT;
BEGIN
  SELECT * INTO v_ev FROM evento WHERE codigo_evento = p_evento FOR UPDATE;      -- bloquea el evento: nadie más vende a la vez
  IF NOT FOUND THEN RAISE EXCEPTION 'Este evento ya no está disponible.'; END IF;
  SELECT cantidad_puntos INTO v_puntos FROM cliente WHERE numero_identificacion = p_cliente FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solo las cuentas de Cliente pueden reservar entradas.'; END IF;

  SELECT nombre_estado INTO v_estado FROM estado_evento WHERE id_estado_evento = v_ev.id_estado_evento;
  IF v_estado NOT IN ('Disponible', 'Últimos cupos', 'Agotado') OR v_ev.fecha_hora_fin <= (now() AT TIME ZONE 'America/Bogota') THEN
    RAISE EXCEPTION 'Las inscripciones de este evento no están abiertas.';
  END IF;
  IF EXISTS (SELECT 1 FROM reserva r JOIN estado_reserva er ON er.id_estado_reserva = r.id_estado_reserva
              WHERE r.codigo_evento = p_evento AND r.id_cliente = p_cliente AND er.nombre_estado <> 'Cancelada') THEN
    RAISE EXCEPTION 'Ya estás inscrito en este evento.';
  END IF;
  IF p_cantidad < 1 OR p_cantidad > 10 THEN RAISE EXCEPTION 'Cantidad de entradas inválida.'; END IF;

  -- ¿cambió el precio mientras el usuario pagaba? (precios dinámicos)
  IF p_precio_unitario <> precio_vigente(p_evento) THEN
    RAISE EXCEPTION 'El precio del evento cambió mientras pagabas. Revisa el nuevo total e inténtalo de nuevo.';
  END IF;
  SELECT coeficiente INTO v_coef FROM zona WHERE codigo = p_zona;
  IF NOT FOUND OR v_coef <> p_coef THEN RAISE EXCEPTION 'La zona seleccionada no es válida.'; END IF;
  IF ROUND(p_precio_unitario * p_cantidad * v_coef) <> p_subtotal THEN RAISE EXCEPTION 'El subtotal no coincide con B·x·C.'; END IF;
  IF p_total <> p_subtotal - p_desc_fidelizacion - p_desc_bienvenida THEN RAISE EXCEPTION 'El total no coincide con P(x) = B·x·C − D(p).'; END IF;

  -- aforo: sin sobreventa
  v_activos := inscritos_evento(p_evento);
  IF v_activos + p_cantidad > v_ev.capacidad_total THEN
    IF v_ev.capacidad_total - v_activos <= 0 THEN RAISE EXCEPTION 'Este evento se quedó sin cupos.'; END IF;
    RAISE EXCEPTION 'Solo quedan % cupos para este evento.', v_ev.capacidad_total - v_activos;
  END IF;

  -- puntos y oferta de bienvenida
  IF p_puntos_usados > v_puntos THEN RAISE EXCEPTION 'No tienes suficientes puntos de fidelización.'; END IF;
  IF p_desc_bienvenida > 0 AND NOT es_cliente_nuevo(p_cliente) THEN
    RAISE EXCEPTION 'La oferta de nuevo ingreso ya no está disponible para esta cuenta.';
  END IF;

  INSERT INTO reserva (valor_total, numero_entradas, id_cliente, codigo_evento, id_estado_reserva)
  VALUES (p_total, p_cantidad, p_cliente, p_evento, id_estado_reserva_de('Confirmada'))
  RETURNING id_reserva INTO v_id;

  INSERT INTO reserva_pago (id_reserva, zona, coeficiente, precio_unitario, subtotal, puntos_usados,
                            descuento_fidelizacion, descuento_bienvenida, puntos_ganados, metodo, marca, ultimos4)
  VALUES (v_id, p_zona, v_coef, p_precio_unitario, p_subtotal, p_puntos_usados,
          p_desc_fidelizacion, p_desc_bienvenida, p_puntos_ganados, p_metodo, p_marca, p_ultimos4)
  RETURNING codigo_pago INTO v_codigo;

  UPDATE cliente SET cantidad_puntos = cantidad_puntos - p_puntos_usados + p_puntos_ganados WHERE numero_identificacion = p_cliente;

  RETURN QUERY SELECT v_id, v_codigo, p_puntos_ganados, (SELECT cantidad_puntos FROM cliente WHERE numero_identificacion = p_cliente);
END $$;

-- 5.6  Anular una reserva (uso interno): la marca Cancelada con su causa, marca el pago como reembolsado
--      y revierte los puntos (devuelve los canjeados y retira los ganados).
CREATE OR REPLACE FUNCTION anular_reserva_interna(p_reserva INTEGER, p_causa TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_r reserva%ROWTYPE; v_p reserva_pago%ROWTYPE; v_saldo INTEGER; v_quitar INTEGER;
BEGIN
  SELECT * INTO v_r FROM reserva WHERE id_reserva = p_reserva FOR UPDATE;
  UPDATE reserva SET id_estado_reserva = id_estado_reserva_de('Cancelada'), causa_cancelacion = btrim(p_causa) WHERE id_reserva = p_reserva;
  SELECT * INTO v_p FROM reserva_pago WHERE id_reserva = p_reserva FOR UPDATE;
  IF FOUND THEN
    UPDATE reserva_pago SET reembolsado = TRUE WHERE id_reserva = p_reserva;
    SELECT cantidad_puntos INTO v_saldo FROM cliente WHERE numero_identificacion = v_r.id_cliente FOR UPDATE;
    v_quitar := LEAST(v_p.puntos_ganados, v_saldo + v_p.puntos_usados);
    UPDATE cliente SET cantidad_puntos = cantidad_puntos + v_p.puntos_usados - GREATEST(v_quitar, 0)
     WHERE numero_identificacion = v_r.id_cliente;
  END IF;
END $$;

-- 5.7  Cancelar UNA reserva (la hace su dueño, el Agente del evento o un Administrador). La causa es obligatoria.
CREATE OR REPLACE FUNCTION cancelar_reserva(p_reserva INTEGER, p_actor VARCHAR, p_causa TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_r reserva%ROWTYPE; v_ev evento%ROWTYPE; v_estado TEXT;
BEGIN
  IF p_causa IS NULL OR length(btrim(p_causa)) < 3 THEN RAISE EXCEPTION 'Para cancelar una reserva debes indicar la causa de la cancelación.'; END IF;
  SELECT * INTO v_r FROM reserva WHERE id_reserva = p_reserva FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La reserva no existe.'; END IF;
  SELECT * INTO v_ev FROM evento WHERE codigo_evento = v_r.codigo_evento;
  IF p_actor <> v_r.id_cliente AND p_actor <> v_ev.id_agente
     AND NOT EXISTS (SELECT 1 FROM administrador WHERE numero_identificacion = p_actor) THEN
    RAISE EXCEPTION 'No tienes permiso para cancelar esta reserva.';
  END IF;
  SELECT nombre_estado INTO v_estado FROM estado_reserva WHERE id_estado_reserva = v_r.id_estado_reserva;
  IF v_estado = 'Cancelada' THEN RAISE EXCEPTION 'Esta reserva ya estaba cancelada.'; END IF;
  IF v_ev.fecha_hora_inicio <= (now() AT TIME ZONE 'America/Bogota') THEN
    RAISE EXCEPTION 'El evento ya comenzó: la reserva no se puede cancelar.';
  END IF;
  PERFORM anular_reserva_interna(p_reserva, p_causa);
END $$;

-- 5.8  Cancelar un EVENTO: queda en estado Cancelado con su causa y todas sus reservas activas se cancelan
--      (con reembolso y reversión de puntos). Lo hace el Agente dueño o un Administrador.
CREATE OR REPLACE FUNCTION cancelar_evento(p_codigo VARCHAR, p_actor VARCHAR, p_causa TEXT) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_ev evento%ROWTYPE; v_estado TEXT; v_n INTEGER := 0; v_r RECORD;
BEGIN
  IF p_causa IS NULL OR length(btrim(p_causa)) < 3 THEN RAISE EXCEPTION 'Para cancelar un evento debes indicar la causa de la cancelación.'; END IF;
  SELECT * INTO v_ev FROM evento WHERE codigo_evento = p_codigo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento no encontrado.'; END IF;
  IF p_actor <> v_ev.id_agente AND NOT EXISTS (SELECT 1 FROM administrador WHERE numero_identificacion = p_actor) THEN
    RAISE EXCEPTION 'No tienes permiso para cancelar este evento.';
  END IF;
  SELECT nombre_estado INTO v_estado FROM estado_evento WHERE id_estado_evento = v_ev.id_estado_evento;
  IF v_estado = 'Cancelado' THEN RAISE EXCEPTION 'Este evento ya estaba cancelado.'; END IF;
  IF v_estado = 'Finalizado' OR v_ev.fecha_hora_fin <= (now() AT TIME ZONE 'America/Bogota') THEN
    RAISE EXCEPTION 'Un evento que ya terminó no se puede cancelar.';
  END IF;

  PERFORM set_config('eventpro.carga_masiva', 'on', true);          -- pospone triggers: se recalcula una sola vez al final
  UPDATE evento SET id_estado_evento = id_estado_evento_de('Cancelado'), causa_cancelacion = btrim(p_causa) WHERE codigo_evento = p_codigo;
  FOR v_r IN
    SELECT r.id_reserva FROM reserva r JOIN estado_reserva er ON er.id_estado_reserva = r.id_estado_reserva
     WHERE r.codigo_evento = p_codigo AND er.nombre_estado <> 'Cancelada'
  LOOP
    PERFORM anular_reserva_interna(v_r.id_reserva, 'Evento cancelado: ' || btrim(p_causa));
    v_n := v_n + 1;
  END LOOP;
  PERFORM set_config('eventpro.carga_masiva', 'off', true);
  PERFORM recalcular_comision_agente(v_ev.id_agente);
  RETURN v_n;                                                       -- cuántas reservas se cancelaron
END $$;

-- 5.9  Pausar / cerrar / reabrir las inscripciones ('open' | 'paused' | 'closed')
CREATE OR REPLACE FUNCTION cambiar_disponibilidad_evento(p_codigo VARCHAR, p_disponibilidad TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_estado TEXT;
BEGIN
  SELECT s.nombre_estado INTO v_estado FROM evento e JOIN estado_evento s ON s.id_estado_evento = e.id_estado_evento
   WHERE e.codigo_evento = p_codigo FOR UPDATE OF e;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento no encontrado.'; END IF;
  IF v_estado IN ('Cancelado', 'Finalizado') THEN RAISE EXCEPTION 'Un evento cancelado o finalizado no puede cambiar su disponibilidad.'; END IF;
  IF p_disponibilidad = 'open' THEN
    UPDATE evento SET id_estado_evento = id_estado_evento_de('Disponible') WHERE codigo_evento = p_codigo;
    PERFORM refrescar_estado_evento(p_codigo);
  ELSIF p_disponibilidad = 'paused' THEN
    UPDATE evento SET id_estado_evento = id_estado_evento_de('Pausado') WHERE codigo_evento = p_codigo;
  ELSIF p_disponibilidad = 'closed' THEN
    UPDATE evento SET id_estado_evento = id_estado_evento_de('Cerrado') WHERE codigo_evento = p_codigo;
  ELSE
    RAISE EXCEPTION 'Disponibilidad inválida.';
  END IF;
END $$;

-- 5.10  Aplicar un ajuste del precio dinámico. Devuelve FALSE si otro proceso ya cambió el precio (no se pisa).
CREATE OR REPLACE FUNCTION aplicar_ajuste_precio(
  p_codigo VARCHAR, p_precio_anterior NUMERIC, p_precio_nuevo NUMERIC, p_motivo TEXT, p_tasa NUMERIC
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM evento WHERE codigo_evento = p_codigo FOR UPDATE;
  IF NOT FOUND OR precio_vigente(p_codigo) <> p_precio_anterior THEN RETURN FALSE; END IF;
  INSERT INTO ajuste_precio (codigo_evento, precio_anterior, precio_nuevo, motivo, tasa_demanda)
  VALUES (p_codigo, p_precio_anterior, p_precio_nuevo, p_motivo, p_tasa);
  RETURN TRUE;
END $$;

COMMIT;
