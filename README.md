# EventPro — HTML, CSS y JavaScript puro + API Node/PostgreSQL

Sistema de organización de eventos con cuatro experiencias: **Home** (visitantes y usuarios), **panel de Agente** (operación, comisiones y demanda) y **panel de Administrador** (finanzas, reportes y cuentas).
El frontend no usa frameworks; el backend es Node/Express con PostgreSQL (Neon).

## Cómo ejecutarlo
1. `npm install`
2. Copia `.env.example` como `.env` y pon tu `DATABASE_URL` de Neon.
3. En el *SQL Editor* de Neon ejecuta, en orden: `backend/db/001_schema.sql`, `002_seed.sql`, **`004_payments.sql`** (y `005_payments_checks.sql` para verificar).
4. `npm start` → API en `http://localhost:3000`.
5. Abre `index.html` (mejor con la extensión *Live Server* de VS Code). Si el backend está apagado, la página lo avisa con un banner y un botón «Reintentar».

Otra dirección de API: define `window.EVENTPRO_API_URL` antes de los scripts (ver `js/config.js`).

**Novedades de V8 (pagos y cálculo):** checkout con pago simulado, zonas y puntos, fila virtual, comisiones del Agente, reporte de ingresos 2026 por integral, estados «Últimos cupos/Agotado» y precios dinámicos. Todo explicado en **[`docs/PAGOS_Y_CALCULO.md`](docs/PAGOS_Y_CALCULO.md)**.

> Las fuentes y las fotos de los eventos vienen de internet; sin conexión la app funciona con fuentes del sistema y sin fotos.

## Estructura
```
eventpro-html/
├── index.html                 página única; carga CSS y scripts en orden
├── css/
│   ├── base.css               colores (variables), reset, layout general
│   ├── components.css         botones, tarjetas, badges, formularios, modales, tablas, sidebar
│   ├── pages.css              estilos propios de cada pantalla
│   └── checkout.css           checkout, fila virtual, avisos, liquidación, reporte y tráfico
├── backend/                   API (app.js, routes/, controllers/, lib/ con el cálculo, config/business.js, db/*.sql)
├── tests/                     pruebas (npm test)
└── js/
    ├── config.js              API_URL, api.get/post…, avisos (Toast)  ← se carga primero
    ├── data.js                etiquetas, colores y datos (los eventos reales llegan de la API)
    ├── utils.js               formato (COP, fechas), iconos SVG, helpers de formularios y eventos
    ├── components/            sidebars, event-modal, checkout-modal, virtual-queue, auth/…
    ├── pages/
    │   ├── agent.js           chat del asistente (pestaña «Asistente» de Mi panel)
    │   ├── admin/             dashboard (finanzas), accounts (cuentas), profile
    │   ├── manager/           manager (estado, inicio, aforo, asistentes), events, calendar, tasks
    │   └── user/              user-app (estado e inscripciones), user-account (Mi panel)
    └── app.js                 estado global, navegación y dibujado (se carga al final)
```
**El orden de los `<script>` en `index.html` importa:** `config` → `data` → `utils` → componentes → páginas → `app`.

## Roles y navegación (v6)
| Rol | Qué ve | Archivos |
|---|---|---|
| **Visitante / Usuario** | El **mismo Home** (carrusel, buscador, filtros). Con sesión, el Navbar muestra el avatar con menú (Mi panel, Mis inscripciones, Historial, Perfil y configuración, Cerrar sesión) y las tarjetas muestran «Inscrito». «Mi panel» es una vista aparte con botón «Volver a explorar eventos». | `pages/public/guest-home.js`, `pages/user/user-app.js`, `pages/user/user-account.js` |
| **Agente** (operación total) | Dashboard operativo · Gestión de eventos (crear, editar, eliminar, **precio**, **disponibilidad**) · Calendario · Cupos y aforo · Asistentes (lista + check-in + alta manual) · Tareas | `pages/manager/*` |
| **Administrador** (finanzas y cuentas) | Finanzas y estadísticas (dinero recaudado, ingresos por categoría, crecimiento de usuarios, ocupación global) · Gestión de cuentas (filtrar por rol/estado, activar/desactivar, eliminar) · Perfil. **No** opera eventos. | `pages/admin/*` |

**Modal de evento único** (`components/event-modal.js`): lo dibuja `PublicLayout` sobre el Home. Su estado es solo `EventModal.eventId` (+ `done`/`error`) y el evento se lee siempre de `Data.events`. Flujo del visitante: «Inscribirse» → `Guard.promptLogin` guarda `Guard.pending = { eventId }` → login → `Guard.resume` entra a la sesión, redibuja el Home y recién ahí llama `EventModal.open(eventId)`.
La caja de cupos usa la clase `.evm-info` (`css/panels.css`) con variables de tema: gris suave en claro; fondo translúcido + borde sutil + texto claro en oscuro.

