-- ============================================================================
-- 013_datos_demo.sql  —  Datos de PRUEBA / DEMO sobre el modelo ER  (equivalen al seed de V9)
--
-- ⚠ Solo para desarrollo y demostraciones. Trae contraseñas de ejemplo y reservas ficticias.
--   En producción NO se ejecuta (o se borran estas cuentas).
-- Requisito: 010, 011 y 012 ya ejecutados.  Ejecutar UNA vez (para repetir, vuelve a correr 010).
--
-- Cuentas de ejemplo (contraseña de TODAS: 123456 — las mismas del modo mock del frontend):
--   Administrador : admin@eventpro.com     (cédula 1000000001)
--   Agente        : agente@eventpro.com    (cédula 1000000002)
--   Cliente       : user@eventpro.com      (cédula 1100000052)
--
-- Las reservas de «relleno» (las que completan el aforo) se insertan DIRECTO, sin pasar por confirmar_reserva:
-- son datos de demostración, por eso unos pocos compradores tienen varias reservas en el mismo evento.
-- ============================================================================
BEGIN;
SELECT set_config('eventpro.carga_masiva', 'on', true);   -- pospone triggers de estado/comisión: se recalculan al final

DO $$
DECLARE
  v_clave TEXT := crypt('123456', gen_salt('bf', 8));   -- se calcula una sola vez
  v_tulua INTEGER := (SELECT id_ciudad FROM ciudad WHERE nombre_ciudad = 'Tuluá');
  v_cali  INTEGER := (SELECT id_ciudad FROM ciudad WHERE nombre_ciudad = 'Cali');
