/* ==========================================================
   data.js — Datos de ejemplo y catálogos (etiquetas, colores)
   No hay backend: todo vive en memoria mientras la página esté abierta.
   ========================================================== */

const TYPE_LABEL = {
  academico: "Académico", institucional: "Institucional", investigacion: "Investigación",
  cultural: "Cultural", deportivo: "Deportivo", fiesta: "Fiesta", musica: "Concierto",
};

// Color sólido por tipo de evento (texto blanco encima ≥ 4.5:1)
const TYPE_COLOR = {
  academico: "#6a2cff", institucional: "#2563eb", investigacion: "#087f70",
  cultural: "#d61f69", deportivo: "#cc4100", fiesta: "#b01fc4", musica: "#0e7490",
};

// Paleta completa por tipo (usada en calendario, tarjetas y modal)
const TYPE_STYLE = {
  academico:     { bg: "#6a2cff", gradient: "linear-gradient(135deg, #6a2cff, #8450ff)" },
  institucional: { bg: "#2563eb", gradient: "linear-gradient(135deg, #2563eb, #3f74ec)" },
  investigacion: { bg: "#087f70", gradient: "linear-gradient(135deg, #087f70, #0e9482)" },
  cultural:      { bg: "#d61f69", gradient: "linear-gradient(135deg, #d61f69, #e8407f)" },
  deportivo:     { bg: "#cc4100", gradient: "linear-gradient(135deg, #cc4100, #df5405)" },
  fiesta:        { bg: "#b01fc4", gradient: "linear-gradient(135deg, #b01fc4, #e0359a)" },
  musica:        { bg: "#0e7490", gradient: "linear-gradient(135deg, #0e7490, #2b6bff)" },
};

