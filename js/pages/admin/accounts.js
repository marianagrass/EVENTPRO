const ROLE_LABEL = { user: "Usuario", manager: "Agente" };
const ACCOUNT_STATUS = { activo: "Activo", suspendido: "Suspendido" };
const PAGE_SIZE = 10;
const AccountsPage = {
  search: "", role: "todos", status: "todos", page: 1, suspendId: null, deleteId: null, flash: "", flashTimer: null, createModal: false, form: { name: "", email: "", password: "" }, formError: "", roleId: null,
  genPassword() { const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; const a = new Uint32Array(10); crypto.getRandomValues(a); return [...a].map((n) => chars[n % chars.length]).join("") + "7a"; },
  openCreate() { this.form = { name: "", email: "", password: this.genPassword() }; this.formError = ""; this.createModal = true; },
  filtered() { return Data.accounts.filter((a) => (this.role === "todos" || a.role === this.role) && (this.status === "todos" || a.status === this.status) && (!this.search || matches(a.name, this.search) || matches(a.email, this.search))).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
  say(msg) { this.flash = msg; rerender(); clearTimeout(this.flashTimer); this.flashTimer = setTimeout(() => { this.flash = ""; if (App.currentPage() === AccountsPage) rerender(); }, 3500); },
  row(a) {
    const toggle = a.status === "activo" ? `<button class="btn btn-outline btn-sm" data-click="accounts:askSuspend" data-id="${a.id}">${icon("power", 14)} Desactivar</button>` : `<button class="btn btn-primary btn-sm" data-click="accounts:activate" data-id="${a.id}">${icon("check", 14, { width: 3 })} Activar</button>`;
    return `<tr class="${a.status === "suspendido" ? "is-suspended" : ""}">
        <td><div class="row" style="gap:12px"><div class="avatar" style="width:38px;height:38px;font-size:13px;background:${avatarColor(a.name)}">${esc(initials(a.name))}</div>
          <div><div style="font-size:14px;font-weight:500">${esc(a.name)}</div><div style="font-size:12px;color:var(--muted)">${esc(a.email)}</div></div></div></td>
        <td><span class="badge role-${a.role}">${ROLE_LABEL[a.role]}</span></td><td><span class="badge st-${a.status}">${ACCOUNT_STATUS[a.status]}</span></td>
        <td style="font-size:13px;color:var(--muted)">${parseDate(a.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}</td>
        <td style="font-size:13px;color:var(--muted)">${a.lastLogin ? parseDate(a.lastLogin).toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : "Nunca"}</td>
        <td><div class="row" style="gap:8px;flex-wrap:wrap">${toggle}<button class="btn btn-outline btn-sm" data-click="accounts:askRole" data-id="${a.id}">${a.role === "user" ? "Hacer Agente" : "Hacer Usuario"}</button><button class="btn btn-danger btn-sm" data-click="accounts:askDelete" data-id="${a.id}" aria-label="Eliminar la cuenta de ${esc(a.name)}">${icon("trash", 14)} Eliminar</button></div></td></tr>`;
  },
  createModalHtml() {
    if (!this.createModal) return "";
    const f = this.form, H = "accounts:form";
    return `<div class="modal-backdrop" data-click="accounts:closeCreate" data-backdrop><div class="modal" style="--w:480px" role="dialog" aria-modal="true" aria-label="Crear Agente"><h2 class="modal-title">Crear cuenta de Agente</h2><div class="form-stack">
            ${field("Nombre completo", textInput({ key: "name", value: f.name, handler: H }))}${field("Correo electrónico", textInput({ key: "email", type: "email", value: f.email, handler: H }))}${field("Contraseña temporal", textInput({ key: "password", value: f.password, handler: H }), "Compártela de forma segura.")}</div>
          ${this.formError ? `<p class="auth-error" role="alert" style="margin-top:14px">${esc(this.formError)}</p>` : ""}
          <div class="modal-form-actions"><button class="btn btn-outline btn-block" data-click="accounts:closeCreate">Cancelar</button><button class="btn btn-primary btn-block" data-click="accounts:saveCreate">Crear Agente</button></div></div></div>`;
  },
  render() {
    const all = Data.accounts, list = this.filtered(), pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE)); this.page = Math.min(this.page, pages);
    const slice = list.slice((this.page - 1) * PAGE_SIZE, this.page * PAGE_SIZE);
    const stats = [{ label: "Cuentas totales", value: all.length, color: "var(--text)" }, { label: "Usuarios", value: all.filter((a) => a.role === "user").length, color: "var(--primary-fg)" }, { label: "Agentes", value: all.filter((a) => a.role === "manager").length, color: "var(--primary-fg)" }, { label: "Suspendidas", value: all.filter((a) => a.status === "suspendido").length, color: "var(--danger)" }].map((s) => `<div class="kpi" style="padding:20px 24px"><div class="kpi-label" style="margin-bottom:8px">${s.label}</div><div class="kpi-value" style="font-size:34px;color:${s.color}">${s.value}</div></div>`).join("");
    const pill = (group, val, label) => `<button class="pill ${this[group] === val ? "active" : ""}" data-click="accounts:${group}" data-value="${val}">${label}</button>`;
    const suspend = Data.accounts.find((a) => a.id === this.suspendId), del = Data.accounts.find((a) => a.id === this.deleteId), roleAcc = Data.accounts.find((a) => a.id === this.roleId);
    const from = list.length ? (this.page - 1) * PAGE_SIZE + 1 : 0, to = Math.min(this.page * PAGE_SIZE, list.length);
    return `<div class="page" style="--w:1680px">
        ${pageHeader({ eyebrow: "Plataforma", title: "Gestión de cuentas", subtitle: "Usuarios y Agentes registrados. Crea Agentes, cambia roles, suspende o elimina cuentas.", action: `<button class="btn btn-primary" data-click="accounts:openCreate">${icon("plus", 16, { width: 2.5 })} Crear Agente</button>` })}
        <div class="grid-kpi">${stats}</div>${this.flash ? `<div class="toast" role="status">${icon("check", 20, { color: "#fff", width: 2.5 })}<span>${esc(this.flash)}</span></div>` : ""}
        <div class="filters-stack"><div class="filters" style="gap:10px">${searchBox({ id: "accounts-search", placeholder: "Buscar por nombre o correo…", value: this.search, handler: "accounts:search" })}</div>
          <div class="filters scroll-x"><span class="fin-note" style="margin-right:4px">Rol</span>${pill("role", "todos", "Todos")}${pill("role", "user", "Usuarios")}${pill("role", "manager", "Agentes")}<span class="fin-note" style="margin:0 4px 0 14px">Estado</span>${pill("status", "todos", "Todos")}${pill("status", "activo", "Activos")}${pill("status", "suspendido", "Suspendidos")}</div></div>
        <div class="card"><div class="table-scroll"><table class="table"><thead><tr><th>Cuenta</th><th>Rol</th><th>Estado</th><th>Registro</th><th>Último acceso</th><th>Acciones</th></tr></thead><tbody>${slice.map((a) => this.row(a)).join("")}</tbody></table></div>
          ${list.length === 0 ? `<div style="text-align:center;padding:48px 0"><div style="font-family:var(--font-title);font-size:20px;color:var(--muted)">Sin resultados</div></div>` : ""}
          <div class="acc-pager"><span>${list.length ? `Mostrando ${from}–${to} de ${list.length}` : "0 cuentas"}</span><div class="row" style="gap:8px"><button class="btn btn-outline btn-sm" data-click="accounts:prev" ${this.page <= 1 ? "disabled" : ""}>${icon("left", 14)} Anterior</button><span class="acc-page">${this.page} / ${pages}</span><button class="btn btn-outline btn-sm" data-click="accounts:next" ${this.page >= pages ? "disabled" : ""}>Siguiente ${icon("right", 14)}</button></div></div></div>
        ${this.createModalHtml()}
        ${roleAcc ? mgrModal({ title: roleAcc.role === "user" ? "¿Convertir en Agente?" : "¿Convertir en Usuario?", cancel: "accounts:cancelRole", confirm: "accounts:confirmRole", label: "Sí, cambiar rol", body: `<p class="modal-confirm-text"><strong>${esc(roleAcc.name)}</strong> ${roleAcc.role === "user" ? "podrá crear y operar todos los eventos de la plataforma." : "dejará de operar eventos y volverá a ser un usuario normal."} Su próximo inicio de sesión ya tendrá el nuevo rol.</p>` }) : ""}
        ${suspend ? mgrModal({ title: "¿Desactivar esta cuenta?", cancel: "accounts:cancelSuspend", confirm: "accounts:confirmSuspend", label: "Sí, desactivar", body: `<p class="modal-confirm-text"><strong>${esc(suspend.name)}</strong> no podrá iniciar sesión hasta que vuelvas a activar su cuenta.</p>` }) : ""}
        ${del ? confirmModal({ title: `¿Eliminar la cuenta de ${esc(del.name)}?`, cancelAction: "accounts:cancelDelete", confirmAction: "accounts:confirmDelete" }) : ""}</div>`;
  },
};
bindForm("accounts:form", () => AccountsPage.form);
registerInput({ "accounts:search": (el) => { AccountsPage.search = el.value; AccountsPage.page = 1; rerender(); } });
registerClick({
  "accounts:role":   (el) => { AccountsPage.role = el.dataset.value; AccountsPage.page = 1; rerender(); },
  "accounts:status": (el) => { AccountsPage.status = el.dataset.value; AccountsPage.page = 1; rerender(); },
  "accounts:prev":   () => { AccountsPage.page = Math.max(1, AccountsPage.page - 1); rerender(); },
  "accounts:next":   () => { AccountsPage.page += 1; rerender(); },
  "accounts:askSuspend": (el) => { AccountsPage.suspendId = el.dataset.id; rerender(); },
  "accounts:cancelSuspend": () => { AccountsPage.suspendId = null; rerender(); },
  "accounts:confirmSuspend": async () => { await apiSend('PUT', `/accounts/${AccountsPage.suspendId}/status`, {status: 'suspendido'}); AccountsPage.suspendId = null; await syncData(); },
  "accounts:activate": async (el) => { await apiSend('PUT', `/accounts/${el.dataset.id}/status`, {status: 'activo'}); await syncData(); },
  "accounts:openCreate":  () => { AccountsPage.openCreate(); rerender(); },
  "accounts:closeCreate": () => { AccountsPage.createModal = false; rerender(); },
  "accounts:saveCreate": async () => {
    const f = AccountsPage.form; const fail = (m) => { AccountsPage.formError = m; rerender(); };
    const err = AuthValidators.name(f.name) || AuthValidators.email(f.email) || AuthValidators.password(f.password); if (err) return fail(err);
    const email = f.email.trim().toLowerCase();
    if (Data.accounts.some((a) => a.email.toLowerCase() === email)) return fail("Ya existe una cuenta con este correo.");
    await apiSend('POST', '/accounts', {name: f.name.trim().replace(/\s+/g, " "), email, role: 'agent'});
    AccountsPage.createModal = false; await syncData();
  },
  "accounts:askRole": (el) => { AccountsPage.roleId = el.dataset.id; rerender(); },
  "accounts:cancelRole": () => { AccountsPage.roleId = null; rerender(); },
  "accounts:confirmRole": async () => {
    const a = Data.accounts.find((x) => x.id === AccountsPage.roleId);
    if (a) await apiSend('PUT', `/accounts/${a.id}/role`, {role: a.role === 'user' ? 'agent' : 'user'});
    AccountsPage.roleId = null; await syncData();
  },
  "accounts:askDelete": (el) => { AccountsPage.deleteId = el.dataset.id; rerender(); },
  "accounts:cancelDelete": () => { AccountsPage.deleteId = null; rerender(); },
  "accounts:confirmDelete": async () => {
    await apiSend('DELETE', `/accounts/${AccountsPage.deleteId}`, {adminId: Session.user.id});
    AccountsPage.deleteId = null; await syncData();
  },
});