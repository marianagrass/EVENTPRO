/* ==========================================================
   components/auth/auth-forms.js — LoginForm · RegisterForm · ForgotForm
   Solo DIBUJAN el formulario a partir del estado que les pasa AuthModal:
     state = { values, errors, formError, notice, busy }
   No hacen peticiones ni cambian la sesión (eso lo hace AuthModal → Session → AuthApi).
   Accesibilidad: <label for>, aria-invalid, aria-describedby, role="alert" y autocomplete correcto
   (los gestores de contraseñas del navegador funcionan).
   ========================================================== */

const AF = {
  /** Campo con ícono, mensaje de error y (opcional) botón de mostrar/ocultar contraseña */
  field({ id, key, label, type = "text", ic, value = "", autocomplete, placeholder = "", error = "", hint = "", toggle = false, inputmode = "", extra = "" }) {
    const describedBy = [error ? `${id}-err` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ");
    return `
      <div class="af-field">
        <div class="af-label-row"><label class="af-label" for="${id}">${label}</label>${extra}</div>
        <div class="af-control ${error ? "is-invalid" : ""}">
          ${icon(ic, 18, { width: 1.8 })}
          <input id="${id}" name="${key}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}"
                 autocomplete="${autocomplete}" ${inputmode ? `inputmode="${inputmode}"` : ""} spellcheck="false"
                 ${type === "email" ? 'autocapitalize="none"' : ""}
                 data-input="auth:field" data-key="${key}" aria-invalid="${error ? "true" : "false"}"
                 ${describedBy ? `aria-describedby="${describedBy}"` : ""}>
          ${toggle ? `<button type="button" class="af-eye" data-click="auth:togglePw" data-target="${id}" aria-label="Mostrar contraseña" aria-pressed="false">${icon("eye", 18, { width: 1.8 })}</button>` : ""}
        </div>
        ${error ? `<p class="af-err" id="${id}-err" role="alert">${esc(error)}</p>` : ""}
        ${hint ? `<p class="af-hint" id="${id}-hint">${hint}</p>` : ""}
      </div>`;
  },

  /** Aviso general del formulario (credenciales incorrectas, cuenta suspendida, sin conexión…) */
  alert(msg) {
    return msg ? `<div class="af-alert" id="af-form-error" role="alert" tabindex="-1">${icon("alert", 18, { width: 2 })}<span>${esc(msg)}</span></div>` : "";
  },

  submit(label, busyLabel, busy) {
    return `
      <button type="submit" class="btn btn-primary btn-xl btn-block af-submit" data-busy="${esc(busyLabel)}" ${busy ? 'disabled aria-busy="true"' : ""}>
        ${busy ? `<span class="af-spin" aria-hidden="true"></span>${busyLabel}` : label}
      </button>`;
  },

  divider(text) { return `<div class="af-or"><span>${text}</span></div>`; },

  /** Medidor de seguridad (se actualiza al escribir sin volver a dibujar: AuthModal.updateMeter) */
  meter(password) {
    const lvl = AuthValidators.strength(password);
    const labels = ["", "Débil", "Aceptable", "Buena", "Fuerte"];
    return `
      <div class="af-meter" id="af-meter" data-level="${lvl}" aria-live="polite">
        <span class="af-bars"><i></i><i></i><i></i><i></i></span>
        <span class="af-meter-label" id="af-meter-label">${password ? `Seguridad: ${labels[lvl] || "Débil"}` : ""}</span>
      </div>`;
  },
};

/* ---------------------------------- Login ---------------------------------- */
const LoginForm = {
  render({ values, errors, formError, busy }) {
    return `
      <form class="af" data-submit="auth:submit" data-view="login" novalidate aria-label="Iniciar sesión">
        ${AF.alert(formError)}
        ${AF.field({ id: "af-email", key: "email", label: "Correo electrónico", type: "email", ic: "mail", value: values.email,
                     autocomplete: "email", placeholder: "tucorreo@ejemplo.com", inputmode: "email", error: errors.email })}
        ${AF.field({ id: "af-password", key: "password", label: "Contraseña", type: "password", ic: "lock", value: values.password,
                     autocomplete: "current-password", placeholder: "Tu contraseña", error: errors.password, toggle: true,
                     extra: `<button type="button" class="af-link" data-click="auth:switch" data-view="forgot">¿Olvidaste tu contraseña?</button>` })}
        ${AF.submit("Iniciar sesión", "Ingresando…", busy)}
        ${AF.divider("¿Aún no tienes cuenta?")}
        <button type="button" class="btn btn-outline btn-xl btn-block" data-click="auth:switch" data-view="register" ${busy ? "disabled" : ""}>Crear cuenta</button>
      </form>`;
  },
};

/* --------------------------------- Registro --------------------------------- */
const RegisterForm = {
  render({ values, errors, formError, busy }) {
    return `
      <form class="af" data-submit="auth:submit" data-view="register" novalidate aria-label="Crear cuenta">
        ${AF.alert(formError)}
        ${AF.field({ id: "af-name", key: "name", label: "Nombre completo", ic: "user", value: values.name,
                     autocomplete: "name", placeholder: "Nombre y apellido", error: errors.name })}
        ${AF.field({ id: "af-email", key: "email", label: "Correo electrónico", type: "email", ic: "mail", value: values.email,
                     autocomplete: "email", placeholder: "tucorreo@ejemplo.com", inputmode: "email", error: errors.email })}
        ${AF.field({ id: "af-password", key: "password", label: "Contraseña", type: "password", ic: "lock", value: values.password,
                     autocomplete: "new-password", placeholder: `Mínimo ${AuthConfig.RULES.minPassword} caracteres`, error: errors.password, toggle: true,
                     hint: errors.password ? "" : "Usa letras y números." })}
        ${AF.meter(values.password)}
        ${AF.field({ id: "af-confirm", key: "confirm", label: "Confirmar contraseña", type: "password", ic: "lock", value: values.confirm,
                     autocomplete: "new-password", placeholder: "Repite tu contraseña", error: errors.confirm, toggle: true })}
        ${AF.submit("Crear cuenta", "Creando cuenta…", busy)}
        <p class="af-note">${icon("shield", 14, { width: 2 })}<span>Las cuentas públicas son de <b>Usuario</b>. Las de Agente y Administrador las crea el administrador de la plataforma.</span></p>
        ${AF.divider("¿Ya tienes cuenta?")}
        <button type="button" class="btn btn-outline btn-xl btn-block" data-click="auth:switch" data-view="login" ${busy ? "disabled" : ""}>Iniciar sesión</button>
      </form>`;
  },
};

/* ------------------------- Recuperar contraseña ------------------------- */
const ForgotForm = {
  render({ values, errors, formError, notice, busy }) {
    if (notice) {
      return `
        <div class="af af-done">
          <span class="af-done-ic">${icon("mail", 26, { color: "#fff", width: 2 })}</span>
          <p class="af-done-text" role="status">${esc(notice)}</p>
          <button type="button" class="btn btn-primary btn-xl btn-block" data-click="auth:switch" data-view="login">Volver a iniciar sesión</button>
        </div>`;
    }
    return `
      <form class="af" data-submit="auth:submit" data-view="forgot" novalidate aria-label="Recuperar contraseña">
        ${AF.alert(formError)}
        ${AF.field({ id: "af-email", key: "email", label: "Correo electrónico", type: "email", ic: "mail", value: values.email,
                     autocomplete: "email", placeholder: "tucorreo@ejemplo.com", inputmode: "email", error: errors.email })}
        ${AF.submit("Enviar instrucciones", "Enviando…", busy)}
        <button type="button" class="btn btn-outline btn-xl btn-block" data-click="auth:switch" data-view="login" ${busy ? "disabled" : ""}>${icon("left", 16, { width: 2.4 })} Volver</button>
      </form>`;
  },
};
