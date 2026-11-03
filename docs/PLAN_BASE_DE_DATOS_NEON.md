# Plan para montar la base de datos de EventPro en Neon (PostgreSQL)

> Pensado para un equipo que **nunca ha usado Neon ni una base de datos en la nube**. Está en orden: primero qué es cada cosa, luego qué se hace, en qué orden y cómo saber que quedó bien.

---

## 0. Resumen en un minuto

| | |
|---|---|
| **Hoy** | Los datos viven en `js/data.js` (memoria del navegador). Al recargar se pierden y cada persona ve los suyos. |
| **Meta** | Datos reales y compartidos: lo que el Agente crea lo ve el Usuario, y el Admin ve el dinero real. |
| **Cómo** | 3 piezas: **Neon** (guarda los datos) ← **API en Node.js** (aplica reglas y seguridad) ← **el frontend actual** (pide los datos por `fetch`). |
| **Ya está hecho** | El diseño de las tablas y los datos de prueba: `backend/db/001_schema.sql`, `002_seed.sql`, `003_checks.sql`. |
| **Falta** | Crear la cuenta en Neon y correr los 3 scripts (≈ 2 h), escribir la API, conectar el frontend, desplegar. |
| **Tiempo total** | Unas **35 a 50 horas-persona** (estimación mía), repartibles en 2 semanas entre 3–4 personas. |
| **Costo** | **$0**. El plan gratuito de Neon no pide tarjeta. |

---

## 1. Qué es cada cosa (sin jerga)

| Palabra | Qué significa | Ejemplo en EventPro |
|---|---|---|
| **Base de datos relacional** | Un “Excel con reglas”: varias hojas (tablas) conectadas entre sí, que impiden datos absurdos. | No puede existir un aforo negativo ni dos cuentas con el mismo correo. |
| **PostgreSQL** | El programa de base de datos (gratis, estándar, muy usado). | Lo que realmente guarda tus datos. |
| **Neon** | Un servicio que te **presta un PostgreSQL ya instalado en internet**. No instalas nada. | Tu base vive en sus servidores; tú solo te conectas. |
| **Tabla / fila / columna** | Hoja / renglón / encabezado. | Tabla `events`: cada evento es una fila; `price_cop` es una columna. |
| **Llave primaria (PK)** | Identificador único de cada fila. | `events.id` |
| **Llave foránea (FK)** | Columna que apunta a la fila de otra tabla. | `attendees.event_id` → a qué evento pertenece la inscripción. |
| **SQL** | El idioma para pedirle cosas a la base. | `SELECT name FROM events;` |
| **Vista** | Una consulta guardada con nombre. | `v_global_occupancy` ya calcula la ocupación global. |
| **Trigger** | Una regla que la base ejecuta sola. | Si el Agente baja el aforo por debajo de los inscritos, la base lo rechaza. |
| **Cadena de conexión** | Una “dirección con usuario y contraseña” para entrar a la base. | `postgresql://usuario:clave@host/basededatos?sslmode=require` |
| **API / backend** | Un programa intermedio que recibe peticiones del frontend, revisa permisos y habla con la base. | `POST /api/events/:id/registrations` |
| **Variable de entorno** | Un secreto guardado fuera del código (archivo `.env`). | `DATABASE_URL` |

