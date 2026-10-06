/* ==========================================================
   pages/admin/profile.js — Perfil del administrador, equipo y permisos
   ========================================================== */

const TEAM = [
  { id: "u1", name: "Sofía Navarro",   role: "admin", email: "sofia@eventpro.es",    avatar: "SN", dept: "Dirección" },
  { id: "u2", name: "Andrés Vega",     role: "user",  email: "avega@eventpro.es",    avatar: "AV", dept: "Producción" },
  { id: "u3", name: "Isabela Ruiz",    role: "user",  email: "iruiz@eventpro.es",    avatar: "IR", dept: "Coordinación" },
  { id: "u4", name: "Carmen López",    role: "user",  email: "clopez@eventpro.es",   avatar: "CL", dept: "Logística" },
  { id: "u5", name: "Rodrigo Fuentes", role: "user",  email: "rfuentes@eventpro.es", avatar: "RF", dept: "Comunicación" },
];

const PERMISSIONS = {
  admin: [
    { ok: true, text: "Ver y gestionar todos los eventos" },
    { ok: true, text: "Crear, editar y eliminar eventos" },
    { ok: true, text: "Gestionar asistentes" },
    { ok: true, text: "Ver y asignar tareas a cualquier usuario" },
    { ok: true, text: "Ver presupuestos y datos financieros" },
    { ok: true, text: "Administrar usuarios y cambiar roles" },
    { ok: true, text: "Acceso completo al calendario" },
  ],
  user: [
    { ok: true,  text: "Ver eventos asignados" },
    { ok: true,  text: "Ver asistentes de sus eventos" },
    { ok: true,  text: "Gestionar sus propias tareas" },
    { ok: true,  text: "Acceso al calendario (solo lectura)" },
    { ok: false, text: "No puede crear ni eliminar eventos" },
    { ok: false, text: "No puede ver datos financieros" },
    { ok: false, text: "No puede administrar usuarios" },
  ],
};

const PROFILE_FIELDS = [
  { label: "Nombre",       value: "Sofía" },
  { label: "Apellido",     value: "Navarro" },
  { label: "Correo",       value: "sofia@eventpro.es" },
  { label: "Teléfono",     value: "+34 611 234 567" },
  { label: "Departamento", value: "Dirección" },
  { label: "Ciudad",       value: "Madrid" },
];

const ProfilePage = {
  render() {
    const role = App.role;
    const isAdmin = role === "admin";

    const fields = PROFILE_FIELDS.map((f) => `
      <div>
        <label class="field-label field-label-sm">${f.label}</label>
        <input class="input" value="${esc(f.value)}">
      </div>`).join("");

    const team = TEAM.map((u, i) => `
      <tr>
        <td>
          <div class="row" style="gap:10px">
            <div class="avatar" style="width:34px;height:34px;font-size:12px;font-weight:700;background:${AVATAR_COLORS[i % AVATAR_COLORS.length]}">${u.avatar}</div>
            <div>
              <div style="font-size:13px;font-weight:500">${esc(u.name)}</div>
              <div style="font-size:12px;color:#cfbb99">${esc(u.email)}</div>
            </div>
          </div>
        </td>
        <td style="font-size:13px;color:#889063">${u.dept}</td>
        <td><span class="badge" style="font-size:12px;padding:4px 12px;background:${u.role === "admin" ? "#e8f0e0" : "#f5efe6"};color:${u.role === "admin" ? "#354024" : "#889063"}">
          ${u.role === "admin" ? "Administrador" : "Usuario"}</span></td>
      </tr>`).join("");

    const perms = PERMISSIONS[role].map((p) => `
      <div class="row" style="align-items:flex-start;gap:10px">
        <span style="font-size:13px;font-weight:700;margin-top:1px;color:${p.ok ? "#354024" : "#cfbb99"}">${p.ok ? "✓" : "✗"}</span>
        <span style="font-size:13px;color:${p.ok ? "#4c3d19" : "#cfbb99"}">${p.text}</span>
      </div>`).join("");

    return `
      <div class="page" style="--w:1000px">
        <div style="margin-bottom:36px">
          <div class="eyebrow">Cuenta</div>
          <h1 class="page-title">Perfil de usuario</h1>
        </div>

        <div class="grid-profile">
          <div class="col-stack">
            <div class="card" style="padding:28px 28px 24px">
              <div class="row" style="gap:20px;margin-bottom:28px">
                <div class="avatar" style="width:72px;height:72px;font-size:24px;font-weight:700;background:#354024;color:#cfbb99">SN</div>
                <div>
                  <div style="font-family:var(--font-title);font-size:22px;font-weight:500;line-height:1.2">Sofía Navarro</div>
                  <div style="font-size:14px;color:#889063;margin-top:4px">sofia@eventpro.es</div>
                  <div style="margin-top:8px">
                    <span class="badge" style="font-size:12px;font-weight:600;padding:4px 12px;background:${isAdmin ? "#354024" : "#f0e8da"};color:${isAdmin ? "#cfbb99" : "#889063"}">
                      ${isAdmin ? "Administrador" : "Usuario"}</span>
                  </div>
                </div>
              </div>
              <div class="form-grid-2" style="gap:16px;margin-bottom:20px">${fields}</div>
              <button class="btn btn-primary" style="padding:10px 24px">Guardar cambios</button>
            </div>

            <div class="card">
              <div style="padding:20px 24px 16px;border-bottom:1px solid var(--cream)">
                <h2 style="font-size:16px;font-weight:600">Equipo</h2>
                <p style="margin-top:4px;font-size:13px;color:#889063">
                  ${isAdmin ? "Como administrador puedes cambiar los roles del equipo." : "Solo los administradores pueden cambiar roles."}
                </p>
              </div>
              <table class="table table-compact">
                <thead><tr><th>Miembro</th><th>Departamento</th><th>Rol</th></tr></thead>
                <tbody>${team}</tbody>
              </table>
            </div>
          </div>

          <div class="col-stack">
            <div class="card card-pad">
              <h3 style="margin-bottom:6px;font-size:16px;font-weight:600">Tu rol actual</h3>
              <p style="margin-bottom:20px;font-size:13px;color:#889063;line-height:1.5">
                Cambia entre administrador y usuario para ver la diferencia de acceso.
              </p>
              <div class="toggle">
                <button class="${isAdmin ? "active" : ""}" data-click="profile:setRole" data-role="admin">Administrador</button>
                <button class="${!isAdmin ? "active" : ""}" data-click="profile:setRole" data-role="user">Usuario</button>
              </div>
              <div class="role-summary ${isAdmin ? "is-admin" : ""}">
                <div class="role-summary-icon" style="background:${isAdmin ? "#354024" : "#cfbb99"}">
                  ${isAdmin ? icon("shield", 18, { color: "#cfbb99" }) : icon("user", 18, { color: "#4c3d19" })}
                </div>
                <div>
                  <div style="font-size:15px;font-weight:600">${isAdmin ? "Acceso total" : "Acceso limitado"}</div>
                  <div style="font-size:12px;color:#889063">${isAdmin ? "Puedes gestionar todo" : "Solo tus eventos asignados"}</div>
                </div>
              </div>
            </div>

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

registerClick({
  "profile:setRole": (el) => { App.role = el.dataset.role; rerender(); },
});
