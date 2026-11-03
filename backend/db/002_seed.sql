-- ============================================================================
-- 002_seed.sql  —  Datos de PRUEBA de EventPro (equivalen al mockData de js/data.js)
--
-- ⚠ Solo para desarrollo / demo. Contiene contraseñas de ejemplo y asistentes ficticios.
-- Ejecutar UNA vez, DESPUÉS de 001_schema.sql.  Para repetir: correr 000_reset.sql y 001 de nuevo.
-- Las fechas son relativas a HOY (CURRENT_DATE + n), igual que en la app.
--
-- Cuentas de ejemplo (contraseña de TODAS: 123456 — las mismas del modo mock del frontend):
--   Administrador : admin@eventpro.com
--   Agente        : agente@eventpro.com
--   Usuario       : user@eventpro.com
-- ⚠ Una contraseña de 6 dígitos es SOLO para desarrollo. En producción borra estas cuentas.
-- ============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- solo para generar los hashes de prueba (crypt / gen_salt)

-- ---------- catálogos ----------
INSERT INTO categories (code, label, sort_order) VALUES
  ('fiestas', 'Fiestas', 1), ('cultura', 'Cultura', 2), ('deportes', 'Deportes', 3),
  ('academico', 'Académico', 4), ('comunidad', 'Comunidad UCEVA', 5);

INSERT INTO event_types (code, label, color, default_category) VALUES
  ('fiesta',        'Fiesta',        '#b01fc4', 'fiestas'),
  ('musica',        'Concierto',     '#0e7490', 'fiestas'),
  ('cultural',      'Cultural',      '#d61f69', 'cultura'),
  ('deportivo',     'Deportivo',     '#cc4100', 'deportes'),
  ('academico',     'Académico',     '#6a2cff', 'academico'),
  ('investigacion', 'Investigación', '#087f70', 'academico'),
  ('institucional', 'Institucional', '#2563eb', 'comunidad');

