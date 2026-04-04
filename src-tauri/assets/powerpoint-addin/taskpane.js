// ── CodeForge AI — PowerPoint Add-in ─────────────────────────────────────────
const HUB_URL      = "ws://127.0.0.1:7471";
const RECONNECT_MS = 3000;

let ws              = null;
let isConnected     = false;
let isStreaming     = false;
let currentAiEl    = null;
let mode            = "ask";
let pendingContent  = null;
let pendingMacro    = null;
let activeSlideIdx  = 0;

// ── DOM ───────────────────────────────────────────────────────────────────────
const $chat      = () => document.getElementById("chat");
const $question  = () => document.getElementById("question");
const $askBtn    = () => document.getElementById("askBtn");
const $statusDot = () => document.getElementById("statusDot");
const $statusTxt = () => document.getElementById("statusText");
const $subHint   = () => document.getElementById("subHint");
const $empty     = () => document.getElementById("emptyState");

// ── Mode ──────────────────────────────────────────────────────────────────────
const MODE_CONFIG = {
  ask:        { icon: "📊", title: "Ask about this slide",         sub: "Ask any question about the current slide content.",             btn: "Ask",      hint: "Ask about the current slide",              placeholder: "e.g. Summarize this slide" },
  write:      { icon: "✍️", title: "Write slide content",          sub: "Describe what to write — AI generates text and inserts it.",    btn: "Write",    hint: "Describe content: bullets, paragraph, list…", placeholder: "e.g. Write 5 benefits of AI in healthcare" },
  transition: { icon: "🎬", title: "Add slide transition",         sub: "Describe the transition — AI generates VBA to apply it.",       btn: "Generate", hint: "Describe the transition effect you want",     placeholder: "e.g. Fade transition on all slides" },
  animation:  { icon: "✨", title: "Animate slide elements",       sub: "Describe the animation — AI generates VBA to apply it.",       btn: "Generate", hint: "Describe the animation effect you want",     placeholder: "e.g. Fly in from left on title shape" },
  background: { icon: "🎨", title: "Change slide background",      sub: "Describe the background — AI generates VBA to apply it.",      btn: "Generate", hint: "Describe the background color or gradient",   placeholder: "e.g. Dark navy blue background on all slides" },
};

function setMode(m) {
  mode = m;
  ["ask","write","transition","animation","background"].forEach(id => {
    const el = document.getElementById("mode_" + id);
    if (el) el.classList.toggle("active", id === m);
  });
  const cfg = MODE_CONFIG[m];
  $askBtn().textContent        = cfg.btn;
  $question().placeholder      = cfg.placeholder;
  document.getElementById("emptyIcon").textContent  = cfg.icon;
  document.getElementById("emptyTitle").textContent = cfg.title;
  document.getElementById("emptySub").textContent   = cfg.sub;
  updateAskBtn();
}

// ── Connection status ─────────────────────────────────────────────────────────
function setConnected(v) {
  isConnected = v;
  $statusDot().className   = "status-dot" + (v ? " connected" : "");
  $statusTxt().textContent = v ? "Connected" : "Disconnected";
  updateAskBtn();
}
function updateAskBtn() {
  const hasText = $question().value.trim().length > 0;
  $askBtn().disabled = !isConnected || isStreaming || !hasText;
  const cfg = MODE_CONFIG[mode] || MODE_CONFIG.ask;
  if (!isConnected)   $subHint().textContent = "⚠️ Open CodeForge app first";
  else if (isStreaming) $subHint().textContent = "Generating…";
  else                $subHint().textContent = cfg.hint;
}

// ── Chat rendering ────────────────────────────────────────────────────────────
function hideEmpty() { const e = $empty(); if (e) e.remove(); }
function addMessage(text, type) {
  hideEmpty();
  const d = document.createElement("div");
  d.className   = "msg " + type;
  d.textContent = text;
  $chat().appendChild(d);
  $chat().scrollTop = $chat().scrollHeight;
  return d;
}
function startAiMessage() {
  hideEmpty();
  const d = document.createElement("div");
  d.className = "msg ai";
  d.innerHTML = '<span class="cursor"></span>';
  $chat().appendChild(d);
  $chat().scrollTop = $chat().scrollHeight;
  currentAiEl = d;
  return d;
}
function appendToken(t) {
  if (!currentAiEl) startAiMessage();
  const cursor = currentAiEl.querySelector(".cursor");
  currentAiEl.insertBefore(document.createTextNode(t), cursor);
  $chat().scrollTop = $chat().scrollHeight;
}
function finishAiMessage() {
  if (currentAiEl) {
    const cursor = currentAiEl.querySelector(".cursor");
    if (cursor) cursor.remove();

    if (mode === "write") {
      const text = currentAiEl.textContent.trim();
      if (text) {
        pendingContent = text;
        const btn = document.createElement("button");
        btn.className   = "insert-btn";
        btn.textContent = "⬆ Insert into slide";
        btn.onclick     = insertToSlide;
        currentAiEl.appendChild(btn);
      }
    }

    if (mode === "transition" || mode === "animation" || mode === "background") {
      const text = currentAiEl.textContent.trim();
      const vbaMatch = text.match(/(?:Sub|Function)\s+\w[\s\S]*?End\s+(?:Sub|Function)/i);
      if (vbaMatch) {
        pendingMacro = vbaMatch[0].trim();
        const btn = document.createElement("button");
        btn.className   = "insert-btn macro-btn";
        btn.textContent = "📋 Copy VBA & Open Editor";
        btn.onclick     = copyMacro;
        currentAiEl.appendChild(btn);
      }
    }

    currentAiEl = null;
  }
  isStreaming = false;
  updateAskBtn();
}