**Datos conectados entre roles** (`js/data.js`):
- `ev.price` (COP, 0 = gratis). Recaudo = `price × registered` (`eventRevenue(ev)`); lo calcula el Admin en vivo.
- Inscribirse / cancelar (`UserApp.register/unregister`) cambia `ev.registered` y crea/quita al asistente: el Agente lo ve en «Asistentes» y el Admin en las cifras.
- `Data.accounts` (usuarios y agentes). Si el Admin **suspende o elimina** una cuenta demo (Carlos Mejía / Carmen López), el login la rechaza.
- Imágenes de los eventos nuevos: URLs de Unsplash; si alguna no carga se ve el degradado del tipo. Cámbialas en el campo `image` de cada evento.

## Autenticación (Login / Registro)
`AuthModal` (diseño dividido, modo claro/oscuro) reemplaza los antiguos atajos por rol. Código en `js/components/auth/` (`LoginForm`, `RegisterForm`, `ForgotForm`, `AuthModal`), estado en `js/core/session.js` (`Session`, `AuthFlow`, `Guard`) y peticiones en `js/core/auth-service.js`.
- **Probar ahora (modo mock):** `admin@eventpro.com`, `agente@eventpro.com`, `user@eventpro.com`, contraseña `123456`.
- **Conectar tu backend:** `AuthConfig.USE_MOCK = false` y `API_BASE`. Contrato y ejemplo en [`docs/CONTRATO_API_AUTH.md`](docs/CONTRATO_API_AUTH.md).
- El registro público solo crea cuentas **Usuario**; el Admin crea Agentes y cambia roles desde «Gestión de cuentas».

## Base de datos (Neon / PostgreSQL)
El plan completo para principiantes está en **[`docs/PLAN_BASE_DE_DATOS_NEON.md`](docs/PLAN_BASE_DE_DATOS_NEON.md)**.
Scripts listos en `backend/db/` (se ejecutan en este orden en el *SQL Editor* de Neon): `001_schema.sql` (tablas, reglas y vistas) → `002_seed.sql` (datos de prueba equivalentes a `js/data.js`) → `003_checks.sql` (verificación). `000_reset.sql` borra todo para empezar de nuevo. `backend/legacy/` conserva la migración del modelo anterior solo como referencia.
La app lee y escribe todo en la base a través de la API (`backend/`).

## Cómo funciona (para entender el código)
- Cada pantalla es un objeto con un método `render()` que **devuelve HTML como texto** (template literals).
- `App.render()` pone ese HTML dentro de `<div id="root">`. Conserva el scroll y el cursor del buscador.
- Los botones llevan atributos como `data-click="events:openNew"`. Un único "escuchador" global
  busca la función registrada con `registerClick({ "events:openNew": () => {...} })`.
- Los campos de texto usan `data-input="..."`. Al cambiar algo en el estado, se llama `rerender()`.

Ejemplo: para agregar un botón nuevo
```js
// en el HTML de la página:
<button class="btn btn-primary" data-click="miPagina:saludar">Saludar</button>
// al final del archivo de la página:
registerClick({ "miPagina:saludar": () => alert("¡Hola!") });
```

## Limitaciones actuales
- **Seguridad (pendiente por decisión del equipo):** no hay login real ni permisos por rol en la API; el servidor confía en el `userId` del navegador. Cerrar esto es lo primero antes de publicar.
- El asistente responde con textos predefinidos (no es IA real).
- El estado de la fila virtual vive en la memoria del servidor (un solo proceso).
- La pasarela de pago es **simulada**: no se cobra dinero real.

## Novedades: Home público y rol Agente
- Modo **guest** (por defecto): `pages/public/guest-home.js`. "Inscribirse"/"Ver detalles" llevan `data-requires-auth`; el guard en `utils.js` abre el modal de login (`core/session.js`) y, al entrar, abre el modal del evento.
- Rol **Agente** (`manager`): `pages/manager/*` + `ManagerSidebar`. Ahora opera **todos** los eventos (ya no hay asignaciones por evento; `Data.eventAgents` se eliminó).
- "Cambiar a Admin/Usuario" ahora es "Cerrar sesión". El login es simulado (3 accesos demo).
- `backend/` trae la migración SQL y el middleware de referencia (no se ejecutan en la demo).

## Tema visual "Electric Campus" y carrusel Hero
**Paleta y tipografía** (todo en `css/base.css`, bloque `:root`; cambia un valor y cambia toda la app):

