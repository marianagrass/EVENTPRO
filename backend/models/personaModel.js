/* ==========================================================
   models/personaModel.js — PERSONA y su herencia: CLIENTE · AGENTE · ADMINISTRADOR (+ TELEFONO_PERSONA)
   El rol NO se guarda en PERSONA: se deduce de en qué subclase está su número de identificación.
   ========================================================== */
const ROL_API = { cliente: "user", agente: "agent", administrador: "admin" };   // lo que entiende el front
const ROL_ER = { user: "cliente", agent: "agente", admin: "administrador" };

// Cuenta tal como la usa el front (sin contraseña, sin salario ni comisión)
const SELECT_CUENTA = `
  SELECT p.numero_identificacion AS id, p.nombre_completo AS name, p.correo_electronico AS email, p.direccion AS address,
         p.id_ciudad AS city_id, ci.nombre_ciudad AS city, d.nombre_departamento AS department,
         CASE WHEN ag.numero_identificacion IS NOT NULL THEN 'agent'
              WHEN ad.numero_identificacion IS NOT NULL THEN 'admin' ELSE 'user' END AS role,
         cl.cantidad_puntos AS loyalty_points, cl.visualizacion_publicidad AS show_ads,
         (SELECT t.numero_telefono FROM telefono_persona t WHERE t.numero_identificacion = p.numero_identificacion ORDER BY t.id_telefono LIMIT 1) AS phone,
         ARRAY(SELECT t.numero_telefono FROM telefono_persona t WHERE t.numero_identificacion = p.numero_identificacion ORDER BY t.id_telefono) AS phones
    FROM persona p
    JOIN ciudad ci ON ci.id_ciudad = p.id_ciudad
    JOIN departamento d ON d.id_departamento = ci.id_departamento
    LEFT JOIN cliente cl ON cl.numero_identificacion = p.numero_identificacion
    LEFT JOIN agente ag ON ag.numero_identificacion = p.numero_identificacion
    LEFT JOIN administrador ad ON ad.numero_identificacion = p.numero_identificacion`;

module.exports = function personaModel(pool) {
  const rows = async (sql, p) => (await pool.query(sql, p)).rows;
  return {
    ROL_API, ROL_ER,

    listar: () => rows(`${SELECT_CUENTA} ORDER BY (CASE WHEN ad.numero_identificacion IS NOT NULL THEN 0 WHEN ag.numero_identificacion IS NOT NULL THEN 1 ELSE 2 END), p.nombre_completo`),
    async obtener(id) { return (await rows(`${SELECT_CUENTA} WHERE p.numero_identificacion = $1`, [id]))[0] || null; },
    async obtenerPorCorreo(correo) { return (await rows(`${SELECT_CUENTA} WHERE lower(p.correo_electronico) = lower($1)`, [correo]))[0] || null; },

    /** Datos propios de la subclase (los que NO se listan para todos): puntos, comisión, experiencia, salario, horario. */
    async detalleSubclase(id) {
      return (await rows(
        `SELECT cl.cantidad_puntos, cl.visualizacion_publicidad, ag.comision, ag.experiencia, ad.salario, ad.horario
           FROM persona p
           LEFT JOIN cliente cl ON cl.numero_identificacion = p.numero_identificacion
           LEFT JOIN agente ag ON ag.numero_identificacion = p.numero_identificacion
           LEFT JOIN administrador ad ON ad.numero_identificacion = p.numero_identificacion
          WHERE p.numero_identificacion = $1`, [id]))[0] || null;
    },

    /** Crea la PERSONA, su subclase y su teléfono en una sola transacción (función SQL registrar_persona). */
    async crear({ id, nombre, correo, clave, direccion, idCiudad, rol, telefono = null, datos = {} }) {
      await pool.query("SELECT registrar_persona($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)",
        [id, nombre, correo, clave, direccion || null, idCiudad, rol, telefono, JSON.stringify(datos)]);
      return id;
    },

    actualizarPerfil({ id, nombre, correo, direccion, idCiudad, telefono }) {
      return pool.query("SELECT actualizar_perfil_persona($1,$2,$3,$4,$5,$6)", [id, nombre, correo, direccion || null, idCiudad, telefono ?? null]);
    },
    cambiarRol: (id, rol) => pool.query("SELECT cambiar_rol_persona($1,$2)", [id, rol]),
    eliminar: (idAdmin, id) => pool.query("SELECT eliminar_persona($1,$2)", [idAdmin, id]),

    async esAgente(id) { return (await rows("SELECT 1 FROM agente WHERE numero_identificacion = $1", [id])).length > 0; },
    async esAdministrador(id) { return (await rows("SELECT 1 FROM administrador WHERE numero_identificacion = $1", [id])).length > 0; },
    async esCliente(id) { return (await rows("SELECT 1 FROM cliente WHERE numero_identificacion = $1", [id])).length > 0; },
  };
};
