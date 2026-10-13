/* ==========================================================
   pages/admin/accounts.js — Gestión de cuentas (Usuarios y Agentes)
   El Admin ve a todos los Usuarios y Agentes, filtra por rol o estado y puede:
     · Activar / Desactivar (suspender) una cuenta   · Eliminarla definitivamente
   Una cuenta suspendida o eliminada ya no puede iniciar sesión (core/session.js).
   ========================================================== */
const ROLE_LABEL = { user: "Usuario", manager: "Agente" };
const ACCOUNT_STATUS = { activo: "Activo", suspendido: "Suspendido" };
const PAGE_SIZE = 10;

const AccountsPage = {
  search: "", role: "todos", status: "todos", page: 1,
  suspendId: null, deleteId: null, flash: "", flashTimer: null,

  filtered() {
    return Data.accounts.filter((a) =>
      (this.role === "todos" || a.role === this.role) &&
      (this.status === "todos" || a.status === this.status) &&
      (!this.search || matches(a.name, this.search) || matches(a.email, this.search)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  say(msg) {
    this.flash = msg; rerender();
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => { this.flash = ""; if (App.currentPage() === AccountsPage) rerender(); }, 3500);
  },

  row(a) {
    const toggle = a.status === "activo"
      ? `<button class="btn btn-outline btn-sm" data-click="accounts:askSuspend" data-id="${a.id}">${icon("power", 14)} Desactivar</button>`
      : `<button class="btn btn-primary btn-sm" data-click="accounts:activate" data-id="${a.id}">${icon("check", 14, { width: 3 })} Activar</button>`;
    return `
      <tr class="${a.status === "suspendido" ? "is-suspended" : ""}">
        <td><div class="row" style="gap:12px">
          <div class="avatar" style="width:38px;height:38px;font-size:13px;background:${avatarColor(a.name)}">${esc(initials(a.name))}</div>
          <div><div style="font-size:14px;font-weight:500">${esc(a.name)}</div><div style="font-size:12px;color:var(--muted)">${esc(a.email)}</div></div></div></td>
        <td><span class="badge role-${a.role}">${ROLE_LABEL[a.role]}</span></td>
        <td><span class="badge st-${a.status}">${ACCOUNT_STATUS[a.status]}</span></td>
        <td style="font-size:13px;color:var(--muted)">${parseDate(a.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}</td>
        <td style="font-size:13px;color:var(--muted)">${parseDate(a.lastLogin).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</td>
        <td><div class="row" style="gap:8px">${toggle}
          <button class="btn btn-danger btn-sm" data-click="accounts:askDelete" data-id="${a.id}" aria-label="Eliminar la cuenta de ${esc(a.name)}">${icon("trash", 14)} Eliminar</button></div></td>
      </tr>`;
  },

  render() {
    const all = Data.accounts;
    const list = this.filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    this.page = Math.min(this.page, pages);
    const slice = list.slice((this.page - 1) * PAGE_SIZE, this.page * PAGE_SIZE);

    const stats = [
      { label: "Cuentas totales", value: all.length, color: "var(--text)" },
      { label: "Usuarios", value: all.filter((a) => a.role === "user").length, color: "var(--primary-fg)" },
      { label: "Agentes", value: all.filter((a) => a.role === "manager").length, color: "var(--primary-fg)" },
      { label: "Suspendidas", value: all.filter((a) => a.status === "suspendido").length, color: "var(--danger)" },
    ].map((s) => `
      <div class="kpi" style="padding:20px 24px">
        <div class="kpi-label" style="margin-bottom:8px">${s.label}</div>
        <div class="kpi-value" style="font-size:34px;color:${s.color}">${s.value}</div>
      </div>`).join("");

    const pill = (group, val, label) => `<button class="pill ${this[group] === val ? "active" : ""}" data-click="accounts:${group}" data-value="${val}">${label}</button>`;
    const suspend = Data.accounts.find((a) => a.id === this.suspendId);
    const del = Data.accounts.find((a) => a.id === this.deleteId);

    const from = list.length ? (this.page - 1) * PAGE_SIZE + 1 : 0, to = Math.min(this.page * PAGE_SIZE, list.length);
    return `
      <div class="page" style="--w:1680px">
        ${pageHeader({ eyebrow: "Plataforma", title: "Gestión de cuentas", subtitle: "Usuarios y Agentes registrados. Suspende o elimina cuentas cuando sea necesario." })}
        <div class="grid-kpi">${stats}</div>
        ${this.flash ? `<div class="toast" role="status">${icon("check", 20, { color: "#fff", width: 2.5 })}<span>${esc(this.flash)}</span></div>` : ""}

        <div class="filters-stack">
          <div class="filters" style="gap:10px">
            ${searchBox({ id: "accounts-search", placeholder: "Buscar por nombre o correo…", value: this.search, handler: "accounts:search" })}
          </div>
          <div class="filters scroll-x"><span class="fin-note" style="margin-right:4px">Rol</span>${pill("role", "todos", "Todos")}${pill("role", "user", "Usuarios")}${pill("role", "manager", "Agentes")}
            <span class="fin-note" style="margin:0 4px 0 14px">Estado</span>${pill("status", "todos", "Todos")}${pill("status", "activo", "Activos")}${pill("status", "suspendido", "Suspendidos")}</div>
        </div>

        <div class="card">
          <div class="table-scroll"><table class="table">
            <thead><tr><th>Cuenta</th><th>Rol</th><th>Estado</th><th>Registro</th><th>Último acceso</th><th>Acciones</th></tr></thead>
            <tbody>${slice.map((a) => this.row(a)).join("")}</tbody>
          </table></div>
          ${list.length === 0 ? `<div style="text-align:center;padding:48px 0"><div style="font-family:var(--font-title);font-size:20px;color:var(--muted)">Sin resultados</div></div>` : ""}
          <div class="acc-pager">
            <span>${list.length ? `Mostrando ${from}–${to} de ${list.length}` : "0 cuentas"}</span>
            <div class="row" style="gap:8px">
              <button class="btn btn-outline btn-sm" data-click="accounts:prev" ${this.page <= 1 ? "disabled" : ""}>${icon("left", 14)} Anterior</button>
              <span class="acc-page">${this.page} / ${pages}</span>
              <button class="btn btn-outline btn-sm" data-click="accounts:next" ${this.page >= pages ? "disabled" : ""}>Siguiente ${icon("right", 14)}</button>
            </div>
          </div>
        </div>

        ${suspend ? mgrModal({ title: "¿Desactivar esta cuenta?", cancel: "accounts:cancelSuspend", confirm: "accounts:confirmSuspend", label: "Sí, desactivar",
            body: `<p class="modal-confirm-text"><strong>${esc(suspend.name)}</strong> no podrá iniciar sesión hasta que vuelvas a activar su cuenta.</p>` }) : ""}
        ${del ? confirmModal({ title: `¿Eliminar la cuenta de ${esc(del.name)}?`, cancelAction: "accounts:cancelDelete", confirmAction: "accounts:confirmDelete" }) : ""}
      </div>`;
  },
};

registerInput({ "accounts:search": (el) => { AccountsPage.search = el.value; AccountsPage.page = 1; rerender(); } });

registerClick({
  "accounts:role":   (el) => { AccountsPage.role = el.dataset.value; AccountsPage.page = 1; rerender(); },
  "accounts:status": (el) => { AccountsPage.status = el.dataset.value; AccountsPage.page = 1; rerender(); },
  "accounts:prev":   () => { AccountsPage.page = Math.max(1, AccountsPage.page - 1); rerender(); },
  "accounts:next":   () => { AccountsPage.page += 1; rerender(); },

  "accounts:askSuspend":     (el) => { AccountsPage.suspendId = el.dataset.id; rerender(); },
  "accounts:cancelSuspend":  () => { AccountsPage.suspendId = null; rerender(); },
  "accounts:confirmSuspend": () => {
    const a = Data.accounts.find((x) => x.id === AccountsPage.suspendId);
    AccountsPage.suspendId = null;
    if (a) { a.status = "suspendido"; AccountsPage.say(`Cuenta de ${a.name} desactivada.`); } else rerender();
  },
  "accounts:activate": (el) => {
    const a = Data.accounts.find((x) => x.id === el.dataset.id);
    if (a) { a.status = "activo"; AccountsPage.say(`Cuenta de ${a.name} activada.`); }
  },

  "accounts:askDelete":     (el) => { AccountsPage.deleteId = el.dataset.id; rerender(); },
  "accounts:cancelDelete":  () => { AccountsPage.deleteId = null; rerender(); },
  "accounts:confirmDelete": () => {
    const a = Data.accounts.find((x) => x.id === AccountsPage.deleteId);
    AccountsPage.deleteId = null;
    if (!a) { rerender(); return; }
    Data.accounts = Data.accounts.filter((x) => x.id !== a.id);
    AccountsPage.say(`Cuenta de ${a.name} eliminada definitivamente.`);
  },
});
