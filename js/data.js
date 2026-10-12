/* ==========================================================
   data.js — Datos de ejemplo y catálogos (etiquetas, colores)
   No hay backend: todo vive en memoria mientras la página esté abierta.
   ========================================================== */

const TYPE_LABEL = {
  academico: "Académico", institucional: "Institucional", investigacion: "Investigación",
  cultural: "Cultural", deportivo: "Deportivo",
};

// Color sólido por tipo de evento
const TYPE_COLOR = {
  academico: "#6a2cff", institucional: "#2563eb", investigacion: "#087f70",
  cultural: "#d61f69", deportivo: "#cc4100",
};

// Paleta completa por tipo (usada en calendario y portal de usuario)
const TYPE_STYLE = {
  academico:     { bg: "#6a2cff", gradient: "linear-gradient(135deg, #6a2cff, #8450ff)" },
  institucional: { bg: "#2563eb", gradient: "linear-gradient(135deg, #2563eb, #3f74ec)" },
  investigacion: { bg: "#087f70", gradient: "linear-gradient(135deg, #087f70, #0e9482)" },
  cultural:      { bg: "#d61f69", gradient: "linear-gradient(135deg, #d61f69, #e8407f)" },
  deportivo:     { bg: "#cc4100", gradient: "linear-gradient(135deg, #cc4100, #df5405)" },
};

// Imagen por defecto según el tipo de evento
const TYPE_IMAGES = {
  academico:     "https://images.unsplash.com/photo-1670382417551-d2f1ee29aea4?w=600&q=80",
  institucional: "https://images.unsplash.com/photo-1661693758705-4fa65572bced?w=600&q=80",
  investigacion: "https://images.unsplash.com/photo-1581093577421-f561a654a353?w=600&q=80",
  cultural:      "https://images.unsplash.com/photo-1719241368157-7c78535f3a92?w=600&q=80",
  deportivo:     "https://images.unsplash.com/photo-1662065931743-346f5058fe58?w=600&q=80",
};

// Texto de cada estado (los colores están en css/components.css, clases .st-*)
const STATUS_TEXT = {
  planificado: "Planificado", en_progreso: "En progreso", completado: "Completado", cancelado: "Cancelado",
  confirmado: "Confirmado", pendiente: "Pendiente",
};

const PRIORITY = {
  alta:  { text: "Alta",  dot: "#e5365a" },
  media: { text: "Media", dot: "#ff8a1f" },
  baja:  { text: "Baja",  dot: "#2b6bff" },
};

/* ---------- Slides del carrusel del Home público ----------
   - eventId: enlaza el slide con un evento (toma fecha, lugar y foto de Data.events
     y activa los botones "Inscribirme" / "Ver detalles", que piden iniciar sesión).
   - image (opcional): foto propia, por ejemplo "img/hero/concierto.jpg" (mejor 1600×900 o más).
   - highlight: palabra(s) del título que se pintan con el degradado de color.
   Sin eventId, el slide es de marca y muestra "Crear cuenta" / "Ver eventos". */
const HERO_SLIDES = [
  { eventId: "e4", tag: "Concierto · Cultural", title: "Vive la música andina en vivo", highlight: "música andina",
    text: "Una tarde de ritmos, tradición y buena energía con toda la comunidad universitaria." },
  { eventId: "e5", tag: "Deportes · En curso", title: "Juega, alienta y gana con tu facultad", highlight: "gana",
    text: "El torneo interfacultades donde el campus se llena de camisetas, barras y emoción." },
  { eventId: "e1", tag: "Académico · Destacado", title: "Ideas que mueven universidades", highlight: "mueven",
    text: "Conferencias, talleres y networking con quienes están transformando la academia." },
  { eventId: "e6", tag: "Arte · Exposición", title: "Arte contemporáneo para sentir", highlight: "sentir",
    text: "Recorre una muestra que mezcla creatividad, color y miradas jóvenes." },
  { eventId: "e2", tag: "Institucional · Celebración", title: "Celebra el logro de toda una carrera", highlight: "logro",
    text: "Una ceremonia para compartir con familia y amigos el gran día de los nuevos ingenieros." },
];

