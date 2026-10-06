/* ==========================================================
   pages/landing.js — Pantalla de bienvenida (elige Admin o Usuario)
   ========================================================== */

const LANDING_STATS = [
  { value: "7",     label: "Eventos activos" },
  { value: "1.5K+", label: "Asistentes" },
  { value: "5",     label: "Tipos de evento" },
];

const LandingPage = {
  render() {
    const stats = LANDING_STATS.map((s) => `
      <div class="landing-stat">
        <div class="landing-stat-value">${s.value}</div>
        <div class="landing-stat-label">${s.label}</div>
      </div>`).join("");

    return `
      <div class="landing">
        <div class="landing-bg">
          <div class="landing-blob landing-blob-1"></div>
          <div class="landing-blob landing-blob-2"></div>
          <div class="landing-blob landing-blob-3"></div>
        </div>

        <header class="landing-header">
          <div class="landing-logo"><span>E</span></div>
          <div>
            <div class="landing-brand">EventPro</div>
            <div class="landing-tagline">Plataforma de gestión de eventos</div>
          </div>
        </header>

        <section class="landing-hero">
          <div class="landing-badge">
            <span class="landing-badge-dot"></span>
            <span>Bienvenido a EventPro 2026</span>
          </div>

          <h1 class="landing-title">
            Conecta con los<br>
            <span>eventos que importan</span>
          </h1>

          <p class="landing-text">
            Descubre, gestiona y vive los mejores eventos académicos, culturales y deportivos de tu institución.
          </p>

          <div class="landing-cards">
            <button class="mode-card mode-card-admin" data-click="app:goAdmin">
              <div class="mode-icon">${icon("shield", 22, { color: "#cfbb99" })}</div>
              <div class="mode-title">Administrador</div>
              <p class="mode-text">Gestiona eventos, asistentes, tareas y presupuestos.</p>
              <div class="mode-cta">Entrar como Admin ${icon("right", 14, { width: 2.5 })}</div>
            </button>

            <button class="mode-card mode-card-user" data-click="app:goUser">
              <div class="mode-icon">${icon("user", 22, { color: "#e5d7c4" })}</div>
              <div class="mode-title">Usuario</div>
              <p class="mode-text">Explora eventos, inscríbete y gestiona tu agenda.</p>
              <div class="mode-cta">Explorar eventos ${icon("right", 14, { width: 2.5 })}</div>
            </button>
          </div>

          <div class="landing-stats">${stats}</div>
        </section>
      </div>`;
  },
};