### ¿Por qué Neon?
- Es **PostgreSQL normal**: lo que aprendan sirve en cualquier otro lugar.
- Plan gratis sin tarjeta, según [su página de precios](https://neon.com/pricing) (consultada en octubre de 2026): **0,5 GB de almacenamiento y 100 horas de cómputo por proyecto**, hasta 100 proyectos y 10 *branches*. Para EventPro sobra: el seed completo pesa menos de 5 MB.
- **Branches** (ramas): copias instantáneas de la base para experimentar sin dañar los datos buenos.
- Cuentas de equipo con miembros ilimitados, incluso en el plan gratis ([anuncio en su documentación](https://neon.com/docs/get-started/connect-neon)).

### Dos cosas que hay que saber del plan gratis
1. **Se duerme**: tras unos 5 minutos sin uso el cómputo se suspende (*scale-to-zero*), y la primera consulta después tarda más. **Antes de una demo, abran la app unos minutos antes.** No hagan “pings” constantes para mantenerla despierta: gastarían las 100 horas.
2. **Recuperación corta**: solo se puede volver atrás hasta 6 horas. Por eso cada cambio importante va en scripts `.sql` guardados en Git, no “a mano” en la consola.

> Verifiquen estos límites el día que creen la cuenta; los planes cambian.

---

## 2. Arquitectura

```
┌────────────────────┐   HTTPS + JSON   ┌───────────────────────┐   SQL sobre SSL   ┌──────────────────┐
│  Frontend actual   │ ───────────────▶ │  API (Node + Express) │ ────────────────▶ │  Neon            │
│  (HTML/CSS/JS)     │ ◀─────────────── │  - login (JWT)        │ ◀──────────────── │  PostgreSQL      │
│  index.html + js/  │                  │  - permisos por rol   │                   │  8 tablas, vistas│
└────────────────────┘                  │  - valida datos       │                   └──────────────────┘
   NO conoce la contraseña              └───────────────────────┘
   de la base                              guarda DATABASE_URL en .env
```

**¿Por qué el navegador no se conecta directo a Neon?** Porque el código del frontend lo puede leer cualquiera (F12). La contraseña de la base quedaría pública y cualquiera podría borrar todo. Además, “quién es Admin o Agente” no puede decidirlo el navegador: ya lo dice `backend/middleware.js`, *“el frontend NO es seguridad”*. (Neon ofrece una *Data API* por HTTP, pero exige configurar autenticación y reglas por fila; es más difícil y no se recomienda para este proyecto.)

---

## 3. Del `data.js` a las tablas

| Hoy en el frontend (`js/data.js`) | Pasa a la base como | Detalle |
|---|---|---|
| `Data.events` | `events` | `price` → `price_cop`; `time` → `start_time`; `date` → `event_date` |
| `TYPE_LABEL`, `TYPE_COLOR` | `event_types` | Fiesta, Concierto, Cultural, Deportivo… |
| `HOME_CATEGORIES`, `ev.categories` | `categories` + `event_categories` | Un evento puede estar en varias categorías (relación muchos a muchos) |
| `ev.registered` | **se calcula**, no se guarda | `v_event_stats.registered` cuenta las inscripciones |
| `ev.price × registered` | `attendees.price_paid_cop` | Se guarda el precio **del momento de inscribirse** |
| `Data.attendees`, `UserApp.registrations` | `attendees` | `user_id` enlaza con la cuenta; `NULL` = lo registró el Agente a mano |
| `Data.accounts` | `users` | Rol `manager` del front = `agent` en la base |
| `Data.tasks` | `tasks` | `assignee` (texto) → `assignee_id` |
| `Session.USERS` (login falso) | `users` + login real | Contraseña con hash bcrypt |
| *(no existía)* | `audit_log` | Quién suspendió/eliminó/cambió qué |

```mermaid
erDiagram
  users ||--o{ attendees : "se inscribe"
  users ||--o{ events : "crea"
  users ||--o{ tasks : "tiene asignadas"
  events ||--o{ attendees : "recibe"
  events ||--o{ tasks : "tiene"
  events }o--|| event_types : "es de tipo"
  events ||--o{ event_categories : ""
  categories ||--o{ event_categories : ""
  event_types }o--o| categories : "categoría por defecto"
  users ||--o{ audit_log : "actor"
```

### Decisiones de diseño (para poder explicarlas al docente)
1. **“Inscritos” y “recaudo” se calculan, no se guardan.** Guardar un número duplicado se desincroniza tarde o temprano; contar filas, nunca.
2. **`price_paid_cop`**: si el Agente cambia el precio de un evento con ventas, el dinero ya recaudado no cambia.
3. **Sin sobreventa**: la función `register_for_event` bloquea el evento mientras revisa el cupo. Si dos personas piden el último cupo a la vez, una recibe “sin cupos”.
4. **Eliminar cuenta sin romper las finanzas**: `admin_delete_account` anonimiza las inscripciones del usuario (“Cuenta eliminada”) y luego borra la cuenta; el dinero sigue contando.
5. **Suspender ≠ eliminar**: `users.status` (`activo`/`suspendido`). El backend debe rechazar login **y también peticiones** de cuentas suspendidas.
6. **Reglas dentro de la base** (aforo ≥ inscritos, check-in solo a confirmados, un usuario no se inscribe dos veces): aunque el backend tenga un error, los datos quedan íntegros.
7. **Normalización**: no hay datos repetidos entre tablas (tipos y categorías en catálogos propios; relación M:N con tabla intermedia). Cumple 3FN, salvo el *snapshot* intencional de nombre/correo en `attendees`.

> **Cuidado con borrar eventos**: eliminar un evento borra sus inscripciones (`ON DELETE CASCADE`) y por tanto su recaudo. En producción es mejor marcarlo `cancelado`. Díganselo al Agente o hagan que la API pida confirmación extra si el evento ya tiene ventas.

---

## 4. Paso a paso en Neon (Fases 1 y 2)

### Fase 1 — Crear la base (≈ 1 h)
1. Entren a **neon.com** → *Sign up*. Se puede con GitHub, Google o correo. **No pide tarjeta.**
2. **Create project**: nombre `eventpro`. Versión de Postgres: la que venga por defecto. Región: la más cercana (São Paulo si aparece; si no, EE. UU. Este).
3. Un integrante crea el proyecto y **invita al resto** desde la gestión de miembros de la organización/proyecto (la ubicación exacta cambia; búsquenla en la consola).
4. Anoten quién es el **dueño** del proyecto: si esa persona pierde acceso, se pierde la base.

### Fase 2 — Tablas y datos (≈ 1–2 h)
1. Menú lateral → **SQL Editor**.
2. Abran `backend/db/001_schema.sql`, copien **todo** → pegar → **Run**. Debe terminar sin error. (Va dentro de una transacción: si falla, no queda nada a medias.)
3. Repitan con `002_seed.sql`. Tarda unos segundos: genera ≈ 7.600 asistentes ficticios y los hashes de contraseña.
4. Abran `003_checks.sql` y corran **bloque por bloque**. Cada consulta dice qué resultado se espera. Los números clave deben coincidir con el panel de Finanzas de la app:

   | Consulta | Esperado |
   |---|---|
   | Dinero recaudado | **229 150 000** |
   | Ocupación global | **7 641 / 10 600 = 72 %** |
   | Boletas vendidas | **6 162** |
   | Usuarios (rol `user`) | **52** |
   | Cuentas totales | **58** (52 usuarios, 5 agentes, 1 admin) |
   | Eventos públicos activos | **8** |

5. En **Tables** deben verse 8 tablas: `users, events, event_types, categories, event_categories, attendees, tasks, audit_log`.
6. **Si se equivocan**: corran `000_reset.sql` (borra todo) y empiecen de nuevo con 001.

> ⚠ **Aviso honesto:** el sandbox donde se prepararon estos scripts no tenía PostgreSQL, así que **no se ejecutaron contra una base real**. Se validaron con un revisor propio (columnas, llaves foráneas, paréntesis, cantidades de valores, unicidad de correos, y que los totales den 229 150 000 / 7 641 / 6 162). Si Neon muestra un error, copien el mensaje completo: casi siempre indica la línea exacta.

### Cuentas de prueba (contraseña de todas: `123456`)
| Rol | Correo |
|---|---|
| Administrador | `admin@eventpro.com` |
| Agente | `agente@eventpro.com` |
| Usuario | `user@eventpro.com` |

Son **las mismas del modo mock del frontend**: al conectar el backend, las pruebas siguen valiendo. Solo existen en desarrollo; **en producción se borran o se cambia la contraseña**. El contrato exacto de `/api/auth/*` y un ejemplo de Express están en [`CONTRATO_API_AUTH.md`](CONTRATO_API_AUTH.md).

### Obtener la cadena de conexión
En el panel del proyecto, botón **Connect** → elegir *branch* `main`, la base y el rol → copiar. Neon da dos versiones:

| Versión | Aspecto | Úsenla para |
|---|---|---|
| **Pooled** (con “pooler”) | `…@ep-xxxx-pooler.región.aws.neon.tech/…` | La **API en funcionamiento** (muchas conexiones cortas) |
| **Directa** (sin pooler) | `…@ep-xxxx.región.aws.neon.tech/…` | **Migraciones y scripts de seed** desde su computador |

Ambas terminan en `?sslmode=require` (conexión cifrada). La cadena **es una contraseña**: va en `.env` (hay un `backend/.env.example` de plantilla) y **nunca** en Git, en el chat del grupo ni en capturas de pantalla.

### Errores comunes
| Mensaje | Causa | Solución |
|---|---|---|
| `relation "users" already exists` | Ya corrieron 001 | Corran `000_reset.sql` y luego 001 y 002 |
| `relation "users" does not exist` | Corrieron 002 sin 001 | Corran 001 primero |
| `password authentication failed` | Cadena mal copiada o contraseña reseteada | Copien otra vez desde **Connect** |
| `SSL connection is required` | Falta `sslmode=require` | Agréguenlo al final |
| La primera consulta tarda | La base estaba dormida | Normal en el plan gratis; reintenten |
| `duplicate key … users_email_unique` | Correo repetido | Cada correo es único (sin importar mayúsculas) |

---

## 5. La API (Fase 3) — la parte más larga

**Tecnologías sugeridas** (todas gratuitas): Node.js 20+, `express`, `pg` (o `@neondatabase/serverless`), `bcryptjs`, `jsonwebtoken`, `zod` (validación), `cors`, `helmet`, `dotenv`.

```
backend/
├── db/                      ← ya existe (001, 002, 003, 000)
├── .env.example             ← plantilla (ya existe)
└── src/
    ├── server.js            ← arranca Express
    ├── db.js                ← conexión a Neon
    ├── middleware/auth.js   ← authenticate + requireRole (adaptar el actual)
    └── routes/ auth.js · events.js · me.js · manager.js · admin.js
```

### Endpoints por rol
| Rol | Método y ruta | Qué hace | Usa en la base |
|---|---|---|---|
| Público | `GET /api/events` | Catálogo del Home (filtros por texto y categoría) | vista `v_public_events` |
| Público | `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` | Crear cuenta (siempre rol `user`) · iniciar sesión (JWT) · restaurar sesión — ver [`CONTRATO_API_AUTH.md`](CONTRATO_API_AUTH.md) | `users` |
| Usuario | `POST /api/events/:id/registrations` | Inscribirse | función `register_for_event` |
| Usuario | `DELETE /api/events/:id/registrations` | Cancelar inscripción | `UPDATE attendees SET status='cancelado'` |
| Usuario | `GET /api/me/registrations` · `PATCH /api/me` | Mi panel e historial · editar perfil | `attendees`, `users` |
| Agente | `POST/PATCH/DELETE /api/manager/events` | Crear, editar, eliminar, **precio**, **disponibilidad**, aforo | `events` (el trigger protege el aforo) |
| Agente | `GET /api/manager/events/:id/attendees` · `POST` · `PATCH …/checkin` | Lista de inscritos, alta manual, check-in | `attendees` |
| Agente | `/api/manager/tasks` (CRUD) | Tablero Kanban | `tasks` |
| Admin | `GET /api/admin/stats` | Dinero, ingresos por categoría, crecimiento, ocupación | `v_event_stats`, `v_revenue_by_type`, `v_user_growth_monthly`, `v_global_occupancy` |
| Admin | `GET /api/admin/accounts` | Tabla de cuentas con filtros y paginación | `users` |
| Admin | `POST /api/admin/accounts` · `PATCH …/:id/role` · `PATCH …/:id/status` · `DELETE …/:id` | Crear Agente · cambiar rol · activar/suspender · eliminar | `users` · función `admin_delete_account` |

> El Admin **no** tiene rutas de eventos: es la regla de negocio de la v6 y la API debe hacerla cumplir (el frontend no basta).

### Ejemplos de referencia (no ejecutados; adáptenlos)
```js
// src/db.js
require("dotenv").config();
const { Pool } = require("pg");
module.exports = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
```
```js
// Inscribirse: SIEMPRE con parámetros ($1, $2), nunca pegando texto en el SQL (evita inyección SQL)
router.post("/events/:id/registrations", authenticate, requireRole("user"), async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT register_for_event($1, $2) AS id", [req.params.id, req.user.id]);
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    if (e.code === "P0001") return res.status(409).json({ error: e.message });   // regla de negocio: mensaje en español
    console.error(e);
    res.sendStatus(500);                                                           // otros errores: no filtrar detalles
  }
});
```
**Trampa clásica:** `pg` devuelve los `BIGINT` (como `SUM`) **como texto**. Conviértanlos con `Number(...)` antes de mandarlos al frontend.

### Reglas de seguridad (checklist de la API)
- [ ] Contraseñas con **bcrypt** (`bcryptjs.compare`). Los hashes del seed `$2a$…` son compatibles.
- [ ] **JWT** con expiración corta; el rol sale del token, pero el **estado** (`activo`/`suspendido`) se consulta en la base: así una cuenta suspendida deja de funcionar al instante.
- [ ] Mapeo de roles: la base dice `agent`; el frontend dice `manager`. Háganlo en un solo lugar.
- [ ] Validar toda entrada con `zod`; consultas **siempre parametrizadas**.
- [ ] Login: mismo mensaje para “correo no existe” y “clave incorrecta”; limitar intentos.
- [ ] `cors` solo para el dominio del frontend; `helmet` activado.
- [ ] Registrar en `audit_log` las acciones del Admin (suspender, eliminar) y del Agente (cambiar precio, eliminar evento).
- [ ] Opcional (mejor práctica): crear en Neon un **rol de base de datos** solo para la API, sin permiso de borrar tablas.

---

## 6. Conectar el frontend (Fase 4) — el cambio más grande

Hoy todo es **síncrono** (`UserApp.register(id)` responde al instante). Con una API todo pasa a ser **asíncrono**: hay que esperar, mostrar “cargando” y manejar errores. No se reescribe todo: se avanza **por módulos**, siempre con la app funcionando.

1. Crear `js/api.js` con `api.get/post/patch/delete` (usa `fetch`, agrega el token, maneja errores).
2. Servir el frontend desde un servidor (no abrir `index.html` con doble clic: `file://` choca con CORS).
3. Orden sugerido (cada paso es entregable y demostrable):
   1. **Home**: `GET /api/events` en lugar de `Data.events`.
   2. **Login real**: ya está hecho en el frontend (`AuthModal` + `core/auth-service.js`); solo pon `USE_MOCK = false`. Conserva el aviso de cuenta suspendida (`403`).
   3. **Inscribirse / cancelar** (`EventModal.confirm`) con `async/await`; mostrar el mensaje de error de la API si no hay cupo.
   4. **Mi panel** (inscripciones, historial, perfil).
   5. **Agente**: eventos, asistentes/check-in, aforo, tareas, calendario.
   6. **Admin**: Finanzas (`/admin/stats`) y Cuentas.
4. `Data` se vuelve un **caché** de lo que trae la API; tras cada respuesta se llama `rerender()`.
5. Eliminar los datos falsos de `data.js` solo al final.

```js
// Ejemplo de cómo cambia EventModal.confirm()
async confirm() {
  this.busy = true; rerender();
  try { await api.post(`/events/${this.eventId}/registrations`); this.done = true; }
  catch (e) { this.error = e.message; }          // "Este evento se quedó sin cupos."
  this.busy = false; rerender();
}
```

---

## 7. Despliegue (Fase 5)
- **Frontend**: hosting estático (GitHub Pages, Netlify o Vercel).
- **API**: un servicio que corra Node (Render, Railway, Fly.io o funciones de Vercel). *No verifiqué los planes gratuitos actuales de estos servicios; confírmenlo antes de decidir.*
- `DATABASE_URL` y `JWT_SECRET` se configuran en el **panel del servicio** (variables de entorno), no en el repositorio.
- Ajustar CORS al dominio real y probar todo con HTTPS.

---

## 8. Cronograma sugerido (equipo de 3–4)

| Fase | Entregable | Horas (est.) | Está “terminada” cuando… |
|---|---|---|---|
| 0. Preparación | Repo con `.gitignore`, reparto de roles del equipo | 1 | Nadie puede subir un `.env` por error |
| 1. Neon | Proyecto creado, equipo invitado | 1–2 | Todos entran a la consola |
| 2. Tablas y datos | 001 + 002 corridos | 1–2 | `003_checks.sql` coincide en los 6 números |
| 3. API | Endpoints de la sección 5 | 14–20 | Probados con Postman/Thunder Client por rol |
| 4. Frontend | Conectado módulo por módulo | 10–14 | Sin `Data.*` falso; recargar no pierde nada |
| 5. Despliegue | App pública en HTTPS | 3–4 | Funciona desde otro computador |
| 6. Pruebas y ensayo | Guion de demo + capturas | 4–6 | Demo completa sin tropiezos |
| **Total** | | **≈ 35–50 h** | |

**Reparto sugerido:** una persona de base de datos/seguridad (fases 1–2 y 5), dos de API (por rol) y una de integración con el frontend. Rotar para que **todos** puedan explicar la base.

---

## 9. Riesgos

| Riesgo | Qué hacer |
|---|---|
| Subir la contraseña de la base a GitHub | `.gitignore` con `.env`. Si ocurre: en Neon **reseteen la contraseña del rol** de inmediato y cambien la cadena |
| La base “dormida” en plena exposición | Abrir la app 5 minutos antes; tener plan B con capturas |
| Pasar de 0,5 GB o de las horas de cómputo | Muy improbable aquí; revisar el consumo en la consola |
| Datos dañados por experimentar | Crear un *branch* `dev` en Neon y probar ahí; `main` solo para lo estable |
| Borrar la base por error | Scripts en Git (`000`–`003`) + ventana de recuperación de 6 h |
| Frontend y API desalineados | Documentar cada endpoint (tabla de la sección 5) y probar por rol |
| Una sola persona entiende la base | Rotar tareas; todos leen la sección 3 |

---

## 10. Guion para mostrar al docente
1. Abrir **Neon → Tables**: mostrar las 8 tablas y el diagrama de la sección 3.
2. Como **Usuario**, inscribirse a un evento en la app → en el SQL Editor: `SELECT * FROM attendees ORDER BY registered_at DESC LIMIT 1;` aparece la fila.
3. Como **Agente**, cambiar el precio de un evento y pausar inscripciones → verlo en el Home y en la base.
4. Como **Admin**, ver Finanzas y suspender una cuenta → esa cuenta ya no puede entrar.
5. Intentar bajar el aforo por debajo de los inscritos → mostrar que la **base** lo rechaza (consulta 5a de `003_checks.sql`).
6. Recargar la página: **los datos siguen ahí** (lo que antes no pasaba).

---

## 11. Si el docente exige otra cosa
Preguntas útiles para confirmar antes de empezar:
- ¿Es obligatorio **Neon** o vale cualquier PostgreSQL? (Los scripts sirven en cualquiera.)
- ¿Piden un **diagrama entidad-relación** formal y/o **normalización** documentada? (La sección 3 ya los tiene; se puede exportar a dbdiagram.io.)
- ¿Debe usarse un **ORM** (Prisma, Drizzle, Sequelize)? Se puede generar el modelo a partir de estas tablas.
- ¿Se evalúa **seguridad** (roles, hashing, inyección SQL)? Usen la checklist de la sección 5.
- ¿Hay que entregar **respaldo/exportación**? Con la cadena directa: `pg_dump "$DATABASE_URL" > respaldo.sql`.

---

## Apéndice — qué se verificó y qué no
**Verificado (octubre 2026):** límites del plan gratis y concepto de conexión *pooled* vs directa, en la [página de precios](https://neon.com/pricing) y la [documentación de conexión de Neon](https://neon.com/docs/get-started/connect-neon).
**Validado offline:** coherencia de `001`/`002`/`000` (columnas, FK, índices, balance de paréntesis y `$$`, unicidad de correos, cantidades de valores) y que las cifras de `003_checks.sql` salen del propio seed.
**NO verificado:** ejecución real en PostgreSQL/Neon (ver aviso en la sección 4), nombres exactos de los menús de la consola de Neon (pueden cambiar) y los planes gratuitos de los servicios de hosting.