const Data = {
  events: [
  {
    id: "e1", name: "Cumbre de Innovación Académica 2026", type: "academico",
    date: "2026-09-15", time: "09:00", location: "Universidad Nacional, Bogotá",
    capacity: 500, registered: 342, status: "planificado",
    budget: 85000000, spent: 41200000, coordinator: "Sofía Navarro",
    description: "Congreso anual para docentes e investigadores de educación superior.",
    image: "https://images.unsplash.com/photo-1670382417551-d2f1ee29aea4?w=600&q=80",
  },
  {
    id: "e2", name: "Ceremonia de Grados — Facultad de Ingeniería", type: "institucional",
    date: "2026-08-30", time: "10:00", location: "Auditorio Central, U. de Antioquia",
    capacity: 800, registered: 620, status: "planificado",
    budget: 32000000, spent: 22500000, coordinator: "Isabela Ruiz",
    description: "Ceremonia oficial de graduación de los egresados de Ingeniería.",
    image: "https://images.unsplash.com/photo-1661693758705-4fa65572bced?w=600&q=80",
  },
  {
    id: "e3", name: "Simposio de Biotecnología Tropical", type: "investigacion",
    date: "2026-09-05", time: "08:00", location: "Centro de Convenciones, Medellín",
    capacity: 200, registered: 156, status: "en_progreso",
    budget: 45000000, spent: 38900000, coordinator: "Andrés Vega",
    description: "Presentación de avances en investigación de biotecnología tropical.",
    image: "https://images.unsplash.com/photo-1581093577421-f561a654a353?w=600&q=80",
  },
  {
    id: "e4", name: "Festival de Música Andina", type: "cultural",
    date: "2026-10-10", time: "14:00", location: "Teatro Jorge Eliécer Gaitán, Bogotá",
    capacity: 1200, registered: 892, status: "planificado",
    budget: 120000000, spent: 55300000, coordinator: "Carmen López",
    description: "Festival con agrupaciones de música andina colombiana.",
    categories: ["cultura", "fiestas"],   // un evento puede estar en varias categorías del Home
    image: "https://images.unsplash.com/photo-1719241368157-7c78535f3a92?w=600&q=80",
  },
  {
    id: "e5", name: "Torneo Interfacultades de Fútbol", type: "deportivo",
    date: "2026-08-22", time: "07:00", location: "Estadio Universitario El Campín",
    capacity: 300, registered: 210, status: "en_progreso",
    budget: 8000000, spent: 5200000, coordinator: "Valentina Serra",
    description: "Torneo deportivo entre facultades con categorías masculina y femenina.",
    image: "https://images.unsplash.com/photo-1662065931743-346f5058fe58?w=600&q=80",
  },
  {
    id: "e6", name: "Exposición de Arte Contemporáneo", type: "cultural",
    date: "2026-11-20", time: "16:00", location: "Museo de Arte Moderno, Bogotá",
    capacity: 400, registered: 187, status: "planificado",
    budget: 28000000, spent: 9000000, coordinator: "Rodrigo Fuentes",
    description: "Muestra de artistas emergentes colombianos en arte contemporáneo.",
    image: "https://images.unsplash.com/photo-1744948162834-45a60a6c0139?w=600&q=80",
  },
  {
    id: "e7", name: "Congreso Nacional de Derecho Ambiental", type: "institucional",
    date: "2026-10-25", time: "09:00", location: "Cámara de Comercio, Cali",
    capacity: 350, registered: 98, status: "planificado",
    budget: 55000000, spent: 12000000, coordinator: "Sofía Navarro",
    description: "Congreso con expertos en legislación y políticas ambientales.",
    image: "https://images.unsplash.com/photo-1652897995172-24a626202177?w=600&q=80",
  },
],

  attendees: [
  { id: "a1",  name: "María González",  email: "m.gonzalez@correo.co",  phone: "311 234 5678", eventId: "e1", eventName: "Cumbre de Innovación Académica 2026",    status: "confirmado", registeredAt: "2026-07-14" },
  { id: "a2",  name: "Carlos Pérez",    email: "c.perez@empresa.co",    phone: "322 345 6789", eventId: "e1", eventName: "Cumbre de Innovación Académica 2026",    status: "confirmado", registeredAt: "2026-07-20" },
  { id: "a3",  name: "Elena Martínez",  email: "elena.m@gmail.com",     phone: "333 456 7890", eventId: "e2", eventName: "Ceremonia de Grados — Fac. Ingeniería",  status: "confirmado", registeredAt: "2026-06-01" },
  { id: "a4",  name: "David Sánchez",   email: "d.sanchez@udea.edu.co", phone: "344 567 8901", eventId: "e3", eventName: "Simposio de Biotecnología Tropical",      status: "confirmado", registeredAt: "2026-08-05" },
  { id: "a5",  name: "Laura Jiménez",   email: "laura.j@outlook.com",   phone: "355 678 9012", eventId: "e4", eventName: "Festival de Música Andina",              status: "pendiente",  registeredAt: "2026-08-10" },
  { id: "a6",  name: "Miguel Romero",   email: "m.romero@unal.edu.co",  phone: "366 789 0123", eventId: "e1", eventName: "Cumbre de Innovación Académica 2026",    status: "pendiente",  registeredAt: "2026-08-12" },
  { id: "a7",  name: "Ana Flores",      email: "ana.flores@arts.co",    phone: "377 890 1234", eventId: "e4", eventName: "Festival de Música Andina",              status: "confirmado", registeredAt: "2026-08-08" },
  { id: "a8",  name: "Javier Torres",   email: "j.torres@mail.co",      phone: "388 901 2345", eventId: "e6", eventName: "Exposición de Arte Contemporáneo",       status: "confirmado", registeredAt: "2026-08-15" },
  { id: "a9",  name: "Patricia Moreno", email: "p.moreno@cali.edu.co",  phone: "399 012 3456", eventId: "e7", eventName: "Congreso Derecho Ambiental",             status: "cancelado",  registeredAt: "2026-08-01" },
  { id: "a10", name: "Roberto Díaz",    email: "r.diaz@innovate.co",    phone: "310 123 4567", eventId: "e5", eventName: "Torneo Interfacultades de Fútbol",        status: "confirmado", registeredAt: "2026-07-28" },
],

  tasks: [
  { id: "t1",  title: "Confirmar catering para 350 personas",  eventId: "e1", eventName: "Cumbre Académica",          assignee: "Sofía Navarro",   dueDate: "2026-08-25", priority: "alta",  status: "en_progreso", category: "Logística" },
  { id: "t2",  title: "Enviar citaciones a graduandos",        eventId: "e2", eventName: "Ceremonia de Grados",       assignee: "Isabela Ruiz",    dueDate: "2026-08-20", priority: "alta",  status: "completado",  category: "Comunicación" },
  { id: "t3",  title: "Reservar equipos audiovisuales",        eventId: "e3", eventName: "Simposio Biotecnología",    assignee: "Andrés Vega",     dueDate: "2026-08-28", priority: "media", status: "pendiente",   category: "Tecnología" },
  { id: "t4",  title: "Contratar sonido e iluminación",        eventId: "e4", eventName: "Festival Música Andina",    assignee: "Carmen López",    dueDate: "2026-09-10", priority: "alta",  status: "completado",  category: "Producción" },
  { id: "t5",  title: "Diseñar programa de actividades",       eventId: "e4", eventName: "Festival Música Andina",    assignee: "Carmen López",    dueDate: "2026-09-01", priority: "media", status: "en_progreso", category: "Contenido" },
  { id: "t6",  title: "Coordinar transporte de ponentes",      eventId: "e1", eventName: "Cumbre Académica",          assignee: "Sofía Navarro",   dueDate: "2026-09-10", priority: "media", status: "pendiente",   category: "Logística" },
  { id: "t7",  title: "Preparar canchas y uniformes",          eventId: "e5", eventName: "Torneo Interfacultades",    assignee: "Valentina Serra", dueDate: "2026-08-21", priority: "alta",  status: "completado",  category: "Deportes" },
  { id: "t8",  title: "Gestionar acreditaciones de prensa",    eventId: "e6", eventName: "Exposición de Arte",        assignee: "Rodrigo Fuentes", dueDate: "2026-11-05", priority: "baja",  status: "pendiente",   category: "Comunicación" },
  { id: "t9",  title: "Montar instalación museográfica",       eventId: "e6", eventName: "Exposición de Arte",        assignee: "Rodrigo Fuentes", dueDate: "2026-11-15", priority: "alta",  status: "pendiente",   category: "Montaje" },
  { id: "t10", title: "Revisar contrato con el venue",         eventId: "e7", eventName: "Congreso Derecho Ambiental",assignee: "Sofía Navarro",   dueDate: "2026-09-15", priority: "alta",  status: "en_progreso", category: "Administración" },
],

  // Inscripciones iniciales del usuario del portal
  userRegistrations: ["e4", "e5"],
};