-- ---------- cuentas (58) ----------
DO $$
DECLARE v_hash TEXT := crypt('123456', gen_salt('bf', 8));   -- se calcula una sola vez
BEGIN
  INSERT INTO users (id, name, email, password_hash, role, status, phone, city, institution, created_at, last_login_at) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Sofía Navarro', 'admin@eventpro.com', v_hash, 'admin', 'activo', '+57 311 234 5678', 'Cali', NULL, '2026-03-01', '2026-10-12'),
  ('a0000000-0000-4000-8000-000000000002', 'Camila Vargas', 'camila.vargas@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-03-01', '2026-10-01'),
  ('a0000000-0000-4000-8000-000000000003', 'Mateo Martínez', 'mateo.martinez@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-03-06', '2026-10-04'),
  ('a0000000-0000-4000-8000-000000000004', 'Elena Londoño', 'elena.londono@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-03-11', '2026-10-07'),
  ('a0000000-0000-4000-8000-000000000005', 'Esteban Jiménez', 'esteban.jimenez@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-04-16', '2026-10-10'),
  ('a0000000-0000-4000-8000-000000000006', 'Daniela Ardila', 'daniela.ardila@correo.co', v_hash, 'user', 'suspendido', NULL, NULL, NULL, '2026-04-21', '2026-10-02'),
  ('a0000000-0000-4000-8000-000000000007', 'Andrés Gómez', 'andres.gomez@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-04-26', '2026-10-05'),
  ('a0000000-0000-4000-8000-000000000008', 'Ana Torres', 'ana.torres@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-04-05', '2026-10-08'),
  ('a0000000-0000-4000-8000-000000000009', 'Tomás Cruz', 'tomas.cruz@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-05-10', '2026-10-11'),
  ('a0000000-0000-4000-8000-00000000000a', 'Natalia Pérez', 'natalia.perez@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-05-15', '2026-10-03'),
  ('a0000000-0000-4000-8000-00000000000b', 'David Ríos', 'david.rios@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-05-20', '2026-10-06'),
  ('a0000000-0000-4000-8000-00000000000c', 'Paula Molina', 'paula.molina@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-05-25', '2026-10-09'),
  ('a0000000-0000-4000-8000-00000000000d', 'Santiago Rincón', 'santiago.rincon@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-05-04', '2026-10-01'),
  ('a0000000-0000-4000-8000-00000000000e', 'Valeria Castro', 'valeria.castro@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-06-09', '2026-10-04'),
  ('a0000000-0000-4000-8000-00000000000f', 'Carlos Flores', 'carlos.flores@correo.co', v_hash, 'user', 'suspendido', NULL, NULL, NULL, '2026-06-14', '2026-10-07'),
  ('a0000000-0000-4000-8000-000000000010', 'Juliana Rojas', 'juliana.rojas@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-06-19', '2026-10-10'),
  ('a0000000-0000-4000-8000-000000000011', 'Sebastián González', 'sebastian.gonzalez@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-06-24', '2026-10-02'),
  ('a0000000-0000-4000-8000-000000000012', 'Sara Salazar', 'sara.salazar@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-06-03', '2026-10-05'),
  ('a0000000-0000-4000-8000-000000000013', 'Miguel Quintero', 'miguel.quintero@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-06-08', '2026-10-08'),
  ('a0000000-0000-4000-8000-000000000014', 'Manuela Díaz', 'manuela.diaz@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-07-13', '2026-10-11'),
  ('a0000000-0000-4000-8000-000000000015', 'Felipe Peña', 'felipe.pena@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-07-18', '2026-10-03'),
  ('a0000000-0000-4000-8000-000000000016', 'Laura Romero', 'laura.romero@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-07-23', '2026-10-06'),
  ('a0000000-0000-4000-8000-000000000017', 'Javier Ortiz', 'javier.ortiz@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-07-02', '2026-10-09'),
  ('a0000000-0000-4000-8000-000000000018', 'Isabela Sánchez', 'isabela.sanchez@correo.co', v_hash, 'user', 'suspendido', NULL, NULL, NULL, '2026-07-07', '2026-10-01'),
  ('a0000000-0000-4000-8000-000000000019', 'Julián Mena', 'julian.mena@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-07-12', '2026-10-04'),
  ('a0000000-0000-4000-8000-00000000001a', 'María Herrera', 'maria.herrera@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-07-17', '2026-10-07'),
  ('a0000000-0000-4000-8000-00000000001b', 'Nicolás Moreno', 'nicolas.moreno@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-07-22', '2026-10-10'),
  ('a0000000-0000-4000-8000-00000000001c', 'Camila Peña', 'camila.pena@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-08-01', '2026-10-02'),
  ('a0000000-0000-4000-8000-00000000001d', 'Mateo Romero', 'mateo.romero@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-08-06', '2026-10-05'),
  ('a0000000-0000-4000-8000-00000000001e', 'Elena Ortiz', 'elena.ortiz@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-08-11', '2026-10-08'),
  ('a0000000-0000-4000-8000-00000000001f', 'Esteban Sánchez', 'esteban.sanchez@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-08-16', '2026-10-11'),
  ('a0000000-0000-4000-8000-000000000020', 'Daniela Mena', 'daniela.mena@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-08-21', '2026-10-03'),
  ('a0000000-0000-4000-8000-000000000021', 'Andrés Herrera', 'andres.herrera@correo.co', v_hash, 'user', 'suspendido', NULL, NULL, NULL, '2026-08-26', '2026-10-06'),
  ('a0000000-0000-4000-8000-000000000022', 'Ana Moreno', 'ana.moreno@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-08-05', '2026-10-09'),
  ('a0000000-0000-4000-8000-000000000023', 'Tomás Vargas', 'tomas.vargas@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-08-10', '2026-10-01'),
  ('a0000000-0000-4000-8000-000000000024', 'Natalia Martínez', 'natalia.martinez@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-08-15', '2026-10-04'),
  ('a0000000-0000-4000-8000-000000000025', 'David Londoño', 'david.londono@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-09-20', '2026-10-07'),
  ('a0000000-0000-4000-8000-000000000026', 'Paula Jiménez', 'paula.jimenez@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-09-25', '2026-10-10'),
  ('a0000000-0000-4000-8000-000000000027', 'Santiago Ardila', 'santiago.ardila@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-09-04', '2026-10-02'),
  ('a0000000-0000-4000-8000-000000000028', 'Valeria Gómez', 'valeria.gomez@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-09-09', '2026-10-05'),
  ('a0000000-0000-4000-8000-000000000029', 'Carlos Torres', 'carlos.torres@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-09-14', '2026-10-08'),
  ('a0000000-0000-4000-8000-00000000002a', 'Juliana Cruz', 'juliana.cruz@correo.co', v_hash, 'user', 'suspendido', NULL, NULL, NULL, '2026-09-19', '2026-10-11'),
  ('a0000000-0000-4000-8000-00000000002b', 'Sebastián Pérez', 'sebastian.perez@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-09-24', '2026-10-03'),
  ('a0000000-0000-4000-8000-00000000002c', 'Sara Ríos', 'sara.rios@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-09-03', '2026-10-06'),
  ('a0000000-0000-4000-8000-00000000002d', 'Miguel Molina', 'miguel.molina@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-09-08', '2026-10-09'),
  ('a0000000-0000-4000-8000-00000000002e', 'Manuela Rincón', 'manuela.rincon@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-09-13', '2026-10-01'),
  ('a0000000-0000-4000-8000-00000000002f', 'Felipe Castro', 'felipe.castro@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-09-18', '2026-10-04'),
  ('a0000000-0000-4000-8000-000000000030', 'Laura Flores', 'laura.flores@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-10-23', '2026-10-07'),
  ('a0000000-0000-4000-8000-000000000031', 'Javier Rojas', 'javier.rojas@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-10-02', '2026-10-10'),
  ('a0000000-0000-4000-8000-000000000032', 'Isabela González', 'isabela.gonzalez@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-10-07', '2026-10-02'),
  ('a0000000-0000-4000-8000-000000000033', 'Julián Salazar', 'julian.salazar@correo.co', v_hash, 'user', 'suspendido', NULL, NULL, NULL, '2026-10-12', '2026-10-05'),
  ('a0000000-0000-4000-8000-000000000034', 'María Quintero', 'maria.quintero@correo.co', v_hash, 'user', 'activo', NULL, NULL, NULL, '2026-10-17', '2026-10-08'),
  ('a0000000-0000-4000-8000-000000000035', 'Carmen López', 'agente@eventpro.com', v_hash, 'agent', 'activo', NULL, NULL, NULL, '2026-03-02', '2026-10-11'),
  ('a0000000-0000-4000-8000-000000000036', 'Isabela Ruiz', 'isabela.ruiz@eventpro.co', v_hash, 'agent', 'activo', NULL, NULL, NULL, '2026-03-18', '2026-10-11'),
  ('a0000000-0000-4000-8000-000000000037', 'Rodrigo Fuentes', 'rodrigo.fuentes@eventpro.co', v_hash, 'agent', 'activo', NULL, NULL, NULL, '2026-04-10', '2026-10-11'),
  ('a0000000-0000-4000-8000-000000000038', 'Valentina Serra', 'valentina.serra@eventpro.co', v_hash, 'agent', 'activo', NULL, NULL, NULL, '2026-06-05', '2026-10-11'),
  ('a0000000-0000-4000-8000-000000000039', 'Sofía Mora', 'sofia.mora@eventpro.co', v_hash, 'agent', 'suspendido', NULL, NULL, NULL, '2026-08-21', '2026-10-11'),
  ('a0000000-0000-4000-8000-00000000003a', 'Carlos Mejía', 'user@eventpro.com', v_hash, 'user', 'activo', '315 678 9012', 'Tuluá', 'UCEVA', '2026-09-02', '2026-10-12');