| Variable | Color | Uso |
|---|---|---|
| `--primary` | `#6a2cff` violeta eléctrico | botones, elementos activos, enlaces |
| `--blue` | `#2b6bff` azul vibrante | degradados, categoría Institucional |
| `--accent` | `#ff6a1a` naranja neón | llamadas a la acción (Inscribirme, Crear cuenta) |
| `--pink` | `#ff3d9a` rosa fiesta | degradados, categoría Cultural |
| `--teal` | `#10c2a0` verde agua | estados de éxito |
| `--lime` | `#c8f23d` lima | etiquetas "Destacado" |
| `--ink` / `--bg` | `#16123b` / `#f6f4ff` | texto principal / fondo limpio |

- Títulos: **Bricolage Grotesque** (`--font-title`). Texto: **Plus Jakarta Sans** (`--font-body`). Se cargan desde Google Fonts en `index.html`.
- Los nombres antiguos (`--forest`, `--olive`, `--sand`…) siguen existiendo como alias de los nuevos, para no romper el CSS anterior.
- Colores por tipo de evento: `TYPE_COLOR` / `TYPE_STYLE` en `js/data.js`.

**Carrusel Hero** (`js/pages/public/hero-carousel.js` + `css/hero-carousel.css`, sin librerías):
- Los slides se definen en `HERO_SLIDES` (`js/data.js`). Con `eventId` toma fecha, lugar y foto del evento y activa "Inscribirme" / "Ver detalles" (piden login).
- Para usar fotos propias: guárdalas en `img/hero/` y pon `image: "img/hero/concierto.jpg"` en el slide (ideal 1600×900 o más).
- Controles: flechas, puntos con barra de progreso, pausa/play, teclado (← →), swipe en móvil. Se pausa con el mouse encima, con el modal de login abierto y con la pestaña oculta. Respeta "reducir movimiento" del sistema.
- Para cambiar la velocidad: `DURATION` (milisegundos) en `HeroCarousel`.

## Layout público y Footer
Todas las vistas públicas se dibujan con `PublicLayout` (`js/components/public-layout.js`), que pone el **header**, el **footer** y los modales (login / avisos) alrededor del contenido de cada página:

```js
// js/pages/public/guest-home.js
render() {
  return PublicLayout.render(`<section>…contenido…</section>`, { overHero: true });
},
afterRender() { PublicLayout.afterRender({ overHero: true }); }
```
Para crear otra vista pública (FAQ, Ayuda…): devuelve `PublicLayout.render(contenido, { overHero: false })` (header sólido) y el footer aparece solo.

- **Footer:** `js/components/footer.js` (contenido en `FOOTER_LINKS`, `FOOTER_SOCIAL`, `NOTICES`) + `css/footer.css`. Fondo `--ink`; 4 columnas → 2 (≤1000px) → 1 (≤600px).
- **Redes sociales:** apuntan a las páginas principales de Instagram, TikTok y X como ejemplo. Cámbialas en `FOOTER_SOCIAL`.
- **Ayuda, Términos y Privacidad:** abren un aviso «en construcción» (`NOTICES`). Reemplázalos por páginas reales cuando existan.
- **Enlaces con mensaje de login:** cualquier elemento con `data-requires-auth` puede llevar `data-reason="…"` (texto del modal) y `data-suggest="manager"` (rol resaltado).

## Diseño de secciones (sin "huecos")
- Contenedor de 1520px centrado; en pantallas más anchas, cada sección es una **banda de color de borde a borde** (`.g-band`).
- Cómo funciona = collage de fotos + pasos · Categorías = tarjetas que filtran los eventos · Eventos = rejilla con última fila centrada · FAQ = acordeón.

## Búsqueda y filtros del Home
- **`js/components/search-bar.js`** (`SearchBar`): barra amplia con lupa, botón ✕ y botón «Buscar». Es genérica: recibe los nombres de las acciones (`input`, `clear`, `submit`).
- **`js/components/category-filters.js`** (`CategoryFilters`): píldoras clickeables (Todos · Académico · Deportes · Cultura · Fiestas · Comunidad UCEVA). La activa se resalta con el degradado de su categoría y pulsarla otra vez quita el filtro.
- La búsqueda ignora tildes y mayúsculas, exige todas las palabras y mira nombre, lugar, coordinador, tipo y categoría. Los números de las píldoras se actualizan con lo que escribes.
- **Mientras escribes solo se repintan los resultados** (`GuestHome.paint()`): el campo conserva el foco y el carrusel no se reinicia.
- **Categorías** (`HOME_CATEGORIES` en `js/data.js`): cada evento pertenece a las categorías cuyo `types` incluya su tipo, o a las que liste a mano en `ev.categories`. Ej.: el Festival de Música Andina es `["cultura", "fiestas"]`. «Fiestas» no tiene tipo propio: se asigna con `categories`.