/* ---------- Rol Agente (Event Manager): asignaciones y operación ---------- */
// Espejo de la tabla pivote event_agents (backend/002_agent_role.sql)
Data.eventAgents = [
  { eventId: "e3", agentId: "u-agent", revokedAt: null },
  { eventId: "e4", agentId: "u-agent", revokedAt: null },
  { eventId: "e5", agentId: "u-agent", revokedAt: null },
];
Data.events.forEach((e) => {
  e.availability = "open";                                   // open | paused | closed
  e.is_public = true;
  e.featured = ["e1", "e4", "e3"].includes(e.id);
});
Data.attendees.forEach((a) => { a.checkedInAt = null; });
(function seedAttendees() {
  const names = ["Camila Ortiz", "Sebastián Rojas", "Daniela Cruz", "Felipe Vargas", "Natalia Peña", "Julián Castro", "Valeria Gómez", "Mateo Herrera", "Sara Quintero"];
  ["e3", "e4", "e5"].forEach((eid, i) => names.slice(i * 3, i * 3 + 3).forEach((n, j) => {
    Data.attendees.push({
      id: `a${100 + i * 3 + j}`, name: n, email: `${n.split(" ")[0].toLowerCase()}@correo.co`, phone: `300 555 0${i}${j}0`,
      eventId: eid, eventName: Data.events.find((e) => e.id === eid).name,
      status: "confirmado", registeredAt: `2026-08-1${j + 1}`, checkedInAt: null,
    });
  }));
  Data.attendees.find((a) => a.id === "a10").checkedInAt = "2026-08-22T07:05:00";
})();

