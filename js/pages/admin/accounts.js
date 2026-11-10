const ROLE_LABEL = { user: "Cliente", manager: "Agente", admin: "Administrador" };
const PAGE_SIZE = 10;
const AccountsPage = {
  search: "", role: "todos", page: 1, deleteId: null, flash: "", flashTimer: null, createModal: false, form: { identificacion: "", name: "", email: "", cityId: "", password: "" }, formError: "", roleId: null,
  genPassword() { const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; const a = new Uint32Array(10); crypto.getRandomValues(a); return [...a].map((n) => chars[n % chars.length]).join("") + "7a"; },
  openCreate() { this.form = { identificacion: "", name: "", email: "", cityId: "", password: this.genPassword() }; this.formError = ""; this.createModal = true; },
  filtered() { return Data.accounts.filter((a) => (this.role === "todos" || a.role === this.role) && (!this.search || matches(a.name, this.search) || matches(a.email, this.search) || matches(a.id, this.search))).sort((a, b) => a.name.localeCompare(b.name, "es")); },
  say(msg) { this.flash = msg; rerender(); clearTimeout(this.flashTimer); this.flashTimer = setTimeout(() => { this.flash = ""; if (App.currentPage() === AccountsPage) rerender(); }, 3500); },
  row(a) {
    const isSelf = Session.user && a.id === Session.user.id;
    const actions = a.role === "admin"
      ? `<span class="readonly">—</span>`
      : `<button class="btn btn-outline btn-sm" data-click="accounts:askRole" data-id="${a.id}">${a.role === "user" ? "Hacer Agente" : "Hacer Cliente"}</button><button class="btn btn-danger btn-sm" data-click="accounts:askDelete" data-id="${a.id}" aria-label="Eliminar la cuenta de ${esc(a.name)}">${icon("trash", 14)} Eliminar</button>`;
    return `<tr>
        <td><div class="row" style="gap:12px"><div class="avatar" style="width:38px;height:38px;font-size:13px;background:${avatarColor(a.name)}">${esc(initials(a.name))}</div>
          <div><div style="font-size:14px;font-weight:500">${esc(a.name)}${isSelf ? " (tú)" : ""}</div><div style="font-size:12px;color:var(--muted)">${esc(a.email)}</div></div></div></td>
        <td style="font-size:13px;color:var(--muted)">${esc(a.id)}</td>
        <td><span class="badge role-${a.role}">${ROLE_LABEL[a.role] || a.role}</span></td>
        <td style="font-size:13px;color:var(--muted)">${esc(a.city || "—")}${a.department ? `<div style="font-size:12px">${esc(a.department)}</div>` : ""}</td>
        <td style="font-size:13px;color:var(--muted)">${a.phone ? esc(a.phone) : "—"}</td>
        <td><div class="row" style="gap:8px;flex-wrap:wrap">${actions}</div></td></tr>`;
  },
  createModalHtml() {
    if (!this.createModal) return "";
    const f = this.form, H = "accounts:form";
    return `<div class="modal-backdrop" data-click="accounts:closeCreate" data-backdrop><div class="modal" style="--w:480px" role="dialog" aria-modal="true" aria-label="Crear Agente"><h2 class="modal-title">Crear cuenta de Agente</h2><div class="form-stack">
            ${field("Número de identificación", textInput({ key: "identificacion", value: f.identificacion, handler: H }))}
            ${field("Nombre completo", textInput({ key: "name", value: f.name, handler: H }))}${field("Correo electrónico", textInput({ key: "email", type: "email", value: f.email, handler: H }))}
            ${field("Ciudad", `<select class="input" data-input="${H}" data-key="cityId" aria-label="Ciudad">${cityOptionsHtml(f.cityId)}</select>`)}
            ${field("Contraseña temporal", textInput({ key: "password", value: f.password, handler: H }), "Compártela de forma segura.")}</div>
          ${this.formError ? `<p class="auth-error" role="alert" style="margin-top:14px">${esc(this.formError)}</p>` : ""}
          <div class="modal-form-actions"><button class="btn btn-outline btn-block" data-click="accounts:closeCreate">Cancelar</button><button class="btn btn-primary btn-block" data-click="accounts:saveCreate">Crear Agente</button></div></div></div>`;
  },
  render() {
    const all = Data.accounts, list = this.filtered(), pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE)); this.page = Math.min(this.page, pages);
    const slice = list.slice((this.page - 1) * PAGE_SIZE, this.page * PAGE_SIZE);
    const stats = [{ label: "Cuentas totales", value: all.length, color: "var(--text)" }, { label: "Clientes", value: all.filter((a) => a.role === "user").length, color: "var(--primary-fg)" }, { label: "Agentes", value: all.filter((a) => a.role === "manager").length, color: "var(--primary-fg)" }, { label: "Administradores", value: all.filter((a) => a.role === "admin").length, color: "var(--text)" }].map((s) => `<div class="kpi" style="padding:20px 24px"><div class="kpi-label" style="margin-bottom:8px">${s.label}</div><div class="kpi-value" style="font-size:34px;color:${s.color}">${s.value}</div></div>`).join("");
    const pill = (group, val, label) => `<button class="pill ${this[group] === val ? "active" : ""}" data-click="accounts:${group}" data-value="${val}">${label}</button>`;
    const del = Data.accounts.find((a) => a.id === this.deleteId), roleAcc = Data.accounts.find((a) => a.id === this.roleId);
    const from = list.length ? (this.page - 1) * PAGE_SIZE + 1 : 0, to = Math.min(this.page * PAGE_SIZE, list.length);
    return `<div class="page" style="--w:1680px">
        ${pageHeader({ eyebrow: "Plataforma", title: "Gestión de cuentas", subtitle: "Personas registradas (Cliente · Agente · Administrador). Crea Agentes, cambia roles o elimina cuentas.", action: `<button class="btn btn-primary" data-click="accounts:openCreate">${icon("plus", 16, { width: 2.5 })} Crear Agente</button>` })}
        <div class="grid-kpi">${stats}</div>${this.flash ? `<div class="toast" role="status">${icon("check", 20, { color: "#fff", width: 2.5 })}<span>${esc(this.flash)}</span></div>` : ""}
        <div class="filters-stack"><div class="filters" style="gap:10px">${searchBox({ id: "accounts-search", placeholder: "Buscar por nombre, correo o cédula…", value: this.search, handler: "accounts:search" })}</div>
          <div class="filters scroll-x"><span class="fin-note" style="margin-right:4px">Rol</span>${pill("role", "todos", "Todos")}${pill("role", "user", "Clientes")}${pill("role", "manager", "Agentes")}${pill("role", "admin", "Administradores")}</div></div>
        <div class="card"><div class="table-scroll"><table class="table"><thead><tr><th>Cuenta</th><th>Identificación</th><th>Rol</th><th>Ciudad</th><th>Teléfono</th><th>Acciones</th></tr></thead><tbody>${slice.map((a) => this.row(a)).join("")}</tbody></table></div>
          ${list.length === 0 ? `<div style="text-align:center;padding:48px 0"><div style="font-family:var(--font-title);font-size:20px;color:var(--muted)">Sin resultados</div></div>` : ""}
          <div class="acc-pager"><span>${list.length ? `Mostrando ${from}–${to} de ${list.length}` : "0 cuentas"}</span><div class="row" style="gap:8px"><button class="btn btn-outline btn-sm" data-click="accounts:prev" ${this.page <= 1 ? "disabled" : ""}>${icon("left", 14)} Anterior</button><span class="acc-page">${this.page} / ${pages}</span><button class="btn btn-outline btn-sm" data-click="accounts:next" ${this.page >= pages ? "disabled" : ""}>Siguiente ${icon("right", 14)}</button></div></div></div>
        ${this.createModalHtml()}
        ${roleAcc ? mgrModal({ title: roleAcc.role === "user" ? "¿Convertir en Agente?" : "¿Convertir en Cliente?", cancel: "accounts:cancelRole", confirm: "accounts:confirmRole", label: "Sí, cambiar rol", body: `<p class="modal-confirm-text"><strong>${esc(roleAcc.name)}</strong> ${roleAcc.role === "user" ? "podrá crear y operar todos los eventos de la plataforma." : "dejará de operar eventos y volverá a ser un cliente."} Su próximo inicio de sesión ya tendrá el nuevo rol.</p>` }) : ""}
        ${del ? confirmModal({ title: `¿Eliminar la cuenta de ${esc(del.name)}?`, cancelAction: "accounts:cancelDelete", confirmAction: "accounts:confirmDelete" }) : ""}</div>`;
  },
};
bindForm("accounts:form", () => AccountsPage.form);
registerInput({ "accounts:search": (el) => { AccountsPage.search = el.value; AccountsPage.page = 1; rerender(); } });
registerClick({
  "accounts:role":   (el) => { AccountsPage.role = el.dataset.value; AccountsPage.page = 1; rerender(); },
  "accounts:prev":   () => { AccountsPage.page = Math.max(1, AccountsPage.page - 1); rerender(); },
  "accounts:next":   () => { AccountsPage.page += 1; rerender(); },
  "accounts:openCreate":  () => { AccountsPage.openCreate(); rerender(); },
  "accounts:closeCreate": () => { AccountsPage.createModal = false; rerender(); },
  "accounts:saveCreate": async () => {
    const f = AccountsPage.form; const fail = (m) => { AccountsPage.formError = m; rerender(); };
    const err = AuthValidators.identificacion(f.identificacion) || AuthValidators.name(f.name) || AuthValidators.email(f.email) || AuthValidators.cityId(f.cityId) || AuthValidators.password(f.password); if (err) return fail(err);
    const email = f.email.trim().toLowerCase();
    if (Data.accounts.some((a) => a.email.toLowerCase() === email)) return fail("Ya existe una cuenta con este correo.");
    if (Data.accounts.some((a) => a.id === f.identificacion.trim())) return fail("Ya existe una persona con ese número de identificación.");
    try {
      await api.post("/accounts", { identificacion: f.identificacion.trim(), name: f.name.trim().replace(/\s+/g, " "), email, cityId: Number(f.cityId), password: f.password, role: "agent" });
    } catch (e) { const first = e.fields ? Object.values(e.fields)[0] : ""; return fail(first ? `${e.message} ${first}` : e.message); }
    AccountsPage.createModal = false; AccountsPage.formError = ""; await syncData();
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