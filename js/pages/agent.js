/* ==========================================================
   pages/agent.js — Asistente de chat (compartido por admin y usuario)
   Las respuestas son predefinidas: no hay IA real conectada.
   ========================================================== */

const AGENT_SUGGESTIONS = [
  "¿Qué eventos hay esta semana?",
  "¿Cómo me inscribo a un evento?",
  "¿Cuántos cupos quedan en el Festival de Música?",
  "¿Cuáles son los eventos académicos disponibles?",
];

const AGENT_REPLIES = {
  "¿qué eventos hay esta semana?": "Esta semana tienes el **Torneo Interfacultades de Fútbol** (22 ago · 07:00) y la **Ceremonia de Grados de Ingeniería** (30 ago · 10:00). ¡Ambos con cupos disponibles! ¿Quieres inscribirte?",
  "¿cómo me inscribo a un evento?": "Muy fácil 👉 Ve a **Explorar eventos**, encuentra el evento que te interesa y haz clic en **\"Inscribirse al evento\"**. Te aparecerá una confirmación y listo. Tus inscripciones las ves en **Mis inscripciones**.",
  "¿cuántos cupos quedan en el festival de música?": "El **Festival de Música Andina** (10 oct) tiene **308 cupos disponibles** de 1200 totales. Está bastante solicitado — te recomiendo inscribirte pronto 🎵",
  "¿cuáles son los eventos académicos disponibles?": "Ahora mismo hay **2 eventos académicos** abiertos:\n\n• **Cumbre de Innovación Académica 2026** — 15 sep · 158 cupos\n• **Simposio de Biotecnología Tropical** — 5 sep · 44 cupos\n\n¿Te interesa alguno?",
};

function agentReply(text) {
  const lower = text.toLowerCase().trim();
  for (const [key, val] of Object.entries(AGENT_REPLIES)) {
    if (lower.includes(key.replace(/[¿?]/g, "").trim().slice(0, 15))) return val;
  }
  if (lower.includes("evento") || lower.includes("inscrip")) {
    return "Puedo ayudarte con información sobre eventos, cupos disponibles e inscripciones. ¿Qué necesitas saber? 🎯";
  }
  return "Entendido. Soy el asistente de EventPro y puedo ayudarte con eventos, inscripciones y más. ¿Qué te gustaría saber? 😊";
}

function nowTime() {
  return new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

// Escapa el texto y convierte **negrita** en <strong>
function formatMessage(text) {
  return esc(text).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

const AgentPage = {
  states: {},   // un chat independiente para admin y otro para usuario

  isAdmin() { return App.mode === "admin"; },

  /* Estado del chat actual (se crea la primera vez que se abre) */
  state() {
    const key = this.isAdmin() ? "admin" : "user";
    if (!this.states[key]) {
      this.states[key] = {
        messages: [{
          id: "0", role: "agent", time: nowTime(),
          text: this.isAdmin()
            ? "Hola 👋 Soy el asistente de EventPro. Puedo ayudarte a consultar estadísticas de eventos, tareas pendientes, asistentes y más. ¿En qué te ayudo hoy?"
            : "Hola 👋 Soy tu asistente de eventos. Te ayudo a encontrar eventos, inscribirte, ver cupos disponibles y gestionar tu agenda. ¿Qué necesitas?",
        }],
        input: "",
        loading: false,
      };
    }
    return this.states[key];
  },

  send(text) {
    const s = this.state();
    if (!text.trim() || s.loading) return;

    s.messages.push({ id: String(Date.now()), role: "user", text: text.trim(), time: nowTime() });
    s.input = "";
    s.loading = true;
    rerender();

    setTimeout(() => {
      s.messages.push({ id: String(Date.now() + 1), role: "agent", text: agentReply(text), time: nowTime() });
      s.loading = false;
      if (App.currentPage() === AgentPage) rerender();
    }, 900 + Math.random() * 600);
  },

  renderMessage(msg) {
    const isUser = msg.role === "user";
    const avatar = isUser
      ? `<div class="chat-avatar" style="background:#cfbb99;color:#4c3d19;font-size:13px;font-weight:700">${this.isAdmin() ? "SN" : "CM"}</div>`
      : `<div class="chat-avatar chat-avatar-bot">${icon("chat", 16, { color: "#e5d7c4" })}</div>`;

    return `
      <div class="msg ${isUser ? "user" : ""}">
        ${avatar}
        <div style="max-width:70%">
          <div class="bubble ${isUser ? "user" : "agent"}">${formatMessage(msg.text)}</div>
          <div class="msg-time ${isUser ? "right" : ""}">${msg.time}</div>
        </div>
      </div>`;
  },

  render() {
    const s = this.state();
    const canSend = s.input.trim() && !s.loading;

    const typing = s.loading ? `
      <div class="msg">
        <div class="chat-avatar chat-avatar-bot">${icon("chat", 16, { color: "#e5d7c4" })}</div>
        <div class="bubble agent typing">
          ${[0, 1, 2].map((i) => `<span style="animation:bounce 1.2s ${i * 0.2}s infinite"></span>`).join("")}
        </div>
      </div>` : "";

    const suggestions = s.messages.length <= 1 ? `
      <div class="suggestions">
        ${AGENT_SUGGESTIONS.map((t) => `<button class="suggestion" data-click="agent:suggest" data-text="${esc(t)}">${esc(t)}</button>`).join("")}
      </div>` : "";

    return `
      <div class="chat">
        <div class="chat-header">
          <div class="row" style="gap:16px">
            <div class="chat-logo">${icon("chat", 24, { color: "#e5d7c4", width: 1.8 })}</div>
            <div>
              <div style="font-family:var(--font-title);font-size:22px;font-weight:600">Asistente EventPro</div>
              <div class="row" style="gap:6px;margin-top:3px">
                <span class="dot" style="width:8px;height:8px;background:#4a5a33"></span>
                <span style="font-size:12px;color:#889063">En línea · Responde al instante</span>
              </div>
            </div>
          </div>
        </div>

        <div class="chat-messages" id="chat-messages">
          ${s.messages.map((m) => this.renderMessage(m)).join("")}
          ${typing}
        </div>

        ${suggestions}

        <div class="chat-footer">
          <div class="row" style="gap:10px;align-items:flex-end">
            <div class="chat-field">
              <input id="agent-input" value="${esc(s.input)}" placeholder="Escribe tu mensaje aquí…"
                     data-input="agent:input" data-enter="agent:send" autocomplete="off">
            </div>
            <button id="agent-send" class="send-btn" data-click="agent:send" ${canSend ? "" : "disabled"}>
              ${icon("send", 18, { width: 2.5 })}
            </button>
          </div>
          <p class="chat-hint">Presiona Enter para enviar · El asistente puede cometer errores</p>
        </div>
      </div>`;
  },

  /* Después de dibujar, baja al último mensaje */
  afterRender() {
    const box = document.getElementById("chat-messages");
    if (box) box.scrollTop = box.scrollHeight;
  },
};

registerInput({
  // Escribir no vuelve a dibujar la página: solo activa/desactiva el botón de enviar
  "agent:input": (el) => {
    const s = AgentPage.state();
    s.input = el.value;
    const btn = document.getElementById("agent-send");
    if (btn) btn.disabled = !(s.input.trim() && !s.loading);
  },
});

registerEnter({ "agent:send": () => AgentPage.send(AgentPage.state().input) });

registerClick({
  "agent:send":    () => AgentPage.send(AgentPage.state().input),
  "agent:suggest": (el) => AgentPage.send(el.dataset.text),
});