BEGIN
  INSERT INTO persona (numero_identificacion, nombre_completo, correo_electronico, contrasena, direccion, id_ciudad) VALUES
  ('1000000001', 'Sofía Navarro', 'admin@eventpro.com', v_clave, NULL, v_cali),
  ('1000000002', 'Carmen López', 'agente@eventpro.com', v_clave, NULL, v_tulua),
  ('1000000003', 'Isabela Ruiz', 'isabela.ruiz@eventpro.co', v_clave, NULL, v_tulua),
  ('1000000004', 'Rodrigo Fuentes', 'rodrigo.fuentes@eventpro.co', v_clave, NULL, v_tulua),
  ('1000000005', 'Valentina Serra', 'valentina.serra@eventpro.co', v_clave, NULL, v_tulua),
  ('1000000006', 'Sofía Mora', 'sofia.mora@eventpro.co', v_clave, NULL, v_tulua),
  ('1100000001', 'Camila Vargas', 'camila.vargas@correo.co', v_clave, NULL, v_tulua),
  ('1100000002', 'Mateo Martínez', 'mateo.martinez@correo.co', v_clave, NULL, v_tulua),
  ('1100000003', 'Elena Londoño', 'elena.londono@correo.co', v_clave, NULL, v_tulua),
  ('1100000004', 'Esteban Jiménez', 'esteban.jimenez@correo.co', v_clave, NULL, v_tulua),
  ('1100000005', 'Daniela Ardila', 'daniela.ardila@correo.co', v_clave, NULL, v_tulua),
  ('1100000006', 'Andrés Gómez', 'andres.gomez@correo.co', v_clave, NULL, v_tulua),
  ('1100000007', 'Ana Torres', 'ana.torres@correo.co', v_clave, NULL, v_tulua),
  ('1100000008', 'Tomás Cruz', 'tomas.cruz@correo.co', v_clave, NULL, v_tulua),
  ('1100000009', 'Natalia Pérez', 'natalia.perez@correo.co', v_clave, NULL, v_tulua),
  ('1100000010', 'David Ríos', 'david.rios@correo.co', v_clave, NULL, v_tulua),
  ('1100000011', 'Paula Molina', 'paula.molina@correo.co', v_clave, NULL, v_tulua),
  ('1100000012', 'Santiago Rincón', 'santiago.rincon@correo.co', v_clave, NULL, v_tulua),
  ('1100000013', 'Valeria Castro', 'valeria.castro@correo.co', v_clave, NULL, v_tulua),
  ('1100000014', 'Carlos Flores', 'carlos.flores@correo.co', v_clave, NULL, v_tulua),
  ('1100000015', 'Juliana Rojas', 'juliana.rojas@correo.co', v_clave, NULL, v_tulua),
  ('1100000016', 'Sebastián González', 'sebastian.gonzalez@correo.co', v_clave, NULL, v_tulua),
  ('1100000017', 'Sara Salazar', 'sara.salazar@correo.co', v_clave, NULL, v_tulua),
  ('1100000018', 'Miguel Quintero', 'miguel.quintero@correo.co', v_clave, NULL, v_tulua),
  ('1100000019', 'Manuela Díaz', 'manuela.diaz@correo.co', v_clave, NULL, v_tulua),
  ('1100000020', 'Felipe Peña', 'felipe.pena@correo.co', v_clave, NULL, v_tulua),
  ('1100000021', 'Laura Romero', 'laura.romero@correo.co', v_clave, NULL, v_tulua),
  ('1100000022', 'Javier Ortiz', 'javier.ortiz@correo.co', v_clave, NULL, v_tulua),
  ('1100000023', 'Isabela Sánchez', 'isabela.sanchez@correo.co', v_clave, NULL, v_tulua),
  ('1100000024', 'Julián Mena', 'julian.mena@correo.co', v_clave, NULL, v_tulua),
  ('1100000025', 'María Herrera', 'maria.herrera@correo.co', v_clave, NULL, v_tulua),
  ('1100000026', 'Nicolás Moreno', 'nicolas.moreno@correo.co', v_clave, NULL, v_tulua),
  ('1100000027', 'Camila Peña', 'camila.pena@correo.co', v_clave, NULL, v_tulua),
  ('1100000028', 'Mateo Romero', 'mateo.romero@correo.co', v_clave, NULL, v_tulua),
  ('1100000029', 'Elena Ortiz', 'elena.ortiz@correo.co', v_clave, NULL, v_tulua),
  ('1100000030', 'Esteban Sánchez', 'esteban.sanchez@correo.co', v_clave, NULL, v_tulua),
  ('1100000031', 'Daniela Mena', 'daniela.mena@correo.co', v_clave, NULL, v_tulua),
  ('1100000032', 'Andrés Herrera', 'andres.herrera@correo.co', v_clave, NULL, v_tulua),
  ('1100000033', 'Ana Moreno', 'ana.moreno@correo.co', v_clave, NULL, v_tulua),
  ('1100000034', 'Tomás Vargas', 'tomas.vargas@correo.co', v_clave, NULL, v_tulua),
  ('1100000035', 'Natalia Martínez', 'natalia.martinez@correo.co', v_clave, NULL, v_tulua),
  ('1100000036', 'David Londoño', 'david.londono@correo.co', v_clave, NULL, v_tulua),
  ('1100000037', 'Paula Jiménez', 'paula.jimenez@correo.co', v_clave, NULL, v_tulua),
  ('1100000038', 'Santiago Ardila', 'santiago.ardila@correo.co', v_clave, NULL, v_tulua),
  ('1100000039', 'Valeria Gómez', 'valeria.gomez@correo.co', v_clave, NULL, v_tulua),
  ('1100000040', 'Carlos Torres', 'carlos.torres@correo.co', v_clave, NULL, v_tulua),
  ('1100000041', 'Juliana Cruz', 'juliana.cruz@correo.co', v_clave, NULL, v_tulua),
  ('1100000042', 'Sebastián Pérez', 'sebastian.perez@correo.co', v_clave, NULL, v_tulua),
  ('1100000043', 'Sara Ríos', 'sara.rios@correo.co', v_clave, NULL, v_tulua),
  ('1100000044', 'Miguel Molina', 'miguel.molina@correo.co', v_clave, NULL, v_tulua),
  ('1100000045', 'Manuela Rincón', 'manuela.rincon@correo.co', v_clave, NULL, v_tulua),
  ('1100000046', 'Felipe Castro', 'felipe.castro@correo.co', v_clave, NULL, v_tulua),
  ('1100000047', 'Laura Flores', 'laura.flores@correo.co', v_clave, NULL, v_tulua),
  ('1100000048', 'Javier Rojas', 'javier.rojas@correo.co', v_clave, NULL, v_tulua),
  ('1100000049', 'Isabela González', 'isabela.gonzalez@correo.co', v_clave, NULL, v_tulua),
  ('1100000050', 'Julián Salazar', 'julian.salazar@correo.co', v_clave, NULL, v_tulua),
  ('1100000051', 'María Quintero', 'maria.quintero@correo.co', v_clave, NULL, v_tulua),
  ('1100000052', 'Carlos Mejía', 'user@eventpro.com', v_clave, 'Carrera 27 # 40-15', v_tulua),
  ('1200000001', 'Camila Ortiz', 'camila.ortiz@correo.co', v_clave, NULL, v_tulua),
  ('1200000002', 'Felipe Vargas', 'felipe.vargas@correo.co', v_clave, NULL, v_tulua),
  ('1200000003', 'Valeria Gómez', 'valeria.gomez.compra@correo.co', v_clave, NULL, v_tulua),
  ('1200000004', 'Andrés Molina', 'andres.molina@correo.co', v_clave, NULL, v_tulua),
  ('1200000005', 'María González', 'maria.gonzalez@correo.co', v_clave, NULL, v_tulua),
  ('1200000006', 'Miguel Romero', 'miguel.romero@correo.co', v_clave, NULL, v_tulua),
  ('1200000007', 'Julián Castro', 'julian.castro@correo.co', v_clave, NULL, v_tulua),
  ('1200000008', 'Sara Quintero', 'sara.quintero@correo.co', v_clave, NULL, v_tulua),
  ('1200000009', 'David Sánchez', 'david.sanchez@correo.co', v_clave, NULL, v_tulua),
  ('1200000010', 'Elena Martínez', 'elena.martinez@correo.co', v_clave, NULL, v_tulua),
  ('1200000011', 'Javier Torres', 'javier.torres@correo.co', v_clave, NULL, v_tulua),
  ('1200000012', 'Paula Rincón', 'paula.rincon@correo.co', v_clave, NULL, v_tulua),
  ('1200000013', 'Laura Jiménez', 'laura.jimenez@correo.co', v_clave, NULL, v_tulua),
  ('1200000014', 'Carlos Pérez', 'carlos.perez@correo.co', v_clave, NULL, v_tulua),
  ('1200000015', 'Ana Flores', 'ana.flores@correo.co', v_clave, NULL, v_tulua),
  ('1200000016', 'Roberto Díaz', 'roberto.diaz@correo.co', v_clave, NULL, v_tulua),
  ('1200000017', 'Juliana Mena', 'juliana.mena@correo.co', v_clave, NULL, v_tulua),
  ('1200000018', 'Sebastián Rojas', 'sebastian.rojas@correo.co', v_clave, NULL, v_tulua),
  ('1200000019', 'Patricia Moreno', 'patricia.moreno@correo.co', v_clave, NULL, v_tulua),
  ('1200000020', 'Nicolás Ardila', 'nicolas.ardila@correo.co', v_clave, NULL, v_tulua),
  ('1200000021', 'Esteban Salazar', 'esteban.salazar@correo.co', v_clave, NULL, v_tulua),
  ('1200000022', 'Daniela Cruz', 'daniela.cruz@correo.co', v_clave, NULL, v_tulua),
  ('1200000023', 'Natalia Peña', 'natalia.pena@correo.co', v_clave, NULL, v_tulua),
  ('1200000024', 'Mateo Herrera', 'mateo.herrera@correo.co', v_clave, NULL, v_tulua);

  INSERT INTO administrador (numero_identificacion, salario, horario) VALUES ('1000000001', 4200000, 'Lunes a viernes, 8:00 a. m. – 5:00 p. m.');
  INSERT INTO agente (numero_identificacion, comision, experiencia) VALUES
  ('1000000002', 0, '5 años coordinando eventos universitarios'),
  ('1000000003', 0, '3 años en producción de conciertos'),
  ('1000000004', 0, '2 años en logística y boletería'),
  ('1000000005', 0, '4 años en eventos deportivos'),
  ('1000000006', 0, '1 año como coordinadora de eventos culturales');
  -- clientes: 100 puntos de bono de lanzamiento (+1 punto por cada $1.000 pagados antes: solo Carlos Mejía tenía compras)
  INSERT INTO cliente (numero_identificacion, cantidad_puntos, visualizacion_publicidad) VALUES
  ('1100000001', 100, TRUE),
  ('1100000002', 100, TRUE),
  ('1100000003', 100, TRUE),
  ('1100000004', 100, TRUE),
  ('1100000005', 100, TRUE),
  ('1100000006', 100, TRUE),
  ('1100000007', 100, TRUE),
  ('1100000008', 100, TRUE),
  ('1100000009', 100, TRUE),
  ('1100000010', 100, TRUE),
  ('1100000011', 100, TRUE),
  ('1100000012', 100, TRUE),
  ('1100000013', 100, TRUE),
  ('1100000014', 100, TRUE),
  ('1100000015', 100, TRUE),
  ('1100000016', 100, TRUE),
  ('1100000017', 100, TRUE),
  ('1100000018', 100, TRUE),
  ('1100000019', 100, TRUE),
  ('1100000020', 100, FALSE),
  ('1100000021', 100, FALSE),
  ('1100000022', 100, TRUE),
  ('1100000023', 100, TRUE),
  ('1100000024', 100, TRUE),
  ('1100000025', 100, TRUE),
  ('1100000026', 100, TRUE),
  ('1100000027', 100, TRUE),
  ('1100000028', 100, TRUE),
  ('1100000029', 100, TRUE),
  ('1100000030', 100, TRUE),
  ('1100000031', 100, TRUE),
  ('1100000032', 100, TRUE),
  ('1100000033', 100, TRUE),
  ('1100000034', 100, TRUE),
  ('1100000035', 100, TRUE),
  ('1100000036', 100, TRUE),
  ('1100000037', 100, TRUE),
  ('1100000038', 100, TRUE),
  ('1100000039', 100, TRUE),
  ('1100000040', 100, TRUE),
  ('1100000041', 100, TRUE),
  ('1100000042', 100, TRUE),
  ('1100000043', 100, TRUE),
  ('1100000044', 100, TRUE),
  ('1100000045', 100, TRUE),
  ('1100000046', 100, FALSE),
  ('1100000047', 100, FALSE),
  ('1100000048', 100, TRUE),
  ('1100000049', 100, TRUE),
  ('1100000050', 100, TRUE),
  ('1100000051', 100, TRUE),
  ('1100000052', 140, TRUE),
  ('1200000001', 0, TRUE),
  ('1200000002', 0, TRUE),
  ('1200000003', 0, TRUE),
  ('1200000004', 0, TRUE),
  ('1200000005', 0, TRUE),
  ('1200000006', 0, TRUE),
  ('1200000007', 0, TRUE),
  ('1200000008', 0, TRUE),
  ('1200000009', 0, TRUE),
  ('1200000010', 0, TRUE),
  ('1200000011', 0, TRUE),
  ('1200000012', 0, TRUE),
  ('1200000013', 0, TRUE),
  ('1200000014', 0, TRUE),
  ('1200000015', 0, TRUE),
  ('1200000016', 0, TRUE),
  ('1200000017', 0, TRUE),
  ('1200000018', 0, TRUE),
  ('1200000019', 0, TRUE),
  ('1200000020', 0, TRUE),
  ('1200000021', 0, TRUE),
  ('1200000022', 0, TRUE),
  ('1200000023', 0, TRUE),
  ('1200000024', 0, TRUE);
  INSERT INTO telefono_persona (numero_telefono, numero_identificacion) VALUES
  ('+57 311 234 5678', '1000000001'),
  ('315 678 9012', '1100000052'),
  ('310 200 1000', '1200000001'),
  ('310 213 1001', '1200000002'),
  ('310 226 1002', '1200000003'),
  ('310 239 1003', '1200000004'),
  ('310 252 1004', '1200000005'),
  ('310 265 1005', '1200000006'),
  ('311 200 1037', '1200000007'),
  ('311 213 1038', '1200000008'),
  ('311 226 1039', '1200000009'),
  ('311 239 1040', '1200000010'),
  ('311 252 1041', '1200000011'),
  ('311 265 1042', '1200000012'),
  ('312 200 1074', '1200000013'),
  ('312 213 1075', '1200000014'),
  ('312 226 1076', '1200000015'),
  ('312 239 1077', '1200000016'),
  ('312 252 1078', '1200000017'),
  ('312 265 1079', '1200000018'),
  ('313 213 1112', '1200000019'),
  ('313 226 1113', '1200000020'),
  ('314 213 1149', '1200000021'),
  ('314 226 1150', '1200000022'),
  ('315 213 1186', '1200000023'),
  ('315 226 1187', '1200000024');
