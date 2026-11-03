/* ==========================================================
   data.js — Datos de ejemplo y catálogos (etiquetas, colores)
   VERSIÓN CONECTADA A NEON: Los arreglos de Data empiezan vacíos
   y se llenarán mediante fetch() desde el backend (Express).
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

/* ---------- Slides del carrusel del Home ---------- */
const HERO_SLIDES = [
  { eventId: "e0000000-0000-4000-8000-000000000001", tag: "Fiesta · Color Fest", title: "Pinta el campus de mil colores", highlight: "mil colores", text: "Polvos de colores, DJs en vivo y una zona de experiencias en las canchas del campus." },
  { eventId: "e0000000-0000-4000-8000-000000000002", tag: "Concierto · Rock & Indie", title: "Las mejores bandas estudiantiles en vivo", highlight: "bandas estudiantiles", text: "Una noche de guitarras, amplificadores al máximo y mucho talento universitario." },
  { eventId: "e0000000-0000-4000-8000-000000000003", tag: "Fiesta · Welcome Party", title: "Tu bienvenida empieza con neón", highlight: "neón", text: "Música urbana, electrónica y luces neón para integrarte con toda la comunidad." },
  { eventId: "e0000000-0000-4000-8000-000000000005", tag: "Fiesta · ElectroFest", title: "Cierra el semestre a todo volumen", highlight: "todo volumen", text: "DJs invitados y un show de luces para despedir el semestre como se debe." },
  { eventId: "e0000000-0000-4000-8000-000000000004", tag: "Plan al aire libre · Gratis", title: "Atardeceres, food trucks y acústicos", highlight: "acústicos", text: "Una tarde de integración con comida, birras y música suave bajo el cielo del campus." },
  { eventId: "e0000000-0000-4000-8000-000000000006", tag: "Deportes · Interfacultades", title: "Juega, alienta y gana con tu facultad", highlight: "gana", text: "El torneo donde el campus se llena de camisetas, barras y emoción." },
];

/* ---------- ESTADO GLOBAL VACÍO ----------
   Al conectarnos a Neon mediante Node.js, ya no generamos los datos falsos aquí.
   La aplicación arrancará con los arreglos vacíos y los llenará consumiendo la API. */

/* ---------- Función auxiliar (Requerida por el Mock Login) ---------- */
function inDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const Data = {
  events: [],
  attendees: [],
  tasks: [],
  accounts: [],
  userRegistrations: [],
};

/* ---------- Recaudo ---------- */
// Ahora soporta tanto la llave de prueba "price" como la llave real de la base de datos "price_cop"
function priceLabel(ev) { 
  const p = ev.price_cop !== undefined ? ev.price_cop : (ev.price || 0);
  return p > 0 ? cop(p) : "Gratis"; 
}

// Si el backend manda el recaudo real (suma de lo pagado: incluye zonas, descuentos y precios dinámicos) se usa ese;
// si no, se estima como precio × inscritos.
function eventRevenue(ev) {
  if (typeof ev.revenue_cop === "number") return ev.revenue_cop;
  const p = ev.price_cop !== undefined ? ev.price_cop : (ev.price || 0);
  return p * (ev.registered || 0);
}

/* ---------- Credenciales de PRUEBA (solo modo mock) ----------
   Se mantienen temporalmente para que el sistema de Auth local (AuthModal) no se rompa
   mientras completas tu endpoint de autenticación con Node.js. */
const MOCK_DEFAULT_PASSWORD = "123456";
const MOCK_CREDENTIALS = [
  { email: "admin@eventpro.com",  password: "123456", role: "admin", id: "a0000000-0000-4000-8000-000000000001", name: "Sofía Navarro" },
  { email: "agente@eventpro.com", password: "123456", role: "agent", accountId: "a0000000-0000-4000-8000-000000000035" },
  { email: "user@eventpro.com",   password: "123456", role: "user",  accountId: "a0000000-0000-4000-8000-00000000003a" },
];

/* ---------- Categorías del Home (píldoras de filtro y tarjetas de categoría) ---------- */
const HOME_CATEGORIES = [
  { id: "fiestas",   label: "Fiestas",         types: ["fiesta", "musica"],           color: TYPE_STYLE.fiesta.bg,        gradient: "linear-gradient(135deg, #b01fc4, #cc4100)", imageEvent: "e0000000-0000-4000-8000-000000000001" },
  { id: "cultura",   label: "Cultura",         types: ["cultural"],                   color: TYPE_STYLE.cultural.bg,      gradient: TYPE_STYLE.cultural.gradient,      imageEvent: "e0000000-0000-4000-8000-000000000008" },
  { id: "deportes",  label: "Deportes",        types: ["deportivo"],                  color: TYPE_STYLE.deportivo.bg,     gradient: TYPE_STYLE.deportivo.gradient,     imageType: "deportivo" },
  { id: "academico", label: "Académico",       types: ["academico", "investigacion"], color: TYPE_STYLE.academico.bg,     gradient: TYPE_STYLE.academico.gradient,     imageType: "academico" },
  { id: "comunidad", label: "Comunidad UCEVA", types: ["institucional"],              color: TYPE_STYLE.institucional.bg, gradient: TYPE_STYLE.institucional.gradient, imageEvent: "e0000000-0000-4000-8000-000000000004" },
];

function eventCategories(ev) {
  if (Array.isArray(ev.categories)) return ev.categories;
  const type = ev.type_code || ev.type;
  return HOME_CATEGORIES.filter((c) => c.types.includes(type)).map((c) => c.id);
}