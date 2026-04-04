// ── CodeForge AI — Word Add-in ────────────────────────────────────────────────
const HUB_URL      = "ws://127.0.0.1:7471";
const RECONNECT_MS = 3000;

let ws             = null;
let isConnected    = false;
let isStreaming    = false;
let currentAiEl   = null;
let mode           = "ask";
let pendingRewrite = null;

// ── DOM ───────────────────────────────────────────────────────────────────────
const $chat      = () => document.getElementById("chat");
const $question  = () => document.getElementById("question");
const $askBtn    = () => document.getElementById("askBtn");
const $statusDot = () => document.getElementById("statusDot");
const $statusTxt = () => document.getElementById("statusText");
const $subHint   = () => document.getElementById("subHint");
const $empty     = () => document.getElementById("emptyState");

// ── Mode ──────────────────────────────────────────────────────────────────────
function setMode(m) {
  mode = m;
  document.getElementById("modeAsk").classList.toggle("active",     m === "ask");
  document.getElementById("modeRewrite").classList.toggle("active", m === "rewrite");
  $askBtn().textContent     = m === "ask" ? "Ask" : "Rewrite";
  $question().placeholder   = m === "ask"
    ? "e.g. Summarize this document"
    : "e.g. Make this more professional and concise";

  const icon  = document.getElementById("emptyIcon");
  const title = document.getElementById("emptyTitle");
  const sub   = document.getElementById("emptySub");
  if (m === "ask") {
    icon.textContent  = "📄";
    title.textContent = "Ask about your document";
    sub.textContent   = "Select text or leave blank to ask about the full document.";
  } else {
    icon.textContent  = "✏️";
    title.textContent = "Rewrite selected text";
    sub.textContent   = "Select text in Word, then describe how to rewrite it.";
  }
  updateAskBtn();
}

// ── Connection status ─────────────────────────────────────────────────────────
function setConnected(v) {
  isConnected = v;
  $statusDot().className    = "status-dot" + (v ? " connected" : "");
  $statusTxt().textContent  = v ? "Connected" : "Disconnected";
  updateAskBtn();
}
function updateAskBtn() {
  const hasText = $question().value.trim().length > 0;
  $askBtn().disabled = !isConnected || isStreaming || !hasText;
  if (!isConnected)          $subHint().textContent = "⚠️ Open CodeForge app first";
  else if (isStreaming)      $subHint().textContent = "Answering…";
  else if (mode === "ask")   $subHint().textContent = "Select text or ask about the full document";
  else                       $subHint().textContent = "Select text in Word first, then describe changes";
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
    // In rewrite mode, add an Insert button to replace selected text
    if (mode === "rewrite") {
      const text = currentAiEl.textContent.trim();
      if (text) {
        pendingRewrite = text;
        const btn = document.createElement("button");
        btn.className   = "insert-btn";
        btn.textContent = "⬆ Replace selected text in Word";
        btn.onclick     = insertRewrite;
        currentAiEl.appendChild(btn);
      }
    }
    currentAiEl = null;
  }
  isStreaming = false;
  updateAskBtn();
}

// ── Insert rewritten text into Word ──────────────────────────────────────────
async function insertRewrite() {
  if (!pendingRewrite) return;
  const text = pendingRewrite;
  pendingRewrite = null;
  document.querySelectorAll(".insert-btn").forEach(b => { b.disabled = true; b.textContent = "Inserting…"; });
  try {
    await Word.run(async (context) => {
      const sel = context.document.getSelection();
      sel.insertText(text, "Replace");
      await context.sync();
      addMessage("✅ Text replaced in Word", "status-msg");
    });
  } catch (err) {
    addMessage("⚠️ Insert failed: " + err.message, "error");
  }
  document.querySelectorAll(".insert-btn").forEach(b => { b.disabled = false; });
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
function connect() {
  try { ws = new WebSocket(HUB_URL); } catch { setTimeout(connect, RECONNECT_MS); return; }
  ws.onopen    = () => { ws.send(JSON.stringify({ type: "hello", editor: "word" })); setConnected(true); };
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

  try {
    await Word.run(async (context) => {
      // Read selected text first
      const sel = context.document.getSelection();
      sel.load("text");
      await context.sync();

      let docText      = sel.text.trim();
      let contextLabel = "";

      if (!docText) {
        // Nothing selected — read whole document (capped at 4000 chars)
        const body = context.document.body;
        body.load("text");
        await context.sync();
        docText      = body.text.trim().slice(0, 4000);
        contextLabel = "Full document";
      } else {
        contextLabel = "Selected text";
      }

      const tokens = question.toLowerCase().startsWith("explain")  ? 1500
                   : question.toLowerCase().includes("summar")     ? 800
                   : 600;

      addMessage(`📄 ${contextLabel} · ${docText.length} chars`, "status-msg");
      addMessage(question, "user");
      $question().value      = "";
      $question().style.height = "";
      updateAskBtn();
      isStreaming = true;
      updateAskBtn();
      startAiMessage();

      ws.send(JSON.stringify({
        type:            "word_query",
        question,
        docText,
        contextLabel,
        suggestedTokens: tokens,
      }));
    });
  } catch (err) {
    isStreaming = false;
    updateAskBtn();
    addMessage("⚠️ " + err.message, "error");
  }
}

// ── Rewrite mode ──────────────────────────────────────────────────────────────
async function askRewrite() {
  const instruction = $question().value.trim();
  if (!instruction || !isConnected || isStreaming) return;

  try {
    await Word.run(async (context) => {
      const sel = context.document.getSelection();
      sel.load("text");
      await context.sync();

      const selectedText = sel.text.trim();
      if (!selectedText) {
        addMessage("⚠️ Select text in Word first, then click Rewrite.", "error");
        return;
      }

      // Token budget: roughly 2x the original word count + buffer
      const wordCount     = selectedText.split(/\s+/).length;
      const tokens        = Math.min(wordCount * 2 + 200, 1500);

      addMessage(`✏️ Rewriting ${selectedText.length} chars`, "status-msg");
      addMessage(instruction, "user");
      $question().value      = "";
      $question().style.height = "";
      updateAskBtn();
      isStreaming = true;
      updateAskBtn();
      startAiMessage();

      ws.send(JSON.stringify({
        type:            "word_rewrite",
        instruction,
        selectedText,
        suggestedTokens: tokens,
      }));
    });
  } catch (err) {
    isStreaming = false;
    updateAskBtn();
    addMessage("⚠️ " + err.message, "error");
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function ask() { mode === "rewrite" ? askRewrite() : askQuestion(); }
function handleKey(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 90) + "px";
  updateAskBtn();
}

Office.onReady(() => {
  connect();
  $question().addEventListener("input", updateAskBtn);
  setMode("ask");
});
