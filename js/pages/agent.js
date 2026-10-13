/* ==========================================================
   pages/agent.js — Asistente de chat (pestaña «Asistente» de Mi panel)
   Las respuestas son predefinidas: no hay IA real conectada.
   ========================================================== */

const AGENT_SUGGESTIONS = [
  "¿Qué fiestas hay próximamente?",
  "¿Cómo me inscribo a un evento?",
  "¿Cuántos cupos quedan en el Color Fest?",
  "¿Qué eventos son gratis?",
];

// Las respuestas se arman con los datos reales (Data.events), así nunca quedan desactualizadas.
const agentList = (evs) => evs.map((e) => `• **${e.name}** — ${parseDate(e.date).toLocaleDateString("es-CO", { day: "numeric", month: "short" })} · ${priceLabel(e)}`).join("\n");
const agentUpcoming = () => Data.events.filter((e) => !["completado", "cancelado"].includes(e.status)).sort((a, b) => a.date.localeCompare(b.date));

function agentReply(text) {
  const q = normalize(text);
  if (/gratis|gratuit|sin costo/.test(q)) {
    const free = agentUpcoming().filter((e) => !e.price);
    return free.length ? `Estos eventos son gratuitos:\n\n${agentList(free)}` : "Por ahora todos los eventos tienen cover o boletería.";
  }
  if (/fiesta|rumba|party|concierto|musica|banda/.test(q)) {
    const fun = agentUpcoming().filter((e) => ["fiesta", "musica"].includes(e.type));
    return fun.length ? `Estos son los próximos planes de fiesta y música:\n\n${agentList(fun)}\n\n¿Quieres que te cuente de alguno?` : "No hay fiestas programadas por ahora.";
  }
  if (/cupo|quedan|disponible/.test(q)) {
    const ev = Data.events.find((e) => q.includes(normalize(e.name.split(/[:\s]/).slice(0, 2).join(" "))));
    if (ev) { const n = UserApp.getSpots(ev.id); return `**${ev.name}** tiene **${n} cupos disponibles** de ${ev.capacity}${n <= 20 && n > 0 ? ". Quedan muy pocos, te recomiendo inscribirte pronto." : "."}`; }
  }
  if (/inscrib|registr/.test(q)) {
    return "Es muy fácil: en el **Home** elige un evento y pulsa **Inscribirse**. Confirma tu cupo en la ventana que se abre y listo. Tus inscripciones las ves en **Mi panel → Mis inscripciones**.";
  }
  if (/semana|proxim|cuando|que eventos/.test(q)) {
    return `Estos son los próximos eventos:\n\n${agentList(agentUpcoming().slice(0, 5))}`;
  }
  if (q.includes("evento")) return "Puedo ayudarte con información sobre eventos, precios, cupos disponibles e inscripciones. ¿Qué necesitas saber?";
  return "Entendido. Soy el asistente de EventPro y puedo ayudarte con eventos, precios, inscripciones y más. ¿Qué te gustaría saber?";
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
            ? "Hola. Soy el asistente de EventPro. ¿En qué te ayudo hoy?"
            : "Hola. Soy tu asistente de eventos. Te ayudo a encontrar fiestas y planes, inscribirte, ver cupos disponibles y gestionar tu agenda. ¿Qué necesitas?",
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
      if (App.currentPage() === AgentPage || (Session.isUser && UserApp.view === "asistente")) rerender();
    }, 900 + Math.random() * 600);
  },

  renderMessage(msg) {
    const isUser = msg.role === "user";
    const avatar = isUser
      ? `<div class="chat-avatar" style="background:#b8b2ea;color:#16123b;font-size:13px;font-weight:700">${this.isAdmin() ? "SN" : "CM"}</div>`
      : `<div class="chat-avatar chat-avatar-bot">${icon("chat", 16, { color: "#f4f1ff" })}</div>`;

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
        <div class="chat-avatar chat-avatar-bot">${icon("chat", 16, { color: "#f4f1ff" })}</div>
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
            <div class="chat-logo">${icon("chat", 24, { color: "#f4f1ff", width: 1.8 })}</div>
            <div>
              <div style="font-family:var(--font-title);font-size:22px;font-weight:700">Asistente EventPro</div>
              <div class="row" style="gap:6px;margin-top:3px">
                <span class="dot" style="width:8px;height:8px;background:#2b6bff"></span>
                <span style="font-size:12px;color:var(--muted)">En línea · Responde al instante</span>
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