END $$;

-- ---------- eventos (10) ----------
-- (el trigger events_default_category agrega solo la categoría principal de cada tipo)
INSERT INTO events (id, name, type_code, event_date, start_time, location, description, image_url, capacity, price_cop, status, availability, is_public, is_featured, coordinator, created_by) VALUES
  ('e0000000-0000-4000-8000-000000000001', 'Color Fest Universitario 2026', 'fiesta', CURRENT_DATE + 12, '14:00', 'Canchas del Campus, Tuluá', 'La fiesta de polvos de colores del año: música en vivo, DJs y una zona de experiencias en las canchas del campus.', 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&q=80', 2000, 35000, 'planificado', 'open', true, true, 'Carmen López', 'a0000000-0000-4000-8000-000000000035'),
  ('e0000000-0000-4000-8000-000000000002', 'Guerra de Bandas Universitarias: Rock & Indie Night', 'musica', CURRENT_DATE + 18, '19:00', 'Auditorio al Aire Libre, Tuluá', 'Concierto en vivo con las mejores bandas estudiantiles compitiendo por el título de la noche.', 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&q=80', 800, 25000, 'planificado', 'open', true, true, 'Carmen López', 'a0000000-0000-4000-8000-000000000035'),
  ('e0000000-0000-4000-8000-000000000003', 'Welcome Party: Fiesta de Integración & Primíparos', 'fiesta', CURRENT_DATE + 26, '21:00', 'Coliseo Cubierto, Tuluá', 'Noche de música urbana, electrónica y luces neón para darles la bienvenida a los primíparos.', 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80', 1200, 30000, 'planificado', 'open', true, false, 'Isabela Ruiz', 'a0000000-0000-4000-8000-000000000035'),
  ('e0000000-0000-4000-8000-000000000004', 'Sunset Campus: Festival de Food Trucks, Birras & Acústicos', 'fiesta', CURRENT_DATE + 33, '16:00', 'Plazoleta Central, Tuluá', 'Tarde de integración al aire libre con food trucks, cerveza artesanal y música acústica. Entrada libre.', 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&q=80', 1500, 0, 'planificado', 'open', true, false, 'Rodrigo Fuentes', 'a0000000-0000-4000-8000-000000000035'),
  ('e0000000-0000-4000-8000-000000000005', 'ElectroFest Fin de Semestre', 'fiesta', CURRENT_DATE + 54, '22:00', 'Canchas del Campus, Tuluá', 'Cierre de semestre con DJs invitados, pantallas LED y un show de luces que no vas a olvidar.', 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80', 2500, 60000, 'planificado', 'open', true, true, 'Carmen López', 'a0000000-0000-4000-8000-000000000035'),
  ('e0000000-0000-4000-8000-000000000006', 'Torneo Interfacultades de Fútbol', 'deportivo', CURRENT_DATE + 5, '07:00', 'Estadio Universitario, Tuluá', 'Torneo deportivo entre facultades con categorías masculina y femenina.', 'https://images.unsplash.com/photo-1662065931743-346f5058fe58?w=600&q=80', 300, 0, 'planificado', 'open', true, false, 'Valentina Serra', 'a0000000-0000-4000-8000-000000000035'),
  ('e0000000-0000-4000-8000-000000000007', 'Cumbre de Innovación Académica 2026', 'academico', CURRENT_DATE + 38, '09:00', 'Auditorio Central, Tuluá', 'Conferencias, talleres y networking para estudiantes y docentes de educación superior.', 'https://images.unsplash.com/photo-1670382417551-d2f1ee29aea4?w=600&q=80', 500, 0, 'planificado', 'open', true, false, 'Sofía Navarro', 'a0000000-0000-4000-8000-000000000035'),
  ('e0000000-0000-4000-8000-000000000008', 'Exposición de Arte Contemporáneo', 'cultural', CURRENT_DATE + 45, '16:00', 'Sala de Exposiciones, Tuluá', 'Muestra de artistas emergentes universitarios en arte contemporáneo.', 'https://images.unsplash.com/photo-1744948162834-45a60a6c0139?w=600&q=80', 400, 0, 'planificado', 'open', true, false, 'Rodrigo Fuentes', 'a0000000-0000-4000-8000-000000000035'),
  ('e0000000-0000-4000-8000-000000000009', 'Noche de Talentos Universitaria', 'cultural', CURRENT_DATE - 39, '19:00', 'Auditorio Central, Tuluá', 'Show de talentos con música, baile y stand up de estudiantes.', 'https://images.unsplash.com/photo-1719241368157-7c78535f3a92?w=600&q=80', 400, 15000, 'completado', 'closed', true, false, 'Rodrigo Fuentes', 'a0000000-0000-4000-8000-000000000035'),
  ('e0000000-0000-4000-8000-00000000000a', 'Rumba Retro Campus', 'fiesta', CURRENT_DATE - 25, '21:00', 'Coliseo Cubierto, Tuluá', 'Una noche de clásicos de los 80, 90 y 2000 para toda la comunidad.', 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80', 1000, 20000, 'completado', 'closed', true, false, 'Isabela Ruiz', 'a0000000-0000-4000-8000-000000000035');

-- categorías adicionales (un evento puede estar en varias)
INSERT INTO event_categories (event_id, category_code) VALUES
  ('e0000000-0000-4000-8000-000000000001', 'fiestas'),
  ('e0000000-0000-4000-8000-000000000002', 'fiestas'),
  ('e0000000-0000-4000-8000-000000000002', 'cultura'),
  ('e0000000-0000-4000-8000-000000000003', 'fiestas'),
  ('e0000000-0000-4000-8000-000000000004', 'fiestas'),
  ('e0000000-0000-4000-8000-000000000004', 'comunidad'),
  ('e0000000-0000-4000-8000-000000000005', 'fiestas'),
  ('e0000000-0000-4000-8000-000000000009', 'cultura'),
  ('e0000000-0000-4000-8000-000000000009', 'fiestas'),
  ('e0000000-0000-4000-8000-00000000000a', 'fiestas')
ON CONFLICT DO NOTHING;

-- ---------- asistentes con nombre (59) ----------
INSERT INTO attendees (event_id, user_id, name, email, phone, status, price_paid_cop, registered_at) VALUES
  ('e0000000-0000-4000-8000-000000000001', NULL, 'Camila Ortiz', 'camila.ortiz@correo.co', '310 200 1000', 'confirmado', 35000, now() - interval '3 days'),
  ('e0000000-0000-4000-8000-000000000001', NULL, 'Felipe Vargas', 'felipe.vargas@correo.co', '310 213 1001', 'confirmado', 35000, now() - interval '5 days'),
  ('e0000000-0000-4000-8000-000000000001', NULL, 'Valeria Gómez', 'valeria.gomez@correo.co', '310 226 1002', 'confirmado', 35000, now() - interval '7 days'),
  ('e0000000-0000-4000-8000-000000000001', NULL, 'Andrés Molina', 'andres.molina@correo.co', '310 239 1003', 'pendiente', 35000, now() - interval '9 days'),
  ('e0000000-0000-4000-8000-000000000001', NULL, 'María González', 'maria.gonzalez@correo.co', '310 252 1004', 'confirmado', 35000, now() - interval '11 days'),
  ('e0000000-0000-4000-8000-000000000001', NULL, 'Miguel Romero', 'miguel.romero@correo.co', '310 265 1005', 'cancelado', 35000, now() - interval '13 days'),
  ('e0000000-0000-4000-8000-000000000002', NULL, 'Julián Castro', 'julian.castro@correo.co', '311 200 1037', 'confirmado', 25000, now() - interval '6 days'),
  ('e0000000-0000-4000-8000-000000000002', NULL, 'Sara Quintero', 'sara.quintero@correo.co', '311 213 1038', 'confirmado', 25000, now() - interval '8 days'),
  ('e0000000-0000-4000-8000-000000000002', NULL, 'David Sánchez', 'david.sanchez@correo.co', '311 226 1039', 'pendiente', 25000, now() - interval '10 days'),
  ('e0000000-0000-4000-8000-000000000002', NULL, 'Elena Martínez', 'elena.martinez@correo.co', '311 239 1040', 'confirmado', 25000, now() - interval '12 days'),
  ('e0000000-0000-4000-8000-000000000002', NULL, 'Javier Torres', 'javier.torres@correo.co', '311 252 1041', 'cancelado', 25000, now() - interval '14 days'),
  ('e0000000-0000-4000-8000-000000000002', NULL, 'Paula Rincón', 'paula.rincon@correo.co', '311 265 1042', 'confirmado', 25000, now() - interval '16 days'),
  ('e0000000-0000-4000-8000-000000000003', NULL, 'Laura Jiménez', 'laura.jimenez@correo.co', '312 200 1074', 'confirmado', 30000, now() - interval '9 days'),
  ('e0000000-0000-4000-8000-000000000003', NULL, 'Carlos Pérez', 'carlos.perez@correo.co', '312 213 1075', 'pendiente', 30000, now() - interval '11 days'),
  ('e0000000-0000-4000-8000-000000000003', NULL, 'Ana Flores', 'ana.flores@correo.co', '312 226 1076', 'confirmado', 30000, now() - interval '13 days'),
  ('e0000000-0000-4000-8000-000000000003', NULL, 'Roberto Díaz', 'roberto.diaz@correo.co', '312 239 1077', 'cancelado', 30000, now() - interval '15 days'),
  ('e0000000-0000-4000-8000-000000000003', NULL, 'Juliana Mena', 'juliana.mena@correo.co', '312 252 1078', 'confirmado', 30000, now() - interval '17 days'),
  ('e0000000-0000-4000-8000-000000000003', NULL, 'Sebastián Rojas', 'sebastian.rojas@correo.co', '312 265 1079', 'confirmado', 30000, now() - interval '19 days'),
  ('e0000000-0000-4000-8000-000000000004', NULL, 'Miguel Romero', 'miguel.romero@correo.co', '313 200 1111', 'pendiente', 0, now() - interval '12 days'),
  ('e0000000-0000-4000-8000-000000000004', NULL, 'Patricia Moreno', 'patricia.moreno@correo.co', '313 213 1112', 'confirmado', 0, now() - interval '14 days'),
  ('e0000000-0000-4000-8000-000000000004', NULL, 'Nicolás Ardila', 'nicolas.ardila@correo.co', '313 226 1113', 'cancelado', 0, now() - interval '16 days'),
  ('e0000000-0000-4000-8000-000000000004', NULL, 'Camila Ortiz', 'camila.ortiz@correo.co', '313 239 1114', 'confirmado', 0, now() - interval '18 days'),
  ('e0000000-0000-4000-8000-000000000004', NULL, 'Felipe Vargas', 'felipe.vargas@correo.co', '313 252 1115', 'confirmado', 0, now() - interval '20 days'),
  ('e0000000-0000-4000-8000-000000000004', NULL, 'Valeria Gómez', 'valeria.gomez@correo.co', '313 265 1116', 'confirmado', 0, now() - interval '22 days'),
  ('e0000000-0000-4000-8000-000000000005', NULL, 'Paula Rincón', 'paula.rincon@correo.co', '314 200 1148', 'confirmado', 60000, now() - interval '15 days'),
  ('e0000000-0000-4000-8000-000000000005', NULL, 'Esteban Salazar', 'esteban.salazar@correo.co', '314 213 1149', 'cancelado', 60000, now() - interval '17 days'),
  ('e0000000-0000-4000-8000-000000000005', NULL, 'Daniela Cruz', 'daniela.cruz@correo.co', '314 226 1150', 'confirmado', 60000, now() - interval '19 days'),
  ('e0000000-0000-4000-8000-000000000005', NULL, 'Julián Castro', 'julian.castro@correo.co', '314 239 1151', 'confirmado', 60000, now() - interval '21 days'),
  ('e0000000-0000-4000-8000-000000000005', NULL, 'Sara Quintero', 'sara.quintero@correo.co', '314 252 1152', 'confirmado', 60000, now() - interval '23 days'),
  ('e0000000-0000-4000-8000-000000000005', NULL, 'David Sánchez', 'david.sanchez@correo.co', '314 265 1153', 'pendiente', 60000, now() - interval '3 days'),
  ('e0000000-0000-4000-8000-000000000006', NULL, 'Sebastián Rojas', 'sebastian.rojas@correo.co', '315 200 1185', 'cancelado', 0, now() - interval '18 days'),
  ('e0000000-0000-4000-8000-000000000006', NULL, 'Natalia Peña', 'natalia.pena@correo.co', '315 213 1186', 'confirmado', 0, now() - interval '20 days'),
  ('e0000000-0000-4000-8000-000000000006', NULL, 'Mateo Herrera', 'mateo.herrera@correo.co', '315 226 1187', 'confirmado', 0, now() - interval '22 days'),
  ('e0000000-0000-4000-8000-000000000006', NULL, 'Laura Jiménez', 'laura.jimenez@correo.co', '315 239 1188', 'confirmado', 0, now() - interval '24 days'),
  ('e0000000-0000-4000-8000-000000000006', NULL, 'Carlos Pérez', 'carlos.perez@correo.co', '315 252 1189', 'pendiente', 0, now() - interval '4 days'),
  ('e0000000-0000-4000-8000-000000000006', NULL, 'Ana Flores', 'ana.flores@correo.co', '315 265 1190', 'confirmado', 0, now() - interval '6 days'),
  ('e0000000-0000-4000-8000-000000000007', NULL, 'Valeria Gómez', 'valeria.gomez@correo.co', '316 200 1222', 'confirmado', 0, now() - interval '21 days'),
  ('e0000000-0000-4000-8000-000000000007', NULL, 'Andrés Molina', 'andres.molina@correo.co', '316 213 1223', 'confirmado', 0, now() - interval '23 days'),
  ('e0000000-0000-4000-8000-000000000007', NULL, 'María González', 'maria.gonzalez@correo.co', '316 226 1224', 'confirmado', 0, now() - interval '3 days'),
  ('e0000000-0000-4000-8000-000000000007', NULL, 'Miguel Romero', 'miguel.romero@correo.co', '316 239 1225', 'pendiente', 0, now() - interval '5 days'),
  ('e0000000-0000-4000-8000-000000000007', NULL, 'Patricia Moreno', 'patricia.moreno@correo.co', '316 252 1226', 'confirmado', 0, now() - interval '7 days'),
  ('e0000000-0000-4000-8000-000000000007', NULL, 'Nicolás Ardila', 'nicolas.ardila@correo.co', '316 265 1227', 'cancelado', 0, now() - interval '9 days'),
  ('e0000000-0000-4000-8000-000000000008', NULL, 'David Sánchez', 'david.sanchez@correo.co', '317 200 1259', 'confirmado', 0, now() - interval '24 days'),
  ('e0000000-0000-4000-8000-000000000008', NULL, 'Elena Martínez', 'elena.martinez@correo.co', '317 213 1260', 'confirmado', 0, now() - interval '4 days'),
  ('e0000000-0000-4000-8000-000000000008', NULL, 'Javier Torres', 'javier.torres@correo.co', '317 226 1261', 'pendiente', 0, now() - interval '6 days'),
  ('e0000000-0000-4000-8000-000000000008', NULL, 'Paula Rincón', 'paula.rincon@correo.co', '317 239 1262', 'confirmado', 0, now() - interval '8 days'),
  ('e0000000-0000-4000-8000-000000000008', NULL, 'Esteban Salazar', 'esteban.salazar@correo.co', '317 252 1263', 'cancelado', 0, now() - interval '10 days'),
  ('e0000000-0000-4000-8000-000000000008', NULL, 'Daniela Cruz', 'daniela.cruz@correo.co', '317 265 1264', 'confirmado', 0, now() - interval '12 days'),
  ('e0000000-0000-4000-8000-000000000009', NULL, 'Ana Flores', 'ana.flores@correo.co', '318 200 1296', 'confirmado', 15000, now() - interval '5 days'),
  ('e0000000-0000-4000-8000-000000000009', NULL, 'Roberto Díaz', 'roberto.diaz@correo.co', '318 213 1297', 'confirmado', 15000, now() - interval '7 days'),
  ('e0000000-0000-4000-8000-000000000009', NULL, 'Juliana Mena', 'juliana.mena@correo.co', '318 226 1298', 'confirmado', 15000, now() - interval '9 days'),
  ('e0000000-0000-4000-8000-000000000009', NULL, 'Sebastián Rojas', 'sebastian.rojas@correo.co', '318 239 1299', 'confirmado', 15000, now() - interval '11 days'),
  ('e0000000-0000-4000-8000-00000000000a', NULL, 'Nicolás Ardila', 'nicolas.ardila@correo.co', '319 200 1333', 'confirmado', 20000, now() - interval '8 days'),
  ('e0000000-0000-4000-8000-00000000000a', NULL, 'Camila Ortiz', 'camila.ortiz@correo.co', '319 213 1334', 'confirmado', 20000, now() - interval '10 days'),
  ('e0000000-0000-4000-8000-00000000000a', NULL, 'Felipe Vargas', 'felipe.vargas@correo.co', '319 226 1335', 'confirmado', 20000, now() - interval '12 days'),
  ('e0000000-0000-4000-8000-00000000000a', NULL, 'Valeria Gómez', 'valeria.gomez@correo.co', '319 239 1336', 'confirmado', 20000, now() - interval '14 days'),
  ('e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-00000000003a', 'Carlos Mejía', 'user@eventpro.com', '315 678 9012', 'confirmado', 25000, now() - interval '20 days'),
  ('e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-00000000003a', 'Carlos Mejía', 'user@eventpro.com', '315 678 9012', 'confirmado', 0, now() - interval '20 days'),
  ('e0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-00000000003a', 'Carlos Mejía', 'user@eventpro.com', '315 678 9012', 'confirmado', 15000, now() - interval '20 days');

-- ---------- resto de inscritos (ficticios) hasta igualar los números de la app ----------
INSERT INTO attendees (event_id, name, status, price_paid_cop, registered_at)
SELECT 'e0000000-0000-4000-8000-000000000001', 'Asistente de prueba ' || g, 'confirmado', 35000, now() - make_interval(days => (random() * 20)::int)
  FROM generate_series(1, 1445) AS g;   -- Color Fest Universitario 2026
INSERT INTO attendees (event_id, name, status, price_paid_cop, registered_at)
SELECT 'e0000000-0000-4000-8000-000000000002', 'Asistente de prueba ' || g, 'confirmado', 25000, now() - make_interval(days => (random() * 20)::int)
  FROM generate_series(1, 606) AS g;   -- Guerra de Bandas Universitarias: Rock & Indie Night
INSERT INTO attendees (event_id, name, status, price_paid_cop, registered_at)
SELECT 'e0000000-0000-4000-8000-000000000003', 'Asistente de prueba ' || g, 'confirmado', 30000, now() - make_interval(days => (random() * 20)::int)
  FROM generate_series(1, 975) AS g;   -- Welcome Party: Fiesta de Integración & Primíparos
INSERT INTO attendees (event_id, name, status, price_paid_cop, registered_at)
SELECT 'e0000000-0000-4000-8000-000000000004', 'Asistente de prueba ' || g, 'confirmado', 0, now() - make_interval(days => (random() * 20)::int)
  FROM generate_series(1, 735) AS g;   -- Sunset Campus: Festival de Food Trucks, Birras & Acústicos
INSERT INTO attendees (event_id, name, status, price_paid_cop, registered_at)
SELECT 'e0000000-0000-4000-8000-000000000005', 'Asistente de prueba ' || g, 'confirmado', 60000, now() - make_interval(days => (random() * 20)::int)
  FROM generate_series(1, 1825) AS g;   -- ElectroFest Fin de Semestre
INSERT INTO attendees (event_id, name, status, price_paid_cop, registered_at)
SELECT 'e0000000-0000-4000-8000-000000000006', 'Asistente de prueba ' || g, 'confirmado', 0, now() - make_interval(days => (random() * 20)::int)
  FROM generate_series(1, 204) AS g;   -- Torneo Interfacultades de Fútbol
INSERT INTO attendees (event_id, name, status, price_paid_cop, registered_at)
SELECT 'e0000000-0000-4000-8000-000000000007', 'Asistente de prueba ' || g, 'confirmado', 0, now() - make_interval(days => (random() * 20)::int)
  FROM generate_series(1, 337) AS g;   -- Cumbre de Innovación Académica 2026
INSERT INTO attendees (event_id, name, status, price_paid_cop, registered_at)
SELECT 'e0000000-0000-4000-8000-000000000008', 'Asistente de prueba ' || g, 'confirmado', 0, now() - make_interval(days => (random() * 20)::int)
  FROM generate_series(1, 182) AS g;   -- Exposición de Arte Contemporáneo
INSERT INTO attendees (event_id, name, status, price_paid_cop, registered_at)
SELECT 'e0000000-0000-4000-8000-000000000009', 'Asistente de prueba ' || g, 'confirmado', 15000, now() - make_interval(days => (random() * 20)::int)
  FROM generate_series(1, 375) AS g;   -- Noche de Talentos Universitaria
INSERT INTO attendees (event_id, name, status, price_paid_cop, registered_at)
SELECT 'e0000000-0000-4000-8000-00000000000a', 'Asistente de prueba ' || g, 'confirmado', 20000, now() - make_interval(days => (random() * 20)::int)
  FROM generate_series(1, 906) AS g;   -- Rumba Retro Campus

-- Eventos ya realizados: todos los confirmados asistieron
UPDATE attendees a SET checked_in_at = (e.event_date + e.start_time)
  FROM events e WHERE e.id = a.event_id AND e.status = 'completado' AND a.status = 'confirmado';

-- ---------- tareas (10) ----------
INSERT INTO tasks (title, event_id, assignee_id, category, due_date, priority, status) VALUES
  ('Contratar sonido y pantallas LED', 'e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000035', 'Producción', CURRENT_DATE + 40, 'alta', 'en_progreso'),
  ('Pedir permisos de polvos de colores', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000035', 'Permisos', CURRENT_DATE - 3, 'alta', 'completado'),
  ('Confirmar line-up de bandas', 'e0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000035', 'Programación', CURRENT_DATE + 8, 'alta', 'en_progreso'),
  ('Contratar seguridad y primeros auxilios', 'e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000036', 'Seguridad', CURRENT_DATE + 20, 'alta', 'pendiente'),
  ('Coordinar food trucks y proveedores', 'e0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000037', 'Logística', CURRENT_DATE + 25, 'media', 'pendiente'),
  ('Imprimir y distribuir boletería', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000035', 'Boletería', CURRENT_DATE - 5, 'media', 'completado'),
  ('Preparar canchas y uniformes', 'e0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000038', 'Deportes', CURRENT_DATE + 3, 'alta', 'en_progreso'),
  ('Diseñar show de luces y escenografía neón', 'e0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000036', 'Producción', CURRENT_DATE + 22, 'media', 'pendiente'),
  ('Campaña en redes para ElectroFest', 'e0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000037', 'Comunicación', CURRENT_DATE + 45, 'baja', 'pendiente'),
  ('Reservar auditorio y equipos de sonido', 'e0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000035', 'Logística', CURRENT_DATE + 30, 'media', 'en_progreso');

COMMIT;
