/* ==========================================================
   models/index.js — Arma todos los modelos con el mismo pool de conexiones
   ========================================================== */
module.exports = function createModels(pool) {
  return {
    geografia: require("./geografiaModel")(pool),
    catalogo: require("./catalogoModel")(pool),
    persona: require("./personaModel")(pool),
    evento: require("./eventoModel")(pool),
    reserva: require("./reservaModel")(pool),
    precio: require("./precioModel")(pool),
    reporte: require("./reporteModel")(pool),
  };
};