// Imagen por defecto según el tipo de evento (si falla la carga, las tarjetas muestran el degradado del tipo)
const TYPE_IMAGES = {
  academico:     "https://images.unsplash.com/photo-1670382417551-d2f1ee29aea4?w=600&q=80",
  institucional: "https://images.unsplash.com/photo-1661693758705-4fa65572bced?w=600&q=80",
  investigacion: "https://images.unsplash.com/photo-1581093577421-f561a654a353?w=600&q=80",
  cultural:      "https://images.unsplash.com/photo-1719241368157-7c78535f3a92?w=600&q=80",
  deportivo:     "https://images.unsplash.com/photo-1662065931743-346f5058fe58?w=600&q=80",
  fiesta:        "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80",
  musica:        "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&q=80",
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

/* ---------- Slides del carrusel del Home ----------
   - eventId: enlaza el slide con un evento (toma fecha, lugar y foto de Data.events
     y activa los botones "Inscribirme" / "Ver detalles").
   - image (opcional): foto propia, por ejemplo "img/hero/concierto.jpg" (mejor 1600×900 o más).
   - highlight: palabra(s) del título que se pintan con el degradado de color.
   Sin eventId, el slide es de marca y muestra "Crear cuenta" / "Ver eventos". */
const HERO_SLIDES = [
  { eventId: "e1", tag: "Fiesta · Color Fest", title: "Pinta el campus de mil colores", highlight: "mil colores",
    text: "Polvos de colores, DJs en vivo y una zona de experiencias en las canchas del campus." },
  { eventId: "e2", tag: "Concierto · Rock & Indie", title: "Las mejores bandas estudiantiles en vivo", highlight: "bandas estudiantiles",
    text: "Una noche de guitarras, amplificadores al máximo y mucho talento universitario." },
  { eventId: "e3", tag: "Fiesta · Welcome Party", title: "Tu bienvenida empieza con neón", highlight: "neón",
    text: "Música urbana, electrónica y luces neón para integrarte con toda la comunidad." },
  { eventId: "e5", tag: "Fiesta · ElectroFest", title: "Cierra el semestre a todo volumen", highlight: "todo volumen",
    text: "DJs invitados y un show de luces para despedir el semestre como se debe." },
  { eventId: "e4", tag: "Plan al aire libre · Gratis", title: "Atardeceres, food trucks y acústicos", highlight: "acústicos",
    text: "Una tarde de integración con comida, birras y música suave bajo el cielo del campus." },
  { eventId: "e6", tag: "Deportes · Interfacultades", title: "Juega, alienta y gana con tu facultad", highlight: "gana",
    text: "El torneo donde el campus se llena de camisetas, barras y emoción." },
];

/* ---------- Eventos ----------
   price: valor del cover/boleta por persona en COP (0 = gratuito).
   Recaudo de un evento = price × inscritos (ver eventRevenue). Alimenta el panel de Finanzas del Admin. */
const Data = {
  events: [
  {
    id: "e1", name: "Color Fest Universitario 2026", type: "fiesta",
    date: "2026-10-24", time: "14:00", location: "Canchas del Campus, Tuluá",
    capacity: 2000, registered: 1450, status: "planificado", price: 35000, coordinator: "Carmen López",
    description: "La fiesta de polvos de colores del año: música en vivo, DJs y una zona de experiencias en las canchas del campus.",
    categories: ["fiestas"],
    image: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&q=80",
  },
  {
    id: "e2", name: "Guerra de Bandas Universitarias: Rock & Indie Night", type: "musica",
    date: "2026-10-30", time: "19:00", location: "Auditorio al Aire Libre, Tuluá",
    capacity: 800, registered: 612, status: "planificado", price: 25000, coordinator: "Carmen López",
    description: "Concierto en vivo con las mejores bandas estudiantiles compitiendo por el título de la noche.",
    categories: ["fiestas", "cultura"],
    image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600&q=80",
  },
  {
    id: "e3", name: "Welcome Party: Fiesta de Integración & Primíparos", type: "fiesta",
    date: "2026-11-07", time: "21:00", location: "Coliseo Cubierto, Tuluá",
    capacity: 1200, registered: 980, status: "planificado", price: 30000, coordinator: "Isabela Ruiz",
    description: "Noche de música urbana, electrónica y luces neón para darles la bienvenida a los primíparos.",
    categories: ["fiestas"],
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80",
  },
  {
    id: "e4", name: "Sunset Campus: Festival de Food Trucks, Birras & Acústicos", type: "fiesta",
    date: "2026-11-14", time: "16:00", location: "Plazoleta Central, Tuluá",
    capacity: 1500, registered: 740, status: "planificado", price: 0, coordinator: "Rodrigo Fuentes",
    description: "Tarde de integración al aire libre con food trucks, cerveza artesanal y música acústica. Entrada libre.",
    categories: ["fiestas", "comunidad"],
    image: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&q=80",
  },
  {
    id: "e5", name: "ElectroFest Fin de Semestre", type: "fiesta",
    date: "2026-12-05", time: "22:00", location: "Canchas del Campus, Tuluá",
    capacity: 2500, registered: 1830, status: "planificado", price: 60000, coordinator: "Carmen López",
    description: "Cierre de semestre con DJs invitados, pantallas LED y un show de luces que no vas a olvidar.",
    categories: ["fiestas"],
    image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&q=80",
  },
  {
    id: "e6", name: "Torneo Interfacultades de Fútbol", type: "deportivo",
    date: "2026-10-17", time: "07:00", location: "Estadio Universitario, Tuluá",
    capacity: 300, registered: 210, status: "planificado", price: 0, coordinator: "Valentina Serra",
    description: "Torneo deportivo entre facultades con categorías masculina y femenina.",
    image: "https://images.unsplash.com/photo-1662065931743-346f5058fe58?w=600&q=80",
  },
  {
    id: "e7", name: "Cumbre de Innovación Académica 2026", type: "academico",
    date: "2026-11-19", time: "09:00", location: "Auditorio Central, Tuluá",
    capacity: 500, registered: 342, status: "planificado", price: 0, coordinator: "Sofía Navarro",
    description: "Conferencias, talleres y networking para estudiantes y docentes de educación superior.",
    image: "https://images.unsplash.com/photo-1670382417551-d2f1ee29aea4?w=600&q=80",
  },
  {
    id: "e8", name: "Exposición de Arte Contemporáneo", type: "cultural",
    date: "2026-11-26", time: "16:00", location: "Sala de Exposiciones, Tuluá",
    capacity: 400, registered: 187, status: "planificado", price: 0, coordinator: "Rodrigo Fuentes",
    description: "Muestra de artistas emergentes universitarios en arte contemporáneo.",
    image: "https://images.unsplash.com/photo-1744948162834-45a60a6c0139?w=600&q=80",
  },
  // Eventos ya realizados: alimentan el historial del usuario y las estadísticas de recaudo
  {
    id: "e9", name: "Noche de Talentos Universitaria", type: "cultural",
    date: "2026-09-12", time: "19:00", location: "Auditorio Central, Tuluá",
    capacity: 400, registered: 380, status: "completado", price: 15000, coordinator: "Rodrigo Fuentes",
    description: "Show de talentos con música, baile y stand up de estudiantes.",
    categories: ["cultura", "fiestas"],
    image: "https://images.unsplash.com/photo-1719241368157-7c78535f3a92?w=600&q=80",
  },
  {
    id: "e10", name: "Rumba Retro Campus", type: "fiesta",
    date: "2026-09-26", time: "21:00", location: "Coliseo Cubierto, Tuluá",
    capacity: 1000, registered: 910, status: "completado", price: 20000, coordinator: "Isabela Ruiz",
    description: "Una noche de clásicos de los 80, 90 y 2000 para toda la comunidad.",
    categories: ["fiestas"],
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80",
  },
],

  attendees: [],
  tasks: [
  { id: "t1",  title: "Contratar sonido y pantallas LED",         eventId: "e5", eventName: "ElectroFest",          assignee: "Carmen López",    dueDate: "2026-11-10", priority: "alta",  status: "en_progreso", category: "Producción" },
  { id: "t2",  title: "Pedir permisos de polvos de colores",      eventId: "e1", eventName: "Color Fest",           assignee: "Carmen López",    dueDate: "2026-10-15", priority: "alta",  status: "completado",  category: "Permisos" },
  { id: "t3",  title: "Confirmar line-up de bandas",              eventId: "e2", eventName: "Guerra de Bandas",     assignee: "Carmen López",    dueDate: "2026-10-20", priority: "alta",  status: "en_progreso", category: "Programación" },
  { id: "t4",  title: "Contratar seguridad y primeros auxilios",  eventId: "e3", eventName: "Welcome Party",        assignee: "Isabela Ruiz",    dueDate: "2026-10-30", priority: "alta",  status: "pendiente",   category: "Seguridad" },
  { id: "t5",  title: "Coordinar food trucks y proveedores",      eventId: "e4", eventName: "Sunset Campus",        assignee: "Rodrigo Fuentes", dueDate: "2026-11-05", priority: "media", status: "pendiente",   category: "Logística" },
  { id: "t6",  title: "Imprimir y distribuir boletería",          eventId: "e1", eventName: "Color Fest",           assignee: "Carmen López",    dueDate: "2026-10-14", priority: "media", status: "completado",  category: "Boletería" },
  { id: "t7",  title: "Preparar canchas y uniformes",             eventId: "e6", eventName: "Torneo Interfacultades", assignee: "Valentina Serra", dueDate: "2026-10-16", priority: "alta",  status: "en_progreso", category: "Deportes" },
  { id: "t8",  title: "Diseñar show de luces y escenografía neón",eventId: "e3", eventName: "Welcome Party",        assignee: "Isabela Ruiz",    dueDate: "2026-11-01", priority: "media", status: "pendiente",   category: "Producción" },
  { id: "t9",  title: "Campaña en redes para ElectroFest",        eventId: "e5", eventName: "ElectroFest",          assignee: "Rodrigo Fuentes", dueDate: "2026-11-15", priority: "baja",  status: "pendiente",   category: "Comunicación" },
  { id: "t10", title: "Reservar auditorio y equipos de sonido",   eventId: "e7", eventName: "Cumbre de Innovación", assignee: "Sofía Navarro",   dueDate: "2026-11-01", priority: "media", status: "en_progreso", category: "Logística" },
],

  // Inscripciones iniciales del usuario demo (Carlos Mejía): dos próximos y uno ya realizado
  userRegistrations: ["e2", "e6", "e9"],
};

/* ---------- Recaudo ---------- */
// Precio legible: "Gratis" o "$ 35.000"
function priceLabel(ev) { return ev.price > 0 ? cop(ev.price) : "Gratis"; }
// Dinero recaudado por un evento = precio por persona × inscritos
function eventRevenue(ev) { return (ev.price || 0) * (ev.registered || 0); }

/* ---------- Disponibilidad de inscripción (la controla el Agente) ---------- */
Data.events.forEach((e) => {
  e.availability = e.status === "completado" ? "closed" : "open";   // open | paused | closed
  e.is_public = true;
  e.featured = ["e1", "e2", "e5"].includes(e.id);
});

/* ---------- Asistentes (inscritos) ----------
   Se generan de forma determinista para no escribir cientos de filas a mano.
   Las inscripciones que hace el usuario demo en la app se agregan/quitan en UserApp. */
(function seedAttendees() {
  const people = ["Camila Ortiz", "Sebastián Rojas", "Daniela Cruz", "Felipe Vargas", "Natalia Peña", "Julián Castro",
    "Valeria Gómez", "Mateo Herrera", "Sara Quintero", "Andrés Molina", "Laura Jiménez", "David Sánchez",
    "María González", "Carlos Pérez", "Elena Martínez", "Miguel Romero", "Ana Flores", "Javier Torres",
    "Patricia Moreno", "Roberto Díaz", "Paula Rincón", "Nicolás Ardila", "Juliana Mena", "Esteban Salazar"];
  const states = ["confirmado", "confirmado", "confirmado", "pendiente", "confirmado", "cancelado"];
  const slug = (n) => n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, ".");
  let n = 0;
  Data.events.forEach((ev, ei) => {
    const take = ev.status === "completado" ? 4 : 6;
    for (let k = 0; k < take; k++) {
      const name = people[(ei * 5 + k * 3) % people.length];
      const status = ev.status === "completado" ? "confirmado" : states[(ei + k) % states.length];
      Data.attendees.push({
        id: `a${++n}`, name, email: `${slug(name)}@correo.co`, phone: `31${(ei % 10)} ${200 + k * 13} ${1000 + ei * 37 + k}`,
        eventId: ev.id, eventName: ev.name, status,
        registeredAt: `2026-09-${String(8 + ((ei * 3 + k * 2) % 20)).padStart(2, "0")}`,
        checkedInAt: ev.status === "completado" && status === "confirmado" ? `${ev.date}T${ev.time}:00` : null,
      });
    }
  });
  // Inscripciones del usuario demo (id fijo para poder quitarlas al cancelar)
  Data.userRegistrations.forEach((eid) => {
    const ev = Data.events.find((e) => e.id === eid);
    Data.attendees.push({
      id: `au-${eid}`, name: "Carlos Mejía", email: "carlos.mejia@correo.co", phone: "315 678 9012",
      eventId: eid, eventName: ev.name, status: "confirmado", registeredAt: "2026-09-20",
      checkedInAt: ev.status === "completado" ? `${ev.date}T${ev.time}:00` : null,
    });
  });
})();