END $$;

-- ---------- eventos (10) ----------
INSERT INTO evento (codigo_evento, nombre_evento, descripcion, teatro, fecha_hora_inicio, fecha_hora_fin, capacidad_total, precio_base, observaciones, id_ciudad, id_estado_evento, id_agente) VALUES
  ('EVT-000001', 'Color Fest Universitario 2026', 'La fiesta de polvos de colores del año: música en vivo, DJs y una zona de experiencias en las canchas del campus.', 'Canchas del Campus', (CURRENT_DATE + 12) + TIME '14:00', (CURRENT_DATE + 12) + TIME '14:00' + interval '4 hours', 2000, 35000, NULL, (SELECT id_ciudad FROM ciudad WHERE nombre_ciudad = 'Tuluá'), id_estado_evento_de('Disponible'), '1000000002'),
  ('EVT-000002', 'Guerra de Bandas Universitarias: Rock & Indie Night', 'Concierto en vivo con las mejores bandas estudiantiles compitiendo por el título de la noche.', 'Auditorio al Aire Libre', (CURRENT_DATE + 18) + TIME '19:00', (CURRENT_DATE + 18) + TIME '19:00' + interval '4 hours', 800, 25000, NULL, (SELECT id_ciudad FROM ciudad WHERE nombre_ciudad = 'Tuluá'), id_estado_evento_de('Disponible'), '1000000002'),
  ('EVT-000003', 'Welcome Party: Fiesta de Integración & Primíparos', 'Noche de música urbana, electrónica y luces neón para darles la bienvenida a los primíparos.', 'Coliseo Cubierto', (CURRENT_DATE + 26) + TIME '21:00', (CURRENT_DATE + 26) + TIME '21:00' + interval '4 hours', 1200, 30000, NULL, (SELECT id_ciudad FROM ciudad WHERE nombre_ciudad = 'Tuluá'), id_estado_evento_de('Disponible'), '1000000003'),
  ('EVT-000004', 'Sunset Campus: Festival de Food Trucks, Birras & Acústicos', 'Tarde de integración al aire libre con food trucks, cerveza artesanal y música acústica. Entrada libre.', 'Plazoleta Central', (CURRENT_DATE + 33) + TIME '16:00', (CURRENT_DATE + 33) + TIME '16:00' + interval '4 hours', 1500, 0, NULL, (SELECT id_ciudad FROM ciudad WHERE nombre_ciudad = 'Tuluá'), id_estado_evento_de('Disponible'), '1000000004'),
  ('EVT-000005', 'ElectroFest Fin de Semestre', 'Cierre de semestre con DJs invitados, pantallas LED y un show de luces que no vas a olvidar.', 'Canchas del Campus', (CURRENT_DATE + 54) + TIME '22:00', (CURRENT_DATE + 54) + TIME '22:00' + interval '4 hours', 2500, 60000, NULL, (SELECT id_ciudad FROM ciudad WHERE nombre_ciudad = 'Tuluá'), id_estado_evento_de('Disponible'), '1000000002'),
  ('EVT-000006', 'Torneo Interfacultades de Fútbol', 'Torneo deportivo entre facultades con categorías masculina y femenina.', 'Estadio Universitario', (CURRENT_DATE + 5) + TIME '07:00', (CURRENT_DATE + 5) + TIME '07:00' + interval '3 hours', 300, 0, NULL, (SELECT id_ciudad FROM ciudad WHERE nombre_ciudad = 'Tuluá'), id_estado_evento_de('Disponible'), '1000000005'),
  ('EVT-000007', 'Cumbre de Innovación Académica 2026', 'Conferencias, talleres y networking para estudiantes y docentes de educación superior.', 'Auditorio Central', (CURRENT_DATE + 38) + TIME '09:00', (CURRENT_DATE + 38) + TIME '09:00' + interval '3 hours', 500, 0, NULL, (SELECT id_ciudad FROM ciudad WHERE nombre_ciudad = 'Tuluá'), id_estado_evento_de('Disponible'), '1000000002'),
  ('EVT-000008', 'Exposición de Arte Contemporáneo', 'Muestra de artistas emergentes universitarios en arte contemporáneo.', 'Sala de Exposiciones', (CURRENT_DATE + 45) + TIME '16:00', (CURRENT_DATE + 45) + TIME '16:00' + interval '3 hours', 400, 0, NULL, (SELECT id_ciudad FROM ciudad WHERE nombre_ciudad = 'Tuluá'), id_estado_evento_de('Disponible'), '1000000004'),
  ('EVT-000009', 'Noche de Talentos Universitaria', 'Show de talentos con música, baile y stand up de estudiantes.', 'Auditorio Central', (CURRENT_DATE - 39) + TIME '19:00', (CURRENT_DATE - 39) + TIME '19:00' + interval '3 hours', 400, 15000, NULL, (SELECT id_ciudad FROM ciudad WHERE nombre_ciudad = 'Tuluá'), id_estado_evento_de('Finalizado'), '1000000004'),
  ('EVT-000010', 'Rumba Retro Campus', 'Una noche de clásicos de los 80, 90 y 2000 para toda la comunidad.', 'Coliseo Cubierto', (CURRENT_DATE - 25) + TIME '21:00', (CURRENT_DATE - 25) + TIME '21:00' + interval '4 hours', 1000, 20000, NULL, (SELECT id_ciudad FROM ciudad WHERE nombre_ciudad = 'Tuluá'), id_estado_evento_de('Finalizado'), '1000000003');
