# EventPro — HTML, CSS y JavaScript puro

Sistema de organización de eventos con tres modos: **landing**, **panel de administrador** y **portal de usuario**.
No usa frameworks, ni Node, ni instalación: solo HTML, CSS y JavaScript.

## Cómo abrirlo
1. Descomprime la carpeta.
2. Haz doble clic en **`index.html`**. Se abre en tu navegador.

Opcional, para desarrollar cómodo en Visual Studio Code: instala la extensión **Live Server**,
clic derecho sobre `index.html` → **Open with Live Server**. La página se recarga sola al guardar.

> Las fuentes (Fraunces e Inter) y las fotos de los eventos vienen de internet. Sin conexión
> la app funciona igual, pero con fuentes del sistema y sin fotos.

## Estructura
```
eventpro-html/
├── index.html                 página única; carga CSS y scripts en orden
├── css/
│   ├── base.css               colores (variables), reset, layout general
│   ├── components.css         botones, tarjetas, badges, formularios, modales, tablas, sidebar
│   └── pages.css              estilos propios de cada pantalla
└── js/
    ├── data.js                datos de ejemplo + etiquetas y colores    ← aquí editas eventos/asistentes/tareas
    ├── utils.js               formato (COP, fechas), iconos SVG, helpers de formularios y eventos
    ├── components/sidebars.js menús laterales de admin y usuario
    ├── pages/
    │   ├── landing.js
    │   ├── agent.js           chat del asistente (admin y usuario)
    │   ├── admin/             dashboard, events, calendar, attendees, tasks, profile
    │   └── user/              user-app (estado), user-dashboard, user-events, user-my-events, user-profile
    └── app.js                 estado global, navegación y dibujado (se carga al final)
```
**El orden de los `<script>` en `index.html` importa:** `data` → `utils` → componentes → páginas → `app`.

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
- **No hay base de datos:** lo que creas o editas vive en memoria y se pierde al recargar la página.
- El asistente responde con textos predefinidos (no es IA real).
- Los botones "Guardar cambios" de los perfiles todavía no hacen nada.
- El diseño está pensado para pantalla de computador (no es responsive para celular).

## Siguientes pasos sugeridos
1. Guardar los datos con `localStorage` para que no se pierdan al recargar.
2. Hacer el diseño responsive con `@media` en `css/`.
3. Conectar un backend o base de datos (Supabase, Firebase, etc.).

## Novedades: Home público y rol Agente
- Modo **guest** (por defecto): `pages/public/guest-home.js`. "Inscribirse"/"Ver detalles" llevan `data-requires-auth`; el guard en `utils.js` abre el modal de login (`core/session.js`) y retoma la acción al entrar.
- Rol **Agente** (`manager`): `pages/manager/manager.js` + `ManagerSidebar`. Sidebar: Inicio, Mis Eventos, Control de Aforo, Asistentes. Asignaciones en `Data.eventAgents`.
- "Cambiar a Admin/Usuario" ahora es "Cerrar sesión". El login es simulado (3 accesos demo).
- `backend/` trae la migración SQL y el middleware de referencia (no se ejecutan en la demo).