/* ---------- Categorías del Home (píldoras de filtro y tarjetas de categoría) ----------
   Cada evento pertenece a las categorías cuyo `types` incluya su tipo (ev.type), o a las que
   liste a mano en ev.categories (ej.: ["cultura", "fiestas"]). "Fiestas" no tiene tipo propio:
   se asigna con ev.categories. imageEvent: usa la foto de ese evento para la tarjeta de categoría. */
const HOME_CATEGORIES = [
  { id: "academico", label: "Académico",       types: ["academico", "investigacion"], color: TYPE_STYLE.academico.bg,     gradient: TYPE_STYLE.academico.gradient,     imageType: "academico" },
  { id: "deportes",  label: "Deportes",        types: ["deportivo"],                  color: TYPE_STYLE.deportivo.bg,     gradient: TYPE_STYLE.deportivo.gradient,     imageType: "deportivo" },
  { id: "cultura",   label: "Cultura",         types: ["cultural"],                   color: TYPE_STYLE.cultural.bg,      gradient: TYPE_STYLE.cultural.gradient,      imageEvent: "e6" },
  { id: "fiestas",   label: "Fiestas",         types: [],                             color: "#d61f69",                   gradient: "linear-gradient(135deg, #d61f69, #cc4100)", imageEvent: "e4" },
  { id: "comunidad", label: "Comunidad UCEVA", types: ["institucional"],              color: TYPE_STYLE.institucional.bg, gradient: TYPE_STYLE.institucional.gradient, imageType: "institucional" },
];

function eventCategories(ev) {
  if (Array.isArray(ev.categories)) return ev.categories;
  return HOME_CATEGORIES.filter((c) => c.types.includes(ev.type)).map((c) => c.id);
}
