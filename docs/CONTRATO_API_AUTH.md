# Contrato de la API de autenticación (Node/Express + PostgreSQL)

El frontend ya está listo: **no tienes que tocar ningún componente**. Solo implementas estas rutas y cambias una línea.

## Conectar en 3 pasos
1. Implementa las rutas de la sección 2 (hay un ejemplo en la sección 5).
2. En `js/core/auth-service.js`:
   ```js
   const AuthConfig = {
     USE_MOCK: false,                       // ← antes true
     API_BASE: "http://localhost:3000/api", // ← o "/api" si Express también sirve el frontend
     ...
   ```
3. Abre la app, inicia sesión con una cuenta del seed (`user@eventpro.com` / `123456`) y listo.

> Si el frontend y la API están en **orígenes distintos** (ej. `localhost:5500` y `localhost:3000`) habilita CORS en Express para ese origen (`cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true })`).

Cuando todo funcione, **elimina** `MOCK_CREDENTIALS` (en `js/data.js`), `MockAuthServer` (en `auth-service.js`) y el cuadro «Modo demo» desaparece solo.

---

## 1. Credenciales de prueba (modo mock = seed SQL)
| Rol | Correo | Contraseña | Entra a |
|---|---|---|---|
| Administrador | `admin@eventpro.com` | `123456` | Finanzas y estadísticas |
| Agente | `agente@eventpro.com` | `123456` | Dashboard operativo |
| Usuario | `user@eventpro.com` | `123456` | Home con su avatar |

Con el mock, **cualquier cuenta** de Admin → Gestión de cuentas también entra con `123456`. El seed SQL (`backend/db/013_datos_demo.sql`) usa los mismos correos y la misma contraseña, así que las pruebas siguen valiendo con la base real.

---

## 2. Rutas

| Método y ruta | Body | Éxito | Errores |
|---|---|---|---|
| `POST /api/auth/login` | `{ email, password }` | `200 { token, user }` | `401` datos incorrectos |
| `POST /api/auth/register` | `{ identificacion, name, email, password, cityId, address?, phone? }` | `201 { token, user }` | `409` correo repetido · `422` datos inválidos |
| `POST /api/auth/forgot-password` | `{ email }` | `200 { message }` (siempre) | — |
| `GET /api/auth/me` | — (`Authorization: Bearer <token>`) | `200 { user }` | `401` sesión vencida |
| `POST /api/auth/logout` | — | `200 { ok: true }` | — |

**`user`** siempre tiene esta forma:
```json
{ "id": "a0000000-…", "name": "Carlos Mejía", "email": "user@eventpro.com", "role": "user" }
```
`role` ∈ `"user"` · `"agent"` · `"admin"`. El front muestra `agent` como el panel del Agente. **Cualquier otro valor se rechaza** en el front («Respuesta inesperada del servidor»).

**Errores** — cuerpo JSON opcional:
```json
{ "error": "Mensaje en español para el usuario", "code": "ACCOUNT_SUSPENDED", "fields": { "email": "Ya existe una cuenta con este correo." } }
```
- `error`: se muestra en el aviso rojo del formulario.
- `fields` (opcional): se muestra **debajo de cada campo** (409/422). Si llega `fields`, no se muestra el aviso general.
- `code`: libre; solo para tu depuración.

### Cómo reacciona la interfaz
| Respuesta | Lo que ve el usuario |
|---|---|
| `200/201` | Entra: Admin → Finanzas · Agente → Dashboard operativo · Usuario → Home (y, si venía de «Inscribirse», vuelve a abrirse ese evento) |
| `401` en login | «Correo o contraseña incorrectos.» (se limpia la clave y el foco vuelve a ella) |
| `403` | Aviso con tu `error` (ej. cuenta suspendida); se conserva lo escrito |
| `409/422` con `fields` | Mensaje bajo cada campo |
| `429` | «Demasiados intentos…» (si no mandas `error`) |
| `5xx` o JSON ilegible | «Algo salió mal en el servidor…» |
| Sin red / CORS | «No se pudo conectar con el servidor…» |
| `401` en `/me` al abrir la página | Se descarta el token y se queda como visitante |

---

## 3. Reglas que debe cumplir el backend (el front NO es seguridad)
1. **Registro público = solo `user`.** Ignora/rechaza cualquier `role` en el body. El front nunca lo envía.
2. **Mismo mensaje** si el correo no existe o la clave es incorrecta (`401`). Así no se pueden enumerar cuentas. Revisa `status` **después** de verificar la clave (`403`).
3. **Contraseñas con bcrypt** (`password_hash`). El seed ya genera hashes `$2a$…` compatibles con `bcryptjs`.
4. **Repite la validación** del front: nombre (2+ palabras), correo válido, clave de 8+ caracteres con letras y números (`AuthConfig.RULES`).
5. **JWT corto** (ej. 2 h) con `{ sub, role }`. En **cada** petición protegida vuelve a consultar `users.status`: si el Admin suspende o elimina una cuenta, deja de funcionar al instante.
6. **Limita intentos** de login (ej. `express-rate-limit`) y activa `helmet`.
7. `forgot-password` responde `200` **siempre**, exista o no el correo.
8. Mapeo de roles: base de datos `agent` = API `agent` = pantalla del Agente.