/* ---------- Cuentas de la plataforma (las gestiona el Admin) ----------
   role: "user" | "manager" (Agente) · status: "activo" | "suspendido"
   Las cuentas demo con las que se inicia sesión: u-user (Carlos Mejía) y u-agent (Carmen López).
   Si el Admin suspende o elimina una de ellas, el login demo la rechaza (ver core/session.js). */
Data.accounts = (function seedAccounts() {
  const first = ["Camila", "Sebastián", "Daniela", "Felipe", "Natalia", "Julián", "Valeria", "Mateo", "Sara", "Andrés", "Laura", "David",
    "María", "Carlos", "Elena", "Miguel", "Ana", "Javier", "Paula", "Nicolás", "Juliana", "Esteban", "Manuela", "Tomás", "Isabela", "Santiago"];
  const last = ["Ortiz", "Rojas", "Cruz", "Vargas", "Peña", "Castro", "Gómez", "Herrera", "Quintero", "Molina", "Jiménez", "Sánchez",
    "González", "Pérez", "Martínez", "Romero", "Flores", "Torres", "Moreno", "Díaz", "Rincón", "Ardila", "Mena", "Salazar", "Ríos", "Londoño"];
  const slug = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const perMonth = { "2026-03": 3, "2026-04": 4, "2026-05": 5, "2026-06": 6, "2026-07": 8, "2026-08": 9, "2026-09": 11, "2026-10": 5 };
  const list = [];
  let i = 0;
  Object.entries(perMonth).forEach(([ym, count]) => {
    for (let k = 0; k < count; k++, i++) {
      const name = `${first[(i * 7) % first.length]} ${last[(i * 11 + 3) % last.length]}`;
      const day = String(((i * 5) % 26) + 1).padStart(2, "0");
      list.push({
        id: `u${i + 1}`, name, email: `${slug(name).replace(/\s+/g, ".")}@correo.co`, role: "user",
        status: i % 9 === 4 ? "suspendido" : "activo", createdAt: `${ym}-${day}`,
        lastLogin: `2026-10-${String(((i * 3) % 11) + 1).padStart(2, "0")}`,
      });
    }
  });
  // Agentes (organizadores)
  [["Carmen López", "2026-03-02"], ["Isabela Ruiz", "2026-03-18"], ["Rodrigo Fuentes", "2026-04-10"], ["Valentina Serra", "2026-06-05"], ["Sofía Mora", "2026-08-21"]]
    .forEach(([name, createdAt], k) => list.push({
      id: k === 0 ? "u-agent" : `ag${k}`, name, email: `${slug(name).replace(/\s+/g, ".")}@eventpro.co`, role: "manager",
      status: k === 4 ? "suspendido" : "activo", createdAt, lastLogin: "2026-10-11",
    }));
  // Usuario demo con sesión
  list.push({ id: "u-user", name: "Carlos Mejía", email: "carlos.mejia@correo.co", role: "user", status: "activo", createdAt: "2026-09-02", lastLogin: "2026-10-12" });
  return list;
})();

