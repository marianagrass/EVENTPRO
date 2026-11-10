/* ==========================================================
   lib/event-presentation.js — Datos de PRESENTACIÓN que el ER no guarda
   El ER del tutor no tiene «tipo de evento» ni «imagen». El front los usa para colores, filtros y fotos,
   así que se DERIVAN aquí (nunca se guardan) a partir del nombre y la descripción del evento.
   Si el tutor aprueba agregar esas columnas, bastaría con leerlas en lugar de calcularlas.
   ========================================================== */

const normalize = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Orden de prioridad: lo primero que coincida gana.
const RULES = [
  ["deportivo",     /\b(torneo|futbol|deport\w*|campeonato|maraton|interfacultades|olimpiada\w*|copa)\b/],
  ["investigacion", /\b(investigacion|semillero\w*|ponencia\w*)\b/],
  ["academico",     /\b(cumbre|congreso|seminario|simposio|conferencia\w*|academic\w*|innovacion|taller\w*|charla\w*)\b/],
  ["cultural",      /\b(exposicion|arte|talentos|teatro|cine|danza|cultural\w*|literar\w*|poesia|museo|feria del libro)\b/],
  ["musica",        /\b(concierto\w*|bandas?|rock|recital\w*|orquesta|jazz|trova)\b/],
  ["fiesta",        /(fest\b|festival|fiesta|party|rumba|sunset|baile|neon|electro|retro|integracion|carnaval)/],
  ["institucional", /\b(institucional|rectoria|bienvenida|graduacion|grados?|aniversario)\b/],
];

/** Tipo de evento que usa el front: fiesta | musica | cultural | deportivo | academico | investigacion | institucional */
function classifyType(nombre, descripcion = "") {
  const byName = normalize(nombre);
  for (const [type, re] of RULES) if (re.test(byName)) return type;
  const byDesc = normalize(descripcion);
  for (const [type, re] of RULES) if (re.test(byDesc)) return type;
  return "institucional";
}

module.exports = { classifyType };
