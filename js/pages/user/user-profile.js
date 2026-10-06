/* ==========================================================
   pages/user/user-profile.js — Perfil del usuario del portal
   ========================================================== */

const USER_PROFILE_FIELDS = [
  { label: "Nombre",      value: "Carlos" },
  { label: "Apellido",    value: "Mejía" },
  { label: "Correo",      value: "carlos.mejia@correo.co" },
  { label: "Teléfono",    value: "315 678 9012" },
  { label: "Ciudad",      value: "Bogotá" },
  { label: "Institución", value: "Universidad Nacional" },
];

const UserProfilePage = {
  render() {
    const fields = USER_PROFILE_FIELDS.map((f) => `
      <div>
        <label class="field-label field-label-sm">${f.label}</label>
        <input class="input" value="${esc(f.value)}">
      </div>`).join("");

    return `
      <div class="page" style="--w:700px">
        <div style="margin-bottom:36px">
          <div class="eyebrow">Cuenta</div>
          <h1 class="page-title">Mi perfil</h1>
        </div>

        <div class="card" style="padding:28px;margin-bottom:20px">
          <div class="row" style="gap:20px;margin-bottom:28px">
            <div class="avatar" style="width:72px;height:72px;font-size:24px;font-weight:700;background:#889063;color:#fff">CM</div>
            <div>
              <div style="font-family:var(--font-title);font-size:22px;font-weight:500">Carlos Mejía</div>
              <div style="font-size:14px;color:#889063;margin-top:4px">carlos.mejia@correo.co</div>
              <span class="badge" style="display:inline-block;margin-top:8px;font-size:12px;padding:3px 12px;background:#f0e8da;color:#889063">Usuario</span>
            </div>
          </div>
          <div class="form-grid-2" style="gap:16px;margin-bottom:24px">${fields}</div>
          <button class="btn btn-primary" style="padding:10px 24px">Guardar cambios</button>
        </div>

        <div class="card" style="padding:28px">
          <h3 class="card-title" style="margin-bottom:20px">Cambiar contraseña</h3>
          <div class="form-stack" style="gap:14px;margin-bottom:20px">
            <div><label class="field-label field-label-sm">Contraseña actual</label><input class="input" type="password" value="••••••••"></div>
            <div><label class="field-label field-label-sm">Nueva contraseña</label><input class="input" type="password" placeholder="Mínimo 8 caracteres"></div>
            <div><label class="field-label field-label-sm">Confirmar contraseña</label><input class="input" type="password" placeholder="Repite la nueva contraseña"></div>
          </div>
          <button class="btn btn-outline">Actualizar contraseña</button>
        </div>
      </div>`;
  },
};