/* ---------- Categorías del Home (píldoras de filtro y tarjetas de categoría) ----------
   Cada evento pertenece a las categorías cuyo `types` incluya su tipo (ev.type), o a las que
   liste a mano en ev.categories (ej.: ["fiestas", "cultura"]). imageEvent: usa la foto de ese evento
   para la tarjeta de categoría. */
const HOME_CATEGORIES = [
  { id: "fiestas",   label: "Fiestas",         types: ["fiesta", "musica"],           color: TYPE_STYLE.fiesta.bg,        gradient: "linear-gradient(135deg, #b01fc4, #cc4100)", imageEvent: "e1" },
  { id: "cultura",   label: "Cultura",         types: ["cultural"],                   color: TYPE_STYLE.cultural.bg,      gradient: TYPE_STYLE.cultural.gradient,      imageEvent: "e8" },
  { id: "deportes",  label: "Deportes",        types: ["deportivo"],                  color: TYPE_STYLE.deportivo.bg,     gradient: TYPE_STYLE.deportivo.gradient,     imageType: "deportivo" },
  { id: "academico", label: "Académico",       types: ["academico", "investigacion"], color: TYPE_STYLE.academico.bg,     gradient: TYPE_STYLE.academico.gradient,     imageType: "academico" },
  { id: "comunidad", label: "Comunidad UCEVA", types: ["institucional"],              color: TYPE_STYLE.institucional.bg, gradient: TYPE_STYLE.institucional.gradient, imageEvent: "e4" },
];

function eventCategories(ev) {
  if (Array.isArray(ev.categories)) return ev.categories;
  return HOME_CATEGORIES.filter((c) => c.types.includes(ev.type)).map((c) => c.id);
}