## Modo claro / oscuro
- **`js/core/theme.js`** (`Theme`): equivale a un `useTheme` / `ThemeProvider`. `Theme.get()`, `Theme.isDark()`, `Theme.set("dark")`, `Theme.toggle()`.
- El tema vive en `<html data-theme="light|dark">` y se guarda en `localStorage` (`eventpro-theme`). Sin elección guardada se usa la preferencia del sistema y se sigue si cambia. Un script en `<head>` lo aplica antes de pintar (sin parpadeo).
- **`js/components/theme-toggle.js`** (`ThemeToggle`): switch sol ☀ / luna ☾ en el Navbar y en los 3 menús laterales (Admin, Usuario, Agente). Cambiar el tema no redibuja la página.
- **Colores**: todo sale de variables en `css/base.css`. El bloque `:root[data-theme="dark"]` redefine las mismas variables (equivale a `dark:` de Tailwind). Ajustes finos en `css/theme.css`.
- **Regla para no romper el modo oscuro**: no escribas colores fijos de texto o fondo. Usa `var(--text)`, `var(--muted)`, `var(--muted-2)`, `var(--surface)`, `var(--bg)`, `var(--border)`, `var(--primary)` (rellenos) y `var(--primary-fg)` (violeta como texto). `--ink` y `--on-dark` son constantes (hero, footer).
- Contraste verificado (WCAG): texto ≥ 15:1, secundario ≥ 5.3:1, violeta como texto 6.1:1 (claro) y 6.4:1 (oscuro), blanco sobre botón violeta 6.1:1 / 5.2:1, y texto blanco sobre las categorías ≥ 4.5:1.

## Layout de escritorio y responsive
**Contenedor y márgenes** (`css/base.css`, bloque «Layout»):
- `--container: 1680px`: ancho máximo del bloque de contenido. Cámbialo ahí para hacerlo más ancho o más angosto en toda la app.
- `--gutter-x`: margen lateral progresivo → 16px (móvil) · 24px (≥640px) · 48px (≥1024px). Equivale a `px-4 sm:px-6 lg:px-12`.
- **Home público**: Navbar, hero, bandas de color y footer ocupan el 100% del ancho; su contenido interno se alinea con la misma guía (`--gutter` en `css/guest.css`).
- **Paneles**: cada pantalla usa `.page` (centrada, hasta 1680px; las de formularios usan un `--w` menor).

**Puntos de quiebre**: 640px · 768px · **1024px** (aparece el menú lateral fijo) · 1240px.

**Navbar público** (`js/components/public-layout.js`): ≥1024px enlaces + tema + botones en una fila; <1024px solo logo + ☰, y un *drawer* con los enlaces, el modo oscuro y «Iniciar sesión / Crear cuenta». Estado: `PublicLayout.menuOpen` · `setMenu(true|false)`.
**Paneles** (`js/components/app-shell.js`): ≥1024px menú lateral fijo; <1024px barra superior con ☰ y menú off-canvas. Estado: `AppShell.open` · `setOpen(true|false)`.
- Ambos se cierran con ✕, tocando el fondo, con **Esc**, al elegir una opción o al agrandar la ventana. Solo cambian clases del DOM (no redibujan la pantalla), manejan el foco, `aria-expanded` e `inert` para teclado y lectores de pantalla.

**Móvil** (`css/responsive.css` + reglas de `guest.css`, `search.css`, `hero-carousel.css`, `footer.css`):
- Píldoras en **una sola fila** con scroll táctil y sin barra (`.cf`, y `.scroll-x` en los filtros de los paneles).
- Hero con título escalado (`clamp(28px, 8.4vw, 40px)` en móvil → 88px en escritorio) y botones a todo el ancho.
- Tarjetas de eventos en 1 columna (2 desde 640px, 3 desde 1024px, 4 desde 1240px) con botones `width:100%` y `min-height:48px`.
- Botones, píldoras y opciones de menú con `min-height:44px`; campos de 16px (evita el zoom de iOS).
- Tablas con scroll horizontal **dentro** de su tarjeta (`.table-scroll`); modales de formulario como hoja inferior.
- Sin scroll horizontal: `overflow-x:hidden` en `html`, `body`, `#root`, `.app` y `.main`; las rejillas usan `minmax(0, 1fr)` para poder encogerse.
- Alto dinámico: `100dvh` / `92svh` (descuentan la barra del navegador móvil).