### ¿Token o cookie?
- **Token (por defecto, `USE_COOKIES: false`)**: el JWT se guarda en `sessionStorage` y viaja en `Authorization: Bearer`. Simple de depurar.
- **Cookie httpOnly (`USE_COOKIES: true`)**: más segura frente a XSS. Tu API hace `res.cookie("token", jwt, { httpOnly: true, sameSite: "lax", secure: true })`; el front usa `credentials: "include"` y no toca el token. Con orígenes distintos necesitas `cors({ credentials: true })` y `SameSite=None; Secure`.

---

## 4. Lo que todavía es simulación en el panel del Admin
Gestión de cuentas (Crear Agente, Cambiar rol, Suspender/Activar, Eliminar) modifica `Data.accounts` en memoria. Cuando las tengas, reemplaza esas funciones en `js/pages/admin/accounts.js` (cada una trae un comentario con la ruta):

| Acción | Ruta sugerida | Base de datos |
|---|---|---|
| Listar | `GET /api/admin/accounts?role=&status=&q=&page=` | `users` |
| Crear Agente | `POST /api/admin/accounts` `{ name, email, password, role: "agent" }` | `INSERT INTO users` |
| Cambiar rol | `PATCH /api/admin/accounts/:id/role` `{ role }` | `UPDATE users SET role` |
| Suspender / activar | `PATCH /api/admin/accounts/:id/status` `{ status }` | `UPDATE users SET status` |
| Eliminar | `DELETE /api/admin/accounts/:id` | `SELECT admin_delete_account($admin, $id)` |

Todas con `authenticate` + `requireRole("admin")`. **Crear administradores** no se expone en la interfaz a propósito: se hace a mano en la base.

---

## 5. Ejemplo de referencia (Express + pg) — no ejecutado, adáptalo
```js
// src/routes/auth.js
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const pool = require("../db");                       // new Pool({ connectionString: process.env.DATABASE_URL })

const DUMMY_HASH = bcrypt.hashSync("no-existe", 10);  // para comparar aunque el correo no exista
const sign = (u) => jwt.sign({ sub: u.id, role: u.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "2h" });
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const email = z.string().trim().toLowerCase().email();

const registerSchema = z.object({
  name: z.string().trim().refine((v) => v.split(/\s+/).filter((w) => w.length >= 2).length >= 2, "Escribe tu nombre completo (nombre y apellido)."),
  email,
  password: z.string().min(8, "Usa al menos 8 caracteres.").regex(/[A-Za-z]/, "Incluye letras y números.").regex(/\d/, "Incluye letras y números."),
}).strict();                                          // .strict(): si llega "role" u otro campo extra → 422

router.post("/login", async (req, res) => {
  const parsed = z.object({ email, password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  const { rows } = await pool.query(
    "SELECT id, name, email, role, status, password_hash FROM users WHERE lower(email) = $1", [parsed.data.email]);
  const u = rows[0];
  const ok = await bcrypt.compare(parsed.data.password, u ? u.password_hash : DUMMY_HASH);
  if (!u || !ok) return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  if (u.status !== "activo")
    return res.status(403).json({ error: "Tu cuenta está suspendida. Contacta al administrador de la plataforma.", code: "ACCOUNT_SUSPENDED" });
  await pool.query("UPDATE users SET last_login_at = now() WHERE id = $1", [u.id]);
  res.json({ token: sign(u), user: publicUser(u) });
});

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    const fields = {};
    for (const i of parsed.error.issues) fields[i.path[0] ?? "form"] ??= i.message;
    return res.status(422).json({ error: "Revisa los datos del formulario.", fields });
  }
  const { name, email: mail, password } = parsed.data;
  try {
    const { rows } = await pool.query(                // el rol va fijo en el SQL: el cliente no puede elegirlo
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'user') RETURNING id, name, email, role",
      [name, mail, await bcrypt.hash(password, 10)]);
    res.status(201).json({ token: sign(rows[0]), user: publicUser(rows[0]) });
  } catch (e) {
    if (e.code === "23505")                           // violación de users_email_unique
      return res.status(409).json({ error: "Ya existe una cuenta con este correo.", fields: { email: "Ya existe una cuenta con este correo." } });
    throw e;
  }
});

router.post("/forgot-password", (_req, res) =>        // siempre 200 (y aquí enviarías el correo si existe)
  res.json({ message: "Si ese correo está registrado, te enviamos instrucciones para restablecer tu contraseña." }));

async function authenticate(req, res, next) {
  try {
    const payload = jwt.verify((req.headers.authorization || "").replace(/^Bearer /, ""), process.env.JWT_SECRET);
    const { rows } = await pool.query("SELECT id, name, email, role, status FROM users WHERE id = $1", [payload.sub]);
    if (!rows[0] || rows[0].status !== "activo") return res.status(401).json({ error: "Sesión inválida." });
    req.user = rows[0];
    next();
  } catch { res.status(401).json({ error: "Sesión inválida." }); }
}
router.get("/me", authenticate, (req, res) => res.json({ user: publicUser(req.user) }));
router.post("/logout", (_req, res) => res.json({ ok: true }));   // JWT sin estado: el front descarta el token

module.exports = { router, authenticate };
```
Probar sin el frontend:
```bash
curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"user@eventpro.com","password":"123456"}'
```
> Los mensajes por defecto de `zod` están en inglés: personalízalos como en el ejemplo para que lleguen en español al formulario.
