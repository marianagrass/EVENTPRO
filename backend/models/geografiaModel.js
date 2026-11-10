/* ==========================================================
   models/geografiaModel.js — PAIS → DEPARTAMENTO → CIUDAD
   ========================================================== */
module.exports = function geografiaModel(pool) {
  const rows = async (sql, p) => (await pool.query(sql, p)).rows;
  return {
    paises: () => rows("SELECT id_pais, nombre_pais FROM pais ORDER BY nombre_pais"),
    departamentos: (idPais) => rows("SELECT id_departamento, nombre_departamento, id_pais FROM departamento WHERE id_pais = $1 ORDER BY nombre_departamento", [idPais]),
    ciudades: (idDepartamento) => rows("SELECT id_ciudad, nombre_ciudad, id_departamento FROM ciudad WHERE id_departamento = $1 ORDER BY nombre_ciudad", [idDepartamento]),
    /** Lista plana País › Departamento › Ciudad: sirve para un solo <select> agrupado en los formularios. */
    ciudadesCompletas: () => rows(
      `SELECT c.id_ciudad, c.nombre_ciudad, d.id_departamento, d.nombre_departamento, p.id_pais, p.nombre_pais
         FROM ciudad c JOIN departamento d ON d.id_departamento = c.id_departamento JOIN pais p ON p.id_pais = d.id_pais
        ORDER BY p.nombre_pais, d.nombre_departamento, c.nombre_ciudad`),
    async existeCiudad(idCiudad) {
      return (await rows("SELECT 1 FROM ciudad WHERE id_ciudad = $1", [idCiudad])).length > 0;
    },
  };
};
