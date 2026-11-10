-- ============================================================================
-- 014_verificaciones.sql  —  "¿Quedó bien la base?"  Ejecutar DESPUÉS de 010 → 013.
-- Cada consulta trae el resultado ESPERADO en el comentario. Si coincide, la base está lista.
-- (Los números son los de los datos demo de 013_datos_demo.sql.)
-- ============================================================================

-- 1) Tablas y filas del ER
SELECT 'pais' AS tabla, COUNT(*) AS filas FROM pais                       -- esperado: 1
UNION ALL SELECT 'departamento',     COUNT(*) FROM departamento           -- esperado: 16
UNION ALL SELECT 'ciudad',           COUNT(*) FROM ciudad                 -- esperado: 32
UNION ALL SELECT 'persona',          COUNT(*) FROM persona                -- esperado: 82
UNION ALL SELECT 'telefono_persona', COUNT(*) FROM telefono_persona       -- esperado: 26
UNION ALL SELECT 'cliente',          COUNT(*) FROM cliente                -- esperado: 76
UNION ALL SELECT 'agente',           COUNT(*) FROM agente                 -- esperado: 5
UNION ALL SELECT 'administrador',    COUNT(*) FROM administrador          -- esperado: 1
UNION ALL SELECT 'estado_evento',    COUNT(*) FROM estado_evento          -- esperado: 7
UNION ALL SELECT 'estado_reserva',   COUNT(*) FROM estado_reserva         -- esperado: 3
UNION ALL SELECT 'evento',           COUNT(*) FROM evento                 -- esperado: 10
UNION ALL SELECT 'reserva',          COUNT(*) FROM reserva;               -- esperado: 1328

-- 2) Herencia: cada PERSONA está en UNA sola subclase  → esperado: 0 filas
SELECT p.numero_identificacion
  FROM persona p
 WHERE (SELECT COUNT(*) FROM (SELECT numero_identificacion FROM cliente UNION ALL SELECT numero_identificacion FROM agente
                              UNION ALL SELECT numero_identificacion FROM administrador) s
         WHERE s.numero_identificacion = p.numero_identificacion) <> 1;

-- 3) Eventos con su estado, ventas y precio vigente
SELECT e.codigo_evento, e.nombre_evento, s.nombre_estado AS estado, v.inscritos, e.capacidad_total, v.estado_ventas, v.precio_vigente
  FROM evento e JOIN estado_evento s USING (id_estado_evento) JOIN v_evento_ventas v USING (codigo_evento)
 ORDER BY e.fecha_hora_inicio;   -- esperado: 10 filas; EVT-000009 y EVT-000010 «Finalizado» con estado_ventas ultimos_cupos

-- 4) Finanzas del Admin
SELECT SUM(ingresos) AS dinero_recaudado FROM v_evento_ventas;                     -- esperado: 229150000
SELECT SUM(inscritos) AS entradas_vendidas FROM v_evento_ventas;                   -- esperado: 7641
SELECT SUM(capacidad_total) AS capacidad_total FROM evento;                        -- esperado: 10600

-- 5) Comisión del agente  L(E,T) = b·E + m·T  (guardada en AGENTE.comision)
SELECT p.nombre_completo, a.comision, v.eventos_gestionados AS e, v.entradas_gestionadas AS t,
       r.valor_por_evento * v.eventos_gestionados + r.valor_por_entrada * v.entradas_gestionadas AS l_de_e_t
  FROM agente a JOIN persona p USING (numero_identificacion)
  JOIN v_agente_actividad v ON v.id_agente = a.numero_identificacion, regla_comision r
 ORDER BY p.nombre_completo;     -- esperado: la columna «comision» es IGUAL a «l_de_e_t» en las 5 filas

-- 6) Reglas de negocio (cada una debe fallar con el mensaje indicado). Quita los "--" de una en una:
--    a) Aforo menor que lo vendido        → "El aforo (5) no puede ser menor a los 1450 inscritos actuales."
-- UPDATE evento SET capacidad_total = 5 WHERE codigo_evento = 'EVT-000001';
--    b) Cancelar una reserva SIN causa     → "Para cancelar una reserva debes indicar la causa de la cancelación."
-- UPDATE reserva SET id_estado_reserva = id_estado_reserva_de('Cancelada') WHERE id_reserva = 1;
--    c) Cancelar un evento SIN causa       → "Para cancelar un evento debes indicar la causa de la cancelación."
-- UPDATE evento SET id_estado_evento = id_estado_evento_de('Cancelado') WHERE codigo_evento = 'EVT-000001';
--    d) Persona en dos subclases           → "Una persona solo puede ser Cliente, Agente o Administrador (no varios a la vez)."
-- INSERT INTO agente (numero_identificacion) VALUES ('1100000001');
--    e) Evento creado por alguien que no es Agente → viola la llave foránea evento.id_agente → AGENTE
-- INSERT INTO evento (nombre_evento, teatro, fecha_hora_inicio, fecha_hora_fin, capacidad_total, precio_base, id_ciudad, id_estado_evento, id_agente)
--   VALUES ('Prueba', 'Sala', now(), now() + interval '2 hours', 10, 0, 1, 1, '1100000001');
--    f) Inscripción repetida               → "Ya estás inscrito en este evento."
-- SELECT confirmar_reserva('EVT-000002','1100000052',1,'general',25000,1,25000,0,0,0,25000,25,'tarjeta','Visa','4242');
