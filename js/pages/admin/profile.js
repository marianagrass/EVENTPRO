/* ==========================================================
   pages/admin/profile.js — Perfil del administrador y permisos del rol
   ========================================================== */
const ADMIN_PERMISSIONS = [
  { ok: true,  text: "Ver el dinero recaudado y los ingresos por categoría" },
  { ok: true,  text: "Ver el crecimiento de usuarios y la ocupación global" },
  { ok: true,  text: "Ver todos los Usuarios y Agentes registrados" },
  { ok: true,  text: "Activar, desactivar y eliminar cuentas" },
  { ok: false, text: "No crea, edita ni elimina eventos (lo hace el Agente)" },
  { ok: false, text: "No gestiona asistentes, calendario ni tareas" },
];

const PROFILE_FIELDS = [
  { label: "Nombre",       value: "Sofía" },
  { label: "Apellido",     value: "Navarro" },
  { label: "Correo",       value: "sofia.navarro@eventpro.co" },
  { label: "Teléfono",     value: "+57 311 234 5678" },
  { label: "Departamento", value: "Dirección" },
  { label: "Ciudad",       value: "Cali" },
];

const ProfilePage = {
  render() {
    const fields = PROFILE_FIELDS.map((f) => `
      <div>
        <label class="field-label field-label-sm">${f.label}</label>
        <input class="input" value="${esc(f.value)}">
      </div>`).join("");

    const perms = ADMIN_PERMISSIONS.map((p) => `
      <div class="row" style="align-items:flex-start;gap:10px">
        <span style="font-size:13px;font-weight:700;margin-top:1px;color:${p.ok ? "var(--primary-fg)" : "var(--muted)"}">${p.ok ? "✓" : "✗"}</span>
        <span style="font-size:13px;color:${p.ok ? "var(--text)" : "var(--muted)"}">${p.text}</span>
      </div>`).join("");

    return `
      <div class="page" style="--w:1200px">
        <div style="margin-bottom:36px">
          <div class="eyebrow">Cuenta</div>
          <h1 class="page-title">Perfil de administrador</h1>
        </div>

        <div class="grid-profile">
          <div class="card" style="padding:28px 28px 24px">
            <div class="row" style="gap:20px;margin-bottom:28px">
              <div class="avatar" style="width:72px;height:72px;font-size:24px;font-weight:700;background:var(--primary);color:#fff">SN</div>
              <div>
                <div style="font-family:var(--font-title);font-size:22px;font-weight:700;line-height:1.2">Sofía Navarro</div>
                <div style="font-size:14px;color:var(--muted);margin-top:4px">sofia.navarro@eventpro.co</div>
                <div style="margin-top:8px"><span class="badge" style="font-size:12px;font-weight:600;padding:4px 12px;background:var(--primary);color:#fff">Administrador</span></div>
              </div>
            </div>
            <div class="form-grid-2" style="gap:16px;margin-bottom:20px">${fields}</div>
            <button class="btn btn-primary" style="padding:10px 24px">Guardar cambios</button>
          </div>

          <div class="col-stack">
            <div class="card card-pad">
              <h3 class="card-title">Permisos del rol</h3>
              <div class="form-stack" style="gap:10px">${perms}</div>
            </div>

            <div class="card card-pad">
              <h3 class="card-title">Seguridad</h3>
              <div class="form-stack" style="gap:12px">
                <div><label class="field-label field-label-sm">Contraseña actual</label><input class="input" type="password" value="••••••••"></div>
                <div><label class="field-label field-label-sm">Nueva contraseña</label><input class="input" type="password" placeholder="Mínimo 8 caracteres"></div>
                <button class="btn btn-outline">Cambiar contraseña</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  },
};