SELECT setval('seq_codigo_evento', 10);

-- ---------- reservas con nombre (59) ----------
INSERT INTO reserva (fecha_hora_reserva, valor_total, numero_entradas, causa_cancelacion, id_cliente, codigo_evento, id_estado_reserva) VALUES
  ((now() AT TIME ZONE 'America/Bogota') - interval '3 days', 35000, 1, NULL, '1200000001', 'EVT-000001', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '5 days', 35000, 1, NULL, '1200000002', 'EVT-000001', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '7 days', 35000, 1, NULL, '1200000003', 'EVT-000001', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '9 days', 35000, 1, NULL, '1200000004', 'EVT-000001', id_estado_reserva_de('Pendiente')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '11 days', 35000, 1, NULL, '1200000005', 'EVT-000001', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '13 days', 35000, 1, 'Cancelada por el cliente (dato de ejemplo)', '1200000006', 'EVT-000001', id_estado_reserva_de('Cancelada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '6 days', 25000, 1, NULL, '1200000007', 'EVT-000002', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '8 days', 25000, 1, NULL, '1200000008', 'EVT-000002', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '10 days', 25000, 1, NULL, '1200000009', 'EVT-000002', id_estado_reserva_de('Pendiente')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '12 days', 25000, 1, NULL, '1200000010', 'EVT-000002', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '14 days', 25000, 1, 'Cancelada por el cliente (dato de ejemplo)', '1200000011', 'EVT-000002', id_estado_reserva_de('Cancelada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '16 days', 25000, 1, NULL, '1200000012', 'EVT-000002', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '9 days', 30000, 1, NULL, '1200000013', 'EVT-000003', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '11 days', 30000, 1, NULL, '1200000014', 'EVT-000003', id_estado_reserva_de('Pendiente')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '13 days', 30000, 1, NULL, '1200000015', 'EVT-000003', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '15 days', 30000, 1, 'Cancelada por el cliente (dato de ejemplo)', '1200000016', 'EVT-000003', id_estado_reserva_de('Cancelada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '17 days', 30000, 1, NULL, '1200000017', 'EVT-000003', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '19 days', 30000, 1, NULL, '1200000018', 'EVT-000003', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '12 days', 0, 1, NULL, '1200000006', 'EVT-000004', id_estado_reserva_de('Pendiente')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '14 days', 0, 1, NULL, '1200000019', 'EVT-000004', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '16 days', 0, 1, 'Cancelada por el cliente (dato de ejemplo)', '1200000020', 'EVT-000004', id_estado_reserva_de('Cancelada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '18 days', 0, 1, NULL, '1200000001', 'EVT-000004', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '20 days', 0, 1, NULL, '1200000002', 'EVT-000004', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '22 days', 0, 1, NULL, '1200000003', 'EVT-000004', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '15 days', 60000, 1, NULL, '1200000012', 'EVT-000005', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '17 days', 60000, 1, 'Cancelada por el cliente (dato de ejemplo)', '1200000021', 'EVT-000005', id_estado_reserva_de('Cancelada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '19 days', 60000, 1, NULL, '1200000022', 'EVT-000005', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '21 days', 60000, 1, NULL, '1200000007', 'EVT-000005', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '23 days', 60000, 1, NULL, '1200000008', 'EVT-000005', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '3 days', 60000, 1, NULL, '1200000009', 'EVT-000005', id_estado_reserva_de('Pendiente')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '18 days', 0, 1, 'Cancelada por el cliente (dato de ejemplo)', '1200000018', 'EVT-000006', id_estado_reserva_de('Cancelada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '20 days', 0, 1, NULL, '1200000023', 'EVT-000006', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '22 days', 0, 1, NULL, '1200000024', 'EVT-000006', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '24 days', 0, 1, NULL, '1200000013', 'EVT-000006', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '4 days', 0, 1, NULL, '1200000014', 'EVT-000006', id_estado_reserva_de('Pendiente')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '6 days', 0, 1, NULL, '1200000015', 'EVT-000006', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '21 days', 0, 1, NULL, '1200000003', 'EVT-000007', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '23 days', 0, 1, NULL, '1200000004', 'EVT-000007', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '3 days', 0, 1, NULL, '1200000005', 'EVT-000007', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '5 days', 0, 1, NULL, '1200000006', 'EVT-000007', id_estado_reserva_de('Pendiente')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '7 days', 0, 1, NULL, '1200000019', 'EVT-000007', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '9 days', 0, 1, 'Cancelada por el cliente (dato de ejemplo)', '1200000020', 'EVT-000007', id_estado_reserva_de('Cancelada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '24 days', 0, 1, NULL, '1200000009', 'EVT-000008', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '4 days', 0, 1, NULL, '1200000010', 'EVT-000008', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '6 days', 0, 1, NULL, '1200000011', 'EVT-000008', id_estado_reserva_de('Pendiente')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '8 days', 0, 1, NULL, '1200000012', 'EVT-000008', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '10 days', 0, 1, 'Cancelada por el cliente (dato de ejemplo)', '1200000021', 'EVT-000008', id_estado_reserva_de('Cancelada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '12 days', 0, 1, NULL, '1200000022', 'EVT-000008', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '5 days', 15000, 1, NULL, '1200000015', 'EVT-000009', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '7 days', 15000, 1, NULL, '1200000016', 'EVT-000009', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '9 days', 15000, 1, NULL, '1200000017', 'EVT-000009', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '11 days', 15000, 1, NULL, '1200000018', 'EVT-000009', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '8 days', 20000, 1, NULL, '1200000020', 'EVT-000010', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '10 days', 20000, 1, NULL, '1200000001', 'EVT-000010', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '12 days', 20000, 1, NULL, '1200000002', 'EVT-000010', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '14 days', 20000, 1, NULL, '1200000003', 'EVT-000010', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '20 days', 25000, 1, NULL, '1100000052', 'EVT-000002', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '20 days', 0, 1, NULL, '1100000052', 'EVT-000006', id_estado_reserva_de('Confirmada')),
  ((now() AT TIME ZONE 'America/Bogota') - interval '20 days', 15000, 1, NULL, '1100000052', 'EVT-000009', id_estado_reserva_de('Confirmada'));

-- ---------- reservas de relleno (hasta igualar los inscritos de la app): 6 entradas por reserva ----------
WITH compradores AS (
  SELECT numero_identificacion AS id, ROW_NUMBER() OVER (ORDER BY numero_identificacion) - 1 AS n
    FROM cliente WHERE numero_identificacion LIKE '12%'
), relleno (n_evento, entradas, precio) AS (VALUES
  (1, 1445, 35000),
  (2, 606, 25000),
  (3, 975, 30000),
  (4, 735, 0),
  (5, 1825, 60000),
  (6, 204, 0),
  (7, 337, 0),
  (8, 182, 0),
  (9, 375, 15000),
  (10, 906, 20000)
), lotes AS (
  SELECT r.n_evento, g AS i, LEAST(6, r.entradas - (g - 1) * 6) AS x, r.precio
    FROM relleno r, LATERAL generate_series(1, CEIL(r.entradas / 6.0)::INT) AS g
)
INSERT INTO reserva (fecha_hora_reserva, valor_total, numero_entradas, id_cliente, codigo_evento, id_estado_reserva)
SELECT GREATEST(TIMESTAMP '2026-01-05 10:00:00',
         LEAST((now() AT TIME ZONE 'America/Bogota') - interval '2 hours', e.fecha_hora_inicio)
         - make_interval(days  => (150 * power((abs(hashtext(l.i::text || e.codigo_evento)::BIGINT) % 1000) / 1000.0, 2.2))::INT,
                         hours => (abs(hashtext(l.i::text || e.codigo_evento || 'h')::BIGINT) % 12)::INT)),
       l.x * l.precio, l.x, c.id, e.codigo_evento, id_estado_reserva_de('Confirmada')
  FROM lotes l
  JOIN evento e ON e.codigo_evento = 'EVT-' || lpad(l.n_evento::text, 6, '0')
  JOIN compradores c ON c.n = (l.i + l.n_evento) % (SELECT COUNT(*) FROM compradores);

-- ---------- recalcular estados de venta y comisiones con todos los datos ----------
SELECT set_config('eventpro.carga_masiva', 'off', true);
SELECT refrescar_estado_evento(codigo_evento) FROM evento;
SELECT recalcular_comision_agente(numero_identificacion) FROM agente;

COMMIT;