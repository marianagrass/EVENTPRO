# EventPro V10 — Modelo Entidad-Relación aprobado por el tutor

Este documento resume **qué cambió**, **cómo migrar** la base en Neon, **qué cambia en el frontend** y **qué decisiones conviene confirmar con el tutor**.

---

## 1. Estructura de la base (sin atributos nuevos en las tablas del ER, salvo `persona.activo`)

> **Excepción (migración `015_baja_logica_personas.sql`):** `persona.activo BOOLEAN NOT NULL DEFAULT TRUE` para el borrado lógico de cuentas. No está en el ER aprobado por el tutor → **confirmarlo con él** (alternativa equivalente: catálogo `estado_persona` + FK). Endpoint: `PATCH /api/accounts/:id/status`; `DELETE /api/accounts/:id` ya no existe.

| Bloque | Tablas |
|---|---|
| Geografía | `pais(id_pais, nombre_pais)` · `departamento(id_departamento, nombre_departamento, id_pais FK)` · `ciudad(id_ciudad, nombre_ciudad, id_departamento FK)` |
| Herencia de personas | `persona(numero_identificacion PK, nombre_completo, correo_electronico UNIQUE, contrasena, direccion, id_ciudad FK)` · `telefono_persona(id_telefono, numero_telefono, numero_identificacion FK, ON DELETE CASCADE)` |
| Subclases (PK = FK a persona) | `cliente(cantidad_puntos, visualizacion_publicidad)` · `agente(comision, experiencia)` · `administrador(salario, horario)` |
| Catálogos | `estado_evento(id_estado_evento, nombre_estado)` · `estado_reserva(id_estado_reserva, nombre_estado)` |
| Negocio | `evento(codigo_evento PK, nombre_evento, descripcion, teatro, fecha_hora_inicio, fecha_hora_fin, capacidad_total, precio_base, observaciones, causa_cancelacion NULL, id_ciudad, id_estado_evento, id_agente → agente)` · `reserva(id_reserva, fecha_hora_reserva, valor_total, numero_entradas, observaciones, causa_cancelacion NULL, id_cliente → cliente, codigo_evento, id_estado_reserva)` |

**Eliminadas:** `registro_financiero`, `tarea`, `inscribe_reserva`, `usuario`, `usuario_base` (y todo el esquema V1–V9).

**Rol = tabla subclase.** La API deduce el rol de la tabla donde está la persona: `cliente → user`, `agente → agent` (el front lo muestra como «Agente»), `administrador → admin`. Un trigger impide que una misma persona esté en dos subclases.

**Reglas dentro de la base:** PK, FK, UNIQUE y NOT NULL en todas las tablas; CHECK de puntos ≥ 0, comisión ≥ 0, salario ≥ 0, entradas entre 1 y 10, fechas coherentes; `causa_cancelacion` obligatoria (≥ 3 caracteres) cuando el estado pasa a «Cancelada»/«Cancelado», y debe ser NULL en cualquier otro estado.

## 2. Cómo migrar en Neon

> ⚠️ **La migración es destructiva.** Antes crea un *branch* o copia de tu base en Neon.

Ejecuta en el *SQL Editor*, **en este orden** (cada archivo completo):

1. `backend/db/010_modelo_er.sql` — borra lo viejo y crea el ER (transaccional, se puede volver a correr).
2. `backend/db/011_soporte_negocio.sql` — tablas de apoyo y funciones/triggers que conservan la matemática (ver §4).
3. `backend/db/012_catalogos.sql` — estados, Colombia, 16 departamentos y 32 ciudades. **Obligatorio.**
4. `backend/db/013_datos_demo.sql` — *(opcional)* 82 personas, 10 eventos y 1.328 reservas de prueba (recaudo 229.150.000 COP, igual que antes).
5. `backend/db/014_verificaciones.sql` — consultas de comprobación y pruebas negativas.

Para empezar de cero: `backend/db/000_reset.sql`. Los scripts de la V9 quedaron en `backend/db/legacy_v9/` solo como referencia.

Cuentas demo (clave `123456`): `admin@eventpro.com` (cédula 1000000001), `agente@eventpro.com` (1000000002), `user@eventpro.com` (1100000052, 140 puntos).

## 3. Resumen de cambios en el Frontend (formularios y pantallas)

| Dónde | Cambio |
|---|---|
| **Registro público** (`auth-forms.js`, `auth-modal.js`, `auth-service.js`, `session.js`) | Nuevos campos: **número de identificación**, **ciudad** (lista `GET /api/ciudades`, agrupada «Ciudad · Departamento»), dirección y teléfono opcionales. Llama `POST /api/personas` y crea PERSONA + CLIENTE. |
| **Perfil del cliente** (`user-account.js`, `user-app.js`) | Ciudad pasa de texto libre a **selector**; se quita «Institución»; se agrega dirección. `PUT /api/accounts/:id/profile { cityId, address, phone }`. |
| **Cancelar inscripción** (cliente: panel y modal del evento) | Nuevo modal `CancelReserva` que **pide la causa** → `POST /api/unregister { eventId, userId, causa }` (se guarda en `reserva.causa_cancelacion`). Sin causa, la API responde 400 `CAUSA_REQUERIDA`. |
| **Reservas del Agente** (antes «Asistentes», `manager.js`) | Sin check-in, alta manual ni eliminar. Tabla con entradas, total y estado; «Confirmar» para pendientes; **«Cancelar» abre modal con causa** → `POST /api/reservas/:id/cancel { actorId, causa }`. Se muestra la causa de las canceladas. |
| **Eventos del Agente** (`events.js`) | Formulario con **ciudad**, hora de fin y observaciones; se quitan coordinador, estado e imagen. «Eliminar» pasa a **«Cancelar evento»** con causa → `POST /api/events/:id/cancel`, que cancela también sus reservas con reembolso simulado. |
| **Cuentas del Admin** (`accounts.js`) | Columnas identificación, rol (Cliente/Agente/Administrador), ciudad y teléfono; **desactivar / reactivar** (borrado lógico, `persona.activo`, migración `015`) y badge de estado; sin fechas de registro. Crear Agente pide **identificación + ciudad**. |
| **Dashboards** | «Crecimiento de usuarios» → **«Clientes por ciudad»**; KPI «Check-in realizado» → «Entradas vendidas»; «Tareas urgentes» → «Reservas recientes». |
| **Eliminado** | Módulo de Tareas (`tasks.js`, menú y endpoints), check-in, suspensión de cuentas, `created_at`/`last_login`. |
| `data.js` / `app.js` | Ids fijos pasan de UUID a `EVT-0000NN` y cédulas; `refreshData` ya no pide `/tasks` y trae `/ciudades`. |

## 4. Lógica matemática conservada (solo se adaptó de dónde salen los datos)

`lib/pricing.js` (P(x)=B·x·C−D(p)), `lib/traffic.js` (fila virtual T(x)), `lib/optimization.js` y `lib/calculus.js` (precio ideal I(x)=Mx−kx², x*=M/2k), `lib/capacity.js` y `lib/payment-gateway.js` **no se modificaron**.

- Descuento por fidelidad lee `cliente.cantidad_puntos`.
- Crear un evento exige que `id_agente` exista en `agente`.
- Cada pago se guarda como `reserva` (estados desde `estado_reserva`) y el detalle del cobro en `reserva_pago`.
- Estados de venta (Disponible / Últimos cupos / Agotado) los mueve la base según aforo.
- Comisión L(E,T)=b·E+m·T: E = eventos no cancelados del agente; T = entradas «Confirmada». Se guarda en `agente.comision`.

## 5. Decisiones a confirmar con el tutor

1. **Tablas de apoyo fuera del ER** (`011_soporte_negocio.sql`): `zona`, `reserva_pago` (1:1 con reserva), `ajuste_precio`, `regla_comision`. El ER no tiene dónde guardar zona, coeficiente C, puntos usados, descuentos, método de pago ni la bitácora del precio dinámico; sin ellas se perdería la matemática de pagos. Son tablas nuevas, **no** atributos nuevos de las del ER.
2. **Estados extra** en `estado_evento`: Pausado, Cerrado, Finalizado (además de Disponible, Últimos cupos, Agotado, Cancelado). Sirven para «pausar/cerrar inscripciones».
3. **Subclases disjuntas** (trigger): una persona no puede ser a la vez cliente y agente.
4. **`persona.direccion` es opcional** (NULL) para no bloquear el registro rápido.
5. **Tipo e imagen del evento no se guardan** (no están en el ER): el tipo se deduce del nombre/descripción (`lib/event-presentation.js`) y la imagen sale del tipo.
6. **T de la comisión** ahora son entradas vendidas (antes check-ins, que ya no existen).
7. `reserva.numero_entradas` limitado a 1–10 (la regla de negocio es máximo 6 por compra).

## 6. Endpoints nuevos o cambiados

`GET /api/geografia/paises` · `…/paises/:id/departamentos` · `…/departamentos/:id/ciudades` · `GET /api/ciudades` · `GET /api/catalogos/estados-evento` · `…/estados-reserva` · `POST /api/personas` · `POST /api/events/:id/cancel` · `POST /api/reservas/:id/cancel` · `GET /api/reservas`.
Cambian: `POST /api/unregister` (exige `causa`), `POST /api/events` (`created_by` debe ser un AGENTE), `DELETE /api/events/:id` (solo si no tiene reservas).
Retirados: `/api/tasks`, check-in, alta manual de asistentes, `PUT /api/accounts/:id/status`.

## 7. Verificación realizada

- `npm test` → **68 pruebas, 0 fallos** (estructura exacta del ER, FK, migración V9→ER, herencia, causas, flujos de pago, cola virtual, precio ideal, comisión, reporte de ingresos).
- Barrido en navegador (Playwright): registro con ciudad, perfil, cancelar con causa (cliente y agente), crear/editar/cancelar evento, alta de Agente — sin errores de consola.
- ESLint `no-undef` sobre todos los scripts del front, en el orden de `index.html`: limpio.

## 8. Pendiente (fuera de este alcance)

Autenticación real (hoy sigue el modo mock con contraseña de demostración `123456`), JWT y roles verificados en el backend, y **rotar la contraseña de Neon** si alguna vez se compartió.
