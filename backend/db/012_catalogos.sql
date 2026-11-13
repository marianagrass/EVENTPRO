-- ============================================================================
-- 012_catalogos.sql  —  Filas obligatorias de los catálogos (la app NO funciona sin ellas)
--
-- Requisito: 010 y 011 ya ejecutados.  Seguro de correr varias veces (ON CONFLICT DO NOTHING).
-- No contiene datos de prueba (esos están en 013_datos_demo.sql).
-- ============================================================================
BEGIN;

-- ---------- ESTADO_EVENTO ----------
-- Disponible / Últimos cupos / Agotado los mueve solo la base según el aforo (refrescar_estado_evento).
-- Pausado / Cerrado / Cancelado / Finalizado los decide una persona o el cierre del evento.
INSERT INTO estado_evento (nombre_estado) VALUES
  ('Disponible'), ('Últimos cupos'), ('Agotado'), ('Pausado'), ('Cerrado'), ('Cancelado'), ('Finalizado')
ON CONFLICT (nombre_estado) DO NOTHING;

-- ---------- ESTADO_RESERVA ----------
INSERT INTO estado_reserva (nombre_estado) VALUES
  ('Confirmada'), ('Pendiente'), ('Cancelada')
ON CONFLICT (nombre_estado) DO NOTHING;

-- ---------- Geografía base: Colombia ----------
INSERT INTO pais (nombre_pais) VALUES ('Colombia') ON CONFLICT (nombre_pais) DO NOTHING;

INSERT INTO departamento (nombre_departamento, id_pais)
SELECT d, (SELECT id_pais FROM pais WHERE nombre_pais = 'Colombia')
  FROM unnest(ARRAY['Valle del Cauca', 'Antioquia', 'Bogotá D.C.', 'Atlántico', 'Bolívar', 'Santander', 'Risaralda',
                    'Caldas', 'Quindío', 'Cauca', 'Nariño', 'Tolima', 'Huila', 'Norte de Santander', 'Boyacá', 'Meta']) AS d
ON CONFLICT (id_pais, nombre_departamento) DO NOTHING;

INSERT INTO ciudad (nombre_ciudad, id_departamento)
SELECT v.ciudad, dep.id_departamento
  FROM (VALUES
    ('Tuluá', 'Valle del Cauca'), ('Cali', 'Valle del Cauca'), ('Palmira', 'Valle del Cauca'), ('Buga', 'Valle del Cauca'),
    ('Cartago', 'Valle del Cauca'), ('Buenaventura', 'Valle del Cauca'), ('Jamundí', 'Valle del Cauca'), ('Yumbo', 'Valle del Cauca'),
    ('Sevilla', 'Valle del Cauca'), ('Andalucía', 'Valle del Cauca'), ('Bugalagrande', 'Valle del Cauca'), ('Zarzal', 'Valle del Cauca'),
    ('Medellín', 'Antioquia'), ('Envigado', 'Antioquia'), ('Bello', 'Antioquia'),
    ('Bogotá', 'Bogotá D.C.'),
    ('Barranquilla', 'Atlántico'), ('Soledad', 'Atlántico'),
    ('Cartagena', 'Bolívar'),
    ('Bucaramanga', 'Santander'), ('Floridablanca', 'Santander'),
    ('Pereira', 'Risaralda'), ('Dosquebradas', 'Risaralda'),
    ('Manizales', 'Caldas'),
    ('Armenia', 'Quindío'),
    ('Popayán', 'Cauca'),
    ('Pasto', 'Nariño'),
    ('Ibagué', 'Tolima'),
    ('Neiva', 'Huila'),
    ('Cúcuta', 'Norte de Santander'),
    ('Tunja', 'Boyacá'),
    ('Villavicencio', 'Meta')
  ) AS v (ciudad, departamento)
  JOIN departamento dep ON dep.nombre_departamento = v.departamento
  JOIN pais p ON p.id_pais = dep.id_pais AND p.nombre_pais = 'Colombia'
ON CONFLICT (id_departamento, nombre_ciudad) DO NOTHING;

COMMIT;