// ── Insert generated content as text box on slide ─────────────────────────────
async function insertToSlide() {
  if (!pendingContent) return;
  const content = pendingContent;
  pendingContent = null;
  document.querySelectorAll(".insert-btn").forEach(b => { b.disabled = true; b.textContent = "Inserting…"; });
  try {
    await PowerPoint.run(async (context) => {
      const slides = context.presentation.slides;
      slides.load("items");
      await context.sync();
      if (slides.items.length === 0) throw new Error("No slides found");
      const slide = slides.items[activeSlideIdx] || slides.items[0];
      slide.shapes.addTextBox(content, { left: 50, top: 160, width: 620, height: 340 });
      await context.sync();
      addMessage("✅ Content inserted into slide " + (activeSlideIdx + 1), "status-msg");
    });
  } catch (err) { addMessage("⚠️ Insert failed: " + err.message, "error"); }
  document.querySelectorAll(".insert-btn").forEach(b => { b.disabled = false; });
}

// ── Copy VBA macro to clipboard ───────────────────────────────────────────────
async function copyMacro() {
  if (!pendingMacro) return;
  try {
    await navigator.clipboard.writeText(pendingMacro);
    document.querySelectorAll(".macro-btn").forEach(b => { b.textContent = "✅ Copied! Press Alt+F11 → Paste → F5"; });
    addMessage("📋 VBA copied! Press Alt+F11 to open the VBA editor, paste with Ctrl+V, then press F5 to run.", "status-msg");
  } catch {
    addMessage("⚠️ Copy failed. Please copy the code above manually.", "error");
  }
  pendingMacro = null;
}

// ── Read current slide text ───────────────────────────────────────────────────
function getSlideText() {
  return new Promise((resolve) => {
    try {
      Office.context.document.getSelectedDataAsync(Office.CoercionType.Text, (result) => {
        resolve(result.status === Office.AsyncResultStatus.Succeeded ? (result.value || "") : "");
      });
    } catch { resolve(""); }
  });
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
function connect() {
  try { ws = new WebSocket(HUB_URL); } catch { setTimeout(connect, RECONNECT_MS); return; }
  ws.onopen    = () => { ws.send(JSON.stringify({ type: "hello", editor: "powerpoint" })); setConnected(true); };
  ws.onmessage = (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    switch (msg.type) {
      case "token": if (msg.content) appendToken(msg.content); break;
      case "done":  finishAiMessage(); break;
      case "error": finishAiMessage(); addMessage("⚠️ " + (msg.message || "Error"), "error"); break;
    }
  };
  ws.onclose = () => { setConnected(false); if (isStreaming) finishAiMessage(); setTimeout(connect, RECONNECT_MS); };
  ws.onerror = () => ws.close();
}

// ── Ask mode ──────────────────────────────────────────────────────────────────
async function askQuestion() {
  const question = $question().value.trim();
  if (!question || !isConnected || isStreaming) return;
  const slideText = await getSlideText();
  const slideNum  = activeSlideIdx + 1;
  const tokens    = question.toLowerCase().startsWith("explain") ? 1500
                  : question.toLowerCase().includes("summar")    ? 800 : 600;
  addMessage(`📊 Slide ${slideNum}`, "status-msg");
  addMessage(question, "user");
  $question().value = ""; $question().style.height = "";
  isStreaming = true; updateAskBtn(); startAiMessage();
  ws.send(JSON.stringify({ type: "ppt_query", question, slideText, slideIndex: slideNum, suggestedTokens: tokens }));
}

// ── Write mode ────────────────────────────────────────────────────────────────
async function askWrite() {
  const request = $question().value.trim();
  if (!request || !isConnected || isStreaming) return;
  addMessage("✍️ Writing content…", "status-msg");
  addMessage(request, "user");
  $question().value = ""; $question().style.height = "";
  isStreaming = true; updateAskBtn(); startAiMessage();
  ws.send(JSON.stringify({ type: "ppt_write", request, suggestedTokens: 600 }));
}

// ── Transition / Animation / Background (VBA macro) modes ─────────────────────
async function askMacro(macroMode) {
  const request = $question().value.trim();
  if (!request || !isConnected || isStreaming) return;
  const icons = { transition: "🎬", animation: "✨", background: "🎨" };
  addMessage(`${icons[macroMode] || "🔧"} Generating VBA…`, "status-msg");
  addMessage(request, "user");
  $question().value = ""; $question().style.height = "";
  isStreaming = true; updateAskBtn(); startAiMessage();
  ws.send(JSON.stringify({ type: "ppt_macro", request, macroMode, suggestedTokens: 800 }));
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function ask() {
  if (mode === "ask")        return askQuestion();
  if (mode === "write")      return askWrite();
  return askMacro(mode);
}
function handleKey(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }
function autoResize(el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 90) + "px"; updateAskBtn(); }

Office.onReady(() => {
  connect();
  $question().addEventListener("input", updateAskBtn);
  setMode("ask");
});
