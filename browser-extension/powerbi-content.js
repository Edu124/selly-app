// ── CodeForge AI — Power BI Assistant ─────────────────────────────────────────
// Injected into app.powerbi.com pages only.
// Connects to CodeForge Hub WebSocket, reads live report state via the
// powerbi-client JS API (already loaded on app.powerbi.com as window.powerbi),
// and executes AI-returned JSON action lists on the live report.

const PBI_HUB   = "ws://127.0.0.1:7471";
const PBI_RETRY = 3000;

let pbiWs       = null;
let pbiOk       = false;
let pbiWorking  = false;
let pbiTokenBuf = "";
let pbiMsgEl    = null;   // current streaming message element

// ── Report state (refreshed before every command) ─────────────────────────────
let rctx = {
  reportName: "", activePage: "", activePageName: "",
  pages: [], visuals: [], filters: [],
  bookmarks: [], reportId: "", groupId: "",
};

// ── Inject UI ─────────────────────────────────────────────────────────────────
function injectUI() {
  if (document.getElementById("cfpbi-root")) return;

  const S = document.createElement("style");
  S.textContent = `
  #cfpbi-fab{position:fixed;bottom:26px;right:26px;z-index:2147483640;
    width:50px;height:50px;border-radius:50%;border:none;cursor:pointer;
    background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;font-size:20px;
    box-shadow:0 4px 18px rgba(37,99,235,.55);transition:transform .18s,box-shadow .18s;
    display:flex;align-items:center;justify-content:center;}
  #cfpbi-fab:hover{transform:scale(1.1);box-shadow:0 6px 26px rgba(37,99,235,.75);}
  #cfpbi-panel{position:fixed;bottom:86px;right:26px;z-index:2147483640;
    width:370px;height:560px;background:#0f172a;border:1px solid #1e293b;
    border-radius:14px;display:none;flex-direction:column;overflow:hidden;
    box-shadow:0 24px 64px rgba(0,0,0,.75);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
  #cfpbi-panel.open{display:flex;}
  .pbi-hdr{padding:12px 14px;border-bottom:1px solid #1e293b;flex-shrink:0;
    display:flex;align-items:center;justify-content:space-between;}
  .pbi-logo{width:28px;height:28px;border-radius:7px;flex-shrink:0;
    background:linear-gradient(135deg,#2563eb,#7c3aed);display:flex;
    align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;}
  .pbi-title{font-size:13px;font-weight:700;color:#f1f5f9;}
  .pbi-sub{font-size:10px;color:#475569;margin-top:1px;}
  .pbi-dot{width:6px;height:6px;border-radius:50%;background:#ef4444;transition:background .3s;flex-shrink:0;}
  .pbi-dot.on{background:#22c55e;}
  .pbi-close{background:none;border:none;color:#475569;font-size:15px;
    cursor:pointer;padding:4px;line-height:1;border-radius:4px;flex-shrink:0;}
  .pbi-close:hover{color:#94a3b8;background:#1e293b;}
  .pbi-ctx{padding:5px 14px;background:#080d18;border-bottom:1px solid #080d18;
    font-size:10px;color:#334155;flex-shrink:0;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:24px;}
  .pbi-ctx b{color:#475569;}
  .pbi-tabs{display:flex;border-bottom:1px solid #1e293b;flex-shrink:0;background:#0a0f1a;}
  .pbi-tab{flex:1;background:transparent;border:none;border-bottom:2px solid transparent;
    color:#475569;font-size:11px;font-weight:600;padding:8px 4px;cursor:pointer;transition:all .15s;}
  .pbi-tab.active{color:#93c5fd;border-bottom-color:#3b82f6;}
  .pbi-tab:hover:not(.active){color:#64748b;}
  .pbi-chat{flex:1;overflow-y:auto;padding:10px 12px;
    display:flex;flex-direction:column;gap:6px;}
  .pbi-chat::-webkit-scrollbar{width:3px;}
  .pbi-chat::-webkit-scrollbar-thumb{background:#1e293b;border-radius:3px;}
  .pbi-msg{max-width:100%;padding:8px 11px;border-radius:9px;
    font-size:12px;line-height:1.6;word-break:break-word;}
  .pbi-msg.user{background:rgba(37,99,235,.14);border:1px solid rgba(37,99,235,.24);
    color:#bfdbfe;align-self:flex-end;max-width:90%;}
  .pbi-msg.ai{background:#161b26;border:1px solid #1e293b;
    color:#e2e8f0;align-self:flex-start;width:100%;white-space:pre-wrap;}
  .pbi-msg.sys{background:transparent;border:none;color:#1e3a5f;
    font-size:10px;align-self:center;padding:2px 0;}
  .pbi-msg.err{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#fca5a5;}
  .pbi-cursor{display:inline-block;width:2px;height:12px;background:#3b82f6;
    margin-left:2px;vertical-align:middle;animation:pbiblink 1s step-end infinite;}
  @keyframes pbiblink{0%,100%{opacity:1}50%{opacity:0}}
  .pbi-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;}
  .pbi-chip{display:inline-flex;align-items:center;gap:3px;
    background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.22);
    border-radius:4px;padding:2px 7px;font-size:10px;color:#93c5fd;font-weight:600;}
  .pbi-chip.ok{background:rgba(34,197,94,.07);border-color:rgba(34,197,94,.2);color:#86efac;}
  .pbi-chip.fail{background:rgba(239,68,68,.07);border-color:rgba(239,68,68,.2);color:#fca5a5;}
  .pbi-empty{flex:1;display:flex;flex-direction:column;align-items:center;
    justify-content:center;text-align:center;color:#1e293b;padding:18px;gap:5px;}
  .pbi-empty-icon{font-size:28px;}
  .pbi-empty-title{font-size:12px;font-weight:600;color:#334155;}
  .pbi-empty-sub{font-size:10.5px;color:#1e293b;line-height:1.5;}
  .pbi-sugs{display:flex;flex-direction:column;gap:4px;margin-top:8px;width:100%;}
  .pbi-sug{background:#0a0f1a;border:1px solid #1e293b;border-radius:6px;
    padding:6px 10px;font-size:10.5px;color:#334155;cursor:pointer;
    text-align:left;transition:all .15s;}
  .pbi-sug:hover{border-color:#2563eb;color:#93c5fd;background:rgba(37,99,235,.05);}
  .pbi-iarea{padding:9px 12px;border-top:1px solid #1e293b;flex-shrink:0;}
  .pbi-irow{display:flex;gap:7px;align-items:flex-end;}
  .pbi-ta{flex:1;background:#161b26;border:1px solid #1e293b;border-radius:8px;
    color:#e2e8f0;font-size:12px;font-family:inherit;padding:7px 10px;
    resize:none;min-height:34px;max-height:80px;outline:none;
    line-height:1.5;transition:border-color .2s;}
  .pbi-ta:focus{border-color:#2563eb;}
  .pbi-ta::placeholder{color:#1e293b;}
  .pbi-send{background:#2563eb;border:none;border-radius:8px;color:#fff;
    font-size:12px;font-weight:600;padding:8px 13px;cursor:pointer;
    flex-shrink:0;height:34px;transition:background .2s,opacity .2s;}
  .pbi-send:hover:not(:disabled){background:#1d4ed8;}
  .pbi-send:disabled{opacity:.4;cursor:not-allowed;}
  .pbi-hint{font-size:9.5px;color:#1e293b;margin-top:4px;}
  /* info panel */
  .pbi-info{flex:1;overflow-y:auto;padding:10px 12px;display:none;flex-direction:column;gap:8px;}
  .pbi-info.active{display:flex;}
  .pbi-section{background:#161b26;border:1px solid #1e293b;border-radius:8px;padding:10px 12px;}
  .pbi-section-title{font-size:10px;font-weight:700;color:#475569;
    text-transform:uppercase;letter-spacing:.8px;margin-bottom:7px;}
  .pbi-item{font-size:11px;color:#64748b;padding:3px 0;
    border-bottom:1px solid #0f172a;display:flex;justify-content:space-between;}
  .pbi-item:last-child{border-bottom:none;}
  .pbi-item b{color:#94a3b8;}
  .pbi-badge{font-size:9px;background:#1e3a5f;color:#93c5fd;
    border-radius:3px;padding:1px 5px;font-weight:600;}
  `;
  document.head.appendChild(S);

  // FAB
  const fab = document.createElement("button");
  fab.id = "cfpbi-fab"; fab.title = "CodeForge AI — Power BI Assistant";
  fab.innerHTML = "⚡";
  document.body.appendChild(fab);

  // Panel
  const panel = document.createElement("div");
  panel.id = "cfpbi-panel";
  panel.innerHTML = `
    <div class="pbi-hdr">
      <div style="display:flex;align-items:center;gap:9px;">
        <div class="pbi-logo">C</div>
        <div><div class="pbi-title">CodeForge AI</div><div class="pbi-sub">Power BI Assistant</div></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="pbi-dot" id="pbi-dot"></div>
        <span style="font-size:10px;color:#475569;" id="pbi-status">Connecting…</span>
        <button class="pbi-close" id="pbi-close">✕</button>
      </div>
    </div>
    <div class="pbi-ctx" id="pbi-ctx">📊 Detecting report…</div>
    <div class="pbi-tabs">
      <button class="pbi-tab active" id="tab-chat" onclick="pbiShowTab('chat')">💬 Assistant</button>
      <button class="pbi-tab" id="tab-info" onclick="pbiShowTab('info')">📋 Report Info</button>
    </div>

    <!-- Chat tab -->
    <div class="pbi-chat" id="pbi-chat">
      <div class="pbi-empty" id="pbi-empty">
        <div class="pbi-empty-icon">⚡</div>
        <div class="pbi-empty-title">Power BI Assistant</div>
        <div class="pbi-empty-sub">Just tell me what to do — I'll handle everything</div>
        <div class="pbi-sugs">
          <button class="pbi-sug" onclick="pbiAsk('Go to the Sales page')">📄 Go to the Sales page</button>
          <button class="pbi-sug" onclick="pbiAsk('Filter this year only')">🔍 Filter to this year only</button>
          <button class="pbi-sug" onclick="pbiAsk('Clear all filters and reset the report')">✨ Clear all filters and reset</button>
          <button class="pbi-sug" onclick="pbiAsk('What pages and visuals are in this report?')">📋 What's in this report?</button>
          <button class="pbi-sug" onclick="pbiAsk('Refresh the dataset')">🔄 Refresh the dataset</button>
        </div>
      </div>
    </div>

    <!-- Info tab -->
    <div class="pbi-info" id="pbi-info"></div>

    <div class="pbi-iarea">
      <div class="pbi-irow">
        <textarea class="pbi-ta" id="pbi-input" rows="1"
          placeholder="Tell me what to do…"
          onkeydown="pbiKey(event)" oninput="pbiResize(this)"></textarea>
        <button class="pbi-send" id="pbi-send" onclick="pbiAsk()" disabled>Send</button>
      </div>
      <div class="pbi-hint" id="pbi-hint">⚠️ Open CodeForge app first</div>
    </div>
  `;
  panel.id = "cfpbi-panel";
  document.body.appendChild(panel);

  fab.onclick = () => {
    panel.classList.toggle("open");
    if (panel.classList.contains("open")) {
      refreshCtx().then(renderInfoTab);
      setTimeout(() => document.getElementById("pbi-input")?.focus(), 80);
    }
  };
  document.getElementById("pbi-close").onclick = () => panel.classList.remove("open");
}

// ── Tab switching ─────────────────────────────────────────────────────────────
window.pbiShowTab = function(tab) {
  document.getElementById("tab-chat").classList.toggle("active", tab === "chat");
  document.getElementById("tab-info").classList.toggle("active", tab === "info");
  document.getElementById("pbi-chat").style.display = tab === "chat" ? "flex" : "none";
  const info = document.getElementById("pbi-info");
  info.classList.toggle("active", tab === "info");
  if (tab === "info") { refreshCtx().then(renderInfoTab); }
};

// ── Get the embedded report object ───────────────────────────────────────────
async function getReport() {
  if (!window.powerbi) return null;
  // Try finding the report embed by looking for embed containers
  const selectors = [
    "[powerbi-type='report']",
    "[data-embed-type='report']",
    ".report-container iframe",
    "#reportEmbed",
    ".embedContainer",
    "iframe[src*='powerbi']",
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      try { const r = window.powerbi.get(el); if (r) return r; } catch { /* try next */ }
    }
  }
  // Fallback: first embed
  if (window.powerbi.embeds?.length) return window.powerbi.embeds[0];
  return null;
}

// ── Refresh report context ────────────────────────────────────────────────────
async function refreshCtx() {
  const ctx = document.getElementById("pbi-ctx");
  try {
    // Extract IDs from URL: /groups/{groupId}/reports/{reportId}
    const urlMatch = location.href.match(/groups\/([^/]+)\/reports\/([^/?]+)/);
    rctx.groupId  = urlMatch?.[1] || "";
    rctx.reportId = urlMatch?.[2] || "";

    const report = await getReport();
    if (!report) {
      ctx.innerHTML = `📊 <b>No report detected</b> — open a report first`;
      return;
    }

    // Pages
    const pages = await report.getPages();
    const active = pages.find(p => p.isActive) || pages[0];
    rctx.pages        = pages.map(p => ({ name: p.name, displayName: p.displayName, isActive: p.isActive }));
    rctx.activePage   = active?.displayName || "";
    rctx.activePageName = active?.name || "";
    rctx.reportName   = document.title.replace(/ ?[-–|] ?Power BI.*$/i, "").trim() || "Report";

    // Visuals on current page
    if (active) {
      try {
        const visuals = await active.getVisuals();
        rctx.visuals = visuals.map(v => ({
          name: v.name, title: v.title || "", type: v.type,
        }));
      } catch { rctx.visuals = []; }
    }

    // Report-level filters
    try {
      rctx.filters = await report.getFilters();
    } catch { rctx.filters = []; }

    // Bookmarks
    try {
      const bms = await report.bookmarksManager.getBookmarks();
      rctx.bookmarks = bms.map(b => ({ name: b.name, displayName: b.displayName }));
    } catch { rctx.bookmarks = []; }

    ctx.innerHTML = `📊 <b>${rctx.reportName}</b> &nbsp;·&nbsp; Page: <b>${rctx.activePage}</b> &nbsp;·&nbsp; ${rctx.pages.length} pages`;

  } catch (e) {
    ctx.innerHTML = `📊 <span style="color:#475569">Loading… (${e.message?.slice(0,40)})</span>`;
  }
}

// ── Info tab renderer ─────────────────────────────────────────────────────────
function renderInfoTab() {
  const el = document.getElementById("pbi-info");
  if (!el) return;

  const pageItems = rctx.pages.map(p =>
    `<div class="pbi-item"><span><b>${p.displayName}</b></span>${p.isActive ? '<span class="pbi-badge">ACTIVE</span>' : ''}</div>`
  ).join("") || '<div class="pbi-item" style="color:#1e293b">No pages detected</div>';

  const visualItems = rctx.visuals.map(v =>
    `<div class="pbi-item"><span>${v.title || v.name}</span><span style="color:#334155;font-size:10px">${v.type}</span></div>`
  ).join("") || '<div class="pbi-item" style="color:#1e293b">No visuals detected</div>';

  const filterItems = rctx.filters.length
    ? rctx.filters.map(f => `<div class="pbi-item"><b>${JSON.stringify(f).slice(0,60)}</b></div>`).join("")
    : '<div class="pbi-item" style="color:#1e293b">No active filters</div>';

  const bmItems = rctx.bookmarks.map(b =>
    `<div class="pbi-item"><b>${b.displayName}</b></div>`
  ).join("") || '<div class="pbi-item" style="color:#1e293b">No bookmarks</div>';

  el.innerHTML = `
    <div class="pbi-section">
      <div class="pbi-section-title">📄 Pages (${rctx.pages.length})</div>${pageItems}
    </div>
    <div class="pbi-section">
      <div class="pbi-section-title">📊 Visuals on "${rctx.activePage}" (${rctx.visuals.length})</div>${visualItems}
    </div>
    <div class="pbi-section">
      <div class="pbi-section-title">🔍 Active Filters</div>${filterItems}
    </div>
    <div class="pbi-section">
      <div class="pbi-section-title">🔖 Bookmarks (${rctx.bookmarks.length})</div>${bmItems}
    </div>
  `;
}

// ── Build context summary for Rust prompt ─────────────────────────────────────
function buildCtxSummary() {
  const lines = [
    `Report: "${rctx.reportName}"`,
    `Active page: "${rctx.activePage}"`,
    `All pages: ${rctx.pages.map(p => `"${p.displayName}"`).join(", ")}`,
  ];
  if (rctx.visuals.length) {
    lines.push(`Visuals on active page: ${rctx.visuals.slice(0,10).map(v => `${v.type}:"${v.title||v.name}"`).join(", ")}`);
  }
  if (rctx.filters.length) {
    lines.push(`Active report filters: ${rctx.filters.length} filter(s) applied`);
  }
  if (rctx.bookmarks.length) {
    lines.push(`Bookmarks: ${rctx.bookmarks.map(b => `"${b.displayName}"`).join(", ")}`);
  }
  if (rctx.groupId) lines.push(`Group ID: ${rctx.groupId}`);
  if (rctx.reportId) lines.push(`Report ID: ${rctx.reportId}`);
  return lines.join("\n");
}

// ── Chat helpers ──────────────────────────────────────────────────────────────
function pbiHideEmpty() { document.getElementById("pbi-empty")?.remove(); }
function pbiAddMsg(text, cls) {
  pbiHideEmpty();
  const d = document.createElement("div");
  d.className = "pbi-msg " + cls;
  d.textContent = text;
  const chat = document.getElementById("pbi-chat");
  chat.appendChild(d);
  chat.scrollTop = 9999;
  return d;
}
function pbiStartStream() {
  pbiHideEmpty();
  const d = document.createElement("div");
  d.className = "pbi-msg ai";
  d.innerHTML = '<span class="pbi-cursor"></span>';
  const chat = document.getElementById("pbi-chat");
  chat.appendChild(d);
  chat.scrollTop = 9999;
  pbiMsgEl = d;
}
function pbiToken(t) {
  if (!pbiMsgEl) pbiStartStream();
  const cur = pbiMsgEl.querySelector(".pbi-cursor");
  pbiMsgEl.insertBefore(document.createTextNode(t), cur);
  document.getElementById("pbi-chat").scrollTop = 9999;
}
function pbiUpdateUI() {
  const hasText = (document.getElementById("pbi-input")?.value || "").trim().length > 0;
  const btn = document.getElementById("pbi-send");
  if (btn) btn.disabled = !pbiOk || pbiWorking || !hasText;
  const hint = document.getElementById("pbi-hint");
  if (!hint) return;
  if (!pbiOk)         hint.textContent = "⚠️ Open CodeForge app first";
  else if (pbiWorking) hint.textContent = "Working…";
  else                 hint.textContent  = "Enter to send · Shift+Enter for new line";
}
window.pbiKey    = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); pbiAsk(); } };
window.pbiResize = (el) => { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 80) + "px"; pbiUpdateUI(); };

// ── Send command to Hub ───────────────────────────────────────────────────────
window.pbiAsk = async function(preset) {
  const inputEl  = document.getElementById("pbi-input");
  const command  = preset || (inputEl?.value || "").trim();
  if (!command || !pbiOk || pbiWorking) return;

  await refreshCtx();
  pbiAddMsg(command, "user");
  if (inputEl) { inputEl.value = ""; inputEl.style.height = ""; }

  pbiWorking  = true;
  pbiTokenBuf = "";
  pbiUpdateUI();
  pbiStartStream();

  pbiWs.send(JSON.stringify({
    type:    "powerbi_command",
    command,
    context: buildCtxSummary(),
    groupId:  rctx.groupId,
    reportId: rctx.reportId,
    suggestedTokens: 400,
  }));
};

// ── Finish streaming + execute actions ────────────────────────────────────────
function pbiFinish() {
  if (pbiMsgEl) {
    pbiMsgEl.querySelector(".pbi-cursor")?.remove();
    pbiMsgEl = null;
  }
  const raw = pbiTokenBuf.trim();
  pbiTokenBuf = "";
  pbiWorking  = false;
  pbiUpdateUI();

  (async () => {
    try {
      // Strip markdown fences + find JSON start
      let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const jstart = cleaned.search(/[\[{]/);
      if (jstart > 0) cleaned = cleaned.slice(jstart);
      // Auto-close truncated JSON
      if ((cleaned.match(/\[/g)||[]).length > (cleaned.match(/\]/g)||[]).length) cleaned += "]";
      if ((cleaned.match(/\{/g)||[]).length > (cleaned.match(/\}/g)||[]).length) cleaned += "}";

      const parsed  = JSON.parse(cleaned);
      const actions = Array.isArray(parsed) ? parsed
        : (parsed.actions || (parsed.op ? [parsed] : null));

      if (!actions?.length) throw new Error("no_actions");

      // Show "executing" placeholder
      const runEl = pbiAddMsg("⚡ Executing…", "sys");
      const results = await runActions(actions);

      // Replace with chips
      const chips = results.map(r =>
        `<span class="pbi-chip ${r.ok ? "ok" : "fail"}">${r.ok ? "✅" : "⚠️"} ${r.msg}</span>`
      ).join("");
      runEl.className = "pbi-msg ai";
      runEl.innerHTML = `<div class="pbi-chips">${chips}</div>`;
      document.getElementById("pbi-chat").scrollTop = 9999;

      // Refresh info tab if visible
      if (document.getElementById("tab-info").classList.contains("active")) {
        await refreshCtx(); renderInfoTab();
      }

    } catch {
      // Not JSON — show plain text answer
      if (raw) pbiAddMsg(raw, "ai");
    }
  })();
}

// ── Action executor ───────────────────────────────────────────────────────────
async function runActions(actions) {
  const results = [];
  let report;
  try { report = await getReport(); } catch { /* */ }

  for (const action of actions) {
    try {
      const msg = await runOne(report, action);
      results.push({ ok: true,  op: action.op, msg });
    } catch (e) {
      results.push({ ok: false, op: action.op, msg: `${action.op}: ${e.message}` });
    }
  }
  // Refresh context after batch
  try { await refreshCtx(); } catch { /* */ }
  return results;
}

async function runOne(report, action) {
  // Some actions don't need the report object
  if (action.op === "answer")         return action.text || "Done";
  if (action.op === "refresh_dataset") return await doRefresh(action);
  if (action.op === "dom_click")       return await doDomClick(action);

  if (!report) throw new Error("No Power BI report loaded on this page");

  switch (action.op) {

    // ── Navigation ────────────────────────────────────────────────────────────
    case "navigate_page": {
      const pages = await report.getPages();
      const q     = (action.page || "").toLowerCase();
      const target = pages.find(p =>
        p.displayName.toLowerCase().includes(q) || p.name.toLowerCase() === q
      ) || pages.find(p => p.displayName.toLowerCase().startsWith(q));
      if (!target) {
        const available = pages.map(p => `"${p.displayName}"`).join(", ");
        throw new Error(`Page "${action.page}" not found. Available: ${available}`);
      }
      await target.setActive();
      await refreshCtx();
      return `Navigated to "${target.displayName}"`;
    }

    case "navigate_next": {
      const pages = await report.getPages();
      const idx   = pages.findIndex(p => p.isActive);
      const next  = pages[idx + 1];
      if (!next) throw new Error("Already on last page");
      await next.setActive();
      return `Navigated to "${next.displayName}"`;
    }

    case "navigate_prev": {
      const pages = await report.getPages();
      const idx   = pages.findIndex(p => p.isActive);
      if (idx <= 0) throw new Error("Already on first page");
      await pages[idx - 1].setActive();
      return `Navigated to "${pages[idx - 1].displayName}"`;
    }

    case "navigate_first": {
      const pages = await report.getPages();
      await pages[0].setActive();
      return `Navigated to "${pages[0].displayName}"`;
    }

    case "navigate_last": {
      const pages = await report.getPages();
      const last  = pages[pages.length - 1];
      await last.setActive();
      return `Navigated to "${last.displayName}"`;
    }

    // ── Filters ───────────────────────────────────────────────────────────────
    case "set_filter": {
      // models object available from powerbi-client
      const models = window["powerbi-client"]?.models || window.pbi?.models;
      const filter = {
        $schema:    "http://powerbi.com/product/schema#basic",
        target:     { table: action.table, column: action.column },
        operator:   action.operator || "In",
        values:     Array.isArray(action.values) ? action.values : [action.values],
        filterType: models ? models.FilterType.Basic : 1,
      };
      await report.updateFilters(models?.FiltersOperations?.Add ?? 0, [filter]);
      return `Filter: ${action.table}[${action.column}] ${action.operator || "In"} [${[].concat(action.values).join(", ")}]`;
    }

    case "set_date_filter": {
      const models = window["powerbi-client"]?.models || window.pbi?.models;
      const filter = {
        $schema:         "http://powerbi.com/product/schema#advanced",
        target:          { table: action.table, column: action.column },
        logicalOperator: "And",
        conditions:      [
          { operator: "GreaterThanOrEqual", value: action.from },
          { operator: "LessThanOrEqual",    value: action.to   },
        ],
        filterType: models ? models.FilterType.Advanced : 0,
      };
      await report.updateFilters(models?.FiltersOperations?.Add ?? 0, [filter]);
      return `Date filter: ${action.table}[${action.column}] from ${action.from} to ${action.to}`;
    }

    case "set_advanced_filter": {
      const models = window["powerbi-client"]?.models || window.pbi?.models;
      const filter = {
        $schema:         "http://powerbi.com/product/schema#advanced",
        target:          { table: action.table, column: action.column },
        logicalOperator: action.logicalOperator || "And",
        conditions:      action.conditions || [],
        filterType:      models ? models.FilterType.Advanced : 0,
      };
      await report.updateFilters(models?.FiltersOperations?.Add ?? 0, [filter]);
      return `Advanced filter on ${action.table}[${action.column}]`;
    }

    case "remove_filter": {
      const models  = window["powerbi-client"]?.models || window.pbi?.models;
      const filter  = {
        $schema:    "http://powerbi.com/product/schema#basic",
        target:     { table: action.table, column: action.column },
        operator:   "All",
        values:     [],
        filterType: models ? models.FilterType.Basic : 1,
      };
      await report.updateFilters(models?.FiltersOperations?.Remove ?? 2, [filter]);
      return `Removed filter on ${action.table}[${action.column}]`;
    }

    case "clear_filters": {
      await report.removeFilters();
      return "Cleared all report filters";
    }

    // ── Slicers ───────────────────────────────────────────────────────────────
    case "set_slicer": {
      const pages   = await report.getPages();
      const active  = pages.find(p => p.isActive);
      if (!active) throw new Error("No active page");
      const visuals = await active.getVisuals();
      const slicer  = visuals.find(v =>
        v.type === "slicer" && (
          (v.title||"").toLowerCase().includes((action.slicer||"").toLowerCase()) ||
          v.name.toLowerCase().includes((action.slicer||"").toLowerCase())
        )
      );
      if (!slicer) throw new Error(`Slicer "${action.slicer}" not found on this page`);
      const models = window["powerbi-client"]?.models || window.pbi?.models;
      const slicerFilter = {
        $schema:    "http://powerbi.com/product/schema#basic",
        target:     { table: action.table, column: action.column },
        operator:   "In",
        values:     Array.isArray(action.values) ? action.values : [action.values],
        filterType: models ? models.FilterType.Basic : 1,
      };
      await slicer.setSlicerState({ filters: [slicerFilter] });
      return `Slicer "${action.slicer}" set to [${[].concat(action.values).join(", ")}]`;
    }

    case "clear_slicer": {
      const pages   = await report.getPages();
      const active  = pages.find(p => p.isActive);
      if (!active) throw new Error("No active page");
      const visuals = await active.getVisuals();
      const slicer  = visuals.find(v =>
        v.type === "slicer" && (
          (v.title||"").toLowerCase().includes((action.slicer||"").toLowerCase()) ||
          v.name.toLowerCase().includes((action.slicer||"").toLowerCase())
        )
      );
      if (!slicer) throw new Error(`Slicer "${action.slicer}" not found`);
      await slicer.setSlicerState({ filters: [] });
      return `Cleared slicer "${action.slicer}"`;
    }

    // ── Bookmarks ─────────────────────────────────────────────────────────────
    case "apply_bookmark": {
      const bms = await report.bookmarksManager.getBookmarks();
      const bm  = bms.find(b =>
        b.displayName.toLowerCase().includes((action.bookmark||"").toLowerCase())
      );
      if (!bm) {
        const available = bms.map(b => `"${b.displayName}"`).join(", ");
        throw new Error(`Bookmark "${action.bookmark}" not found. Available: ${available || "none"}`);
      }
      await report.bookmarksManager.apply(bm.name);
      return `Applied bookmark "${bm.displayName}"`;
    }

    case "capture_bookmark": {
      const captured = await report.bookmarksManager.capture();
      return `Captured current state as bookmark (name: "${captured?.name || "captured"}")`;
    }

    // ── Visuals ───────────────────────────────────────────────────────────────
    case "focus_visual": {
      const pages   = await report.getPages();
      const active  = pages.find(p => p.isActive);
      if (!active) throw new Error("No active page");
      const visuals = await active.getVisuals();
      const visual  = visuals.find(v =>
        (v.title||v.name||"").toLowerCase().includes((action.visual||"").toLowerCase())
      );
      if (!visual) throw new Error(`Visual "${action.visual}" not found on this page`);
      await visual.setFocus();
      return `Focused on "${visual.title || visual.name}"`;
    }

    case "sort_visual": {
      const pages   = await report.getPages();
      const active  = pages.find(p => p.isActive);
      if (!active) throw new Error("No active page");
      const visuals = await active.getVisuals();
      const visual  = visuals.find(v =>
        (v.title||v.name||"").toLowerCase().includes((action.visual||"").toLowerCase())
      );
      if (!visual) throw new Error(`Visual "${action.visual}" not found`);
      await visual.sortBy({ column: action.column, direction: action.descending ? "Descending" : "Ascending" });
      return `Sorted "${visual.title||visual.name}" by ${action.column} ${action.descending ? "↓" : "↑"}`;
    }

    // ── Drill ─────────────────────────────────────────────────────────────────
    case "drill_down": {
      const pages   = await report.getPages();
      const active  = pages.find(p => p.isActive);
      if (!active) throw new Error("No active page");
      const visuals = await active.getVisuals();
      const visual  = visuals.find(v =>
        (v.title||v.name||"").toLowerCase().includes((action.visual||"").toLowerCase())
      );
      if (!visual) throw new Error(`Visual "${action.visual}" not found`);
      await visual.drillDown(action.dimension);
      return `Drilled down in "${visual.title||visual.name}"`;
    }

    case "drill_up": {
      const pages   = await report.getPages();
      const active  = pages.find(p => p.isActive);
      if (!active) throw new Error("No active page");
      const visuals = await active.getVisuals();
      const visual  = visuals.find(v =>
        (v.title||v.name||"").toLowerCase().includes((action.visual||"").toLowerCase())
      );
      if (!visual) throw new Error(`Visual "${action.visual}" not found`);
      await visual.drillUp(action.dimension);
      return `Drilled up in "${visual.title||visual.name}"`;
    }

    // ── Report state ──────────────────────────────────────────────────────────
    case "reset_report": {
      await report.reset();
      await refreshCtx();
      return "Report reset to default state";
    }

    case "full_screen": {
      await report.fullscreen();
      return "Entered full screen";
    }

    case "exit_full_screen": {
      await report.exitFullscreen();
      return "Exited full screen";
    }

    case "print": {
      await report.print();
      return "Print dialog opened";
    }

    case "reload": {
      await report.reload();
      await refreshCtx();
      return "Report reloaded";
    }

    case "undo": {
      await report.undo();
      return "Undo performed";
    }

    case "redo": {
      await report.redo();
      return "Redo performed";
    }

    default:
      throw new Error(`Unknown action: "${action.op}"`);
  }
}

// ── Dataset refresh via Power BI REST API ─────────────────────────────────────
async function doRefresh(action) {
  // Try to get auth token from Power BI's own fetch interceptor / cookie
  const groupId  = action.groupId  || rctx.groupId;
  const datasetId = action.datasetId || rctx.reportId;

  if (!groupId || !datasetId) {
    // Fallback: click the refresh button in the Power BI toolbar
    return await doDomClick({ selector: '[data-testid="refresh-button"], [aria-label*="Refresh"], .refresh-button-container button' });
  }

  try {
    // Get auth token from the page's Power BI session
    const token = await getPBIToken();
    if (!token) throw new Error("no_token");

    const url = `https://api.powerbi.com/v1.0/myorg/groups/${groupId}/datasets/${datasetId}/refreshes`;
    const res = await fetch(url, {
      method:  "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body:    JSON.stringify({}),
    });
    if (res.status === 202) return "Dataset refresh triggered successfully";
    if (res.status === 429) throw new Error("Too many refresh requests — please wait before retrying");
    throw new Error(`API returned status ${res.status}`);
  } catch (e) {
    if (e.message === "no_token") {
      // Fallback to DOM click
      return await doDomClick({ selector: '[aria-label*="Refresh"], [data-testid="refresh-button"]' });
    }
    throw e;
  }
}

// Try to extract the Bearer token from Power BI's active session
async function getPBIToken() {
  try {
    // Power BI stores the MSAL token in sessionStorage/localStorage
    for (const key of Object.keys(sessionStorage)) {
      if (key.includes("accesstoken") || key.includes("msal")) {
        try {
          const obj = JSON.parse(sessionStorage.getItem(key));
          if (obj?.secret || obj?.accessToken) return obj.secret || obj.accessToken;
        } catch { /* skip */ }
      }
    }
    for (const key of Object.keys(localStorage)) {
      if (key.includes("accesstoken") || key.includes("msal")) {
        try {
          const obj = JSON.parse(localStorage.getItem(key));
          if (obj?.secret || obj?.accessToken) return obj.secret || obj.accessToken;
        } catch { /* skip */ }
      }
    }
  } catch { /* */ }
  return null;
}

// ── DOM fallback (toolbar buttons, context menus) ─────────────────────────────
async function doDomClick(action) {
  const selectors = Array.isArray(action.selector)
    ? action.selector : [action.selector || action.text];

  for (const sel of selectors) {
    // Try CSS selector first
    try {
      const el = document.querySelector(sel);
      if (el) { el.click(); return `Clicked "${sel}"`; }
    } catch { /* invalid selector */ }

    // Try finding by visible text content
    const allBtns = document.querySelectorAll("button, [role='button'], [role='menuitem'], li");
    for (const btn of allBtns) {
      const txt = (btn.textContent || btn.getAttribute("aria-label") || "").trim().toLowerCase();
      if (txt.includes((sel || "").toLowerCase())) {
        btn.click();
        return `Clicked "${btn.textContent?.trim() || sel}"`;
      }
    }
  }
  throw new Error(`Could not find UI element: "${selectors.join('" or "')}"`)
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
function pbiConnect() {
  try { pbiWs = new WebSocket(PBI_HUB); } catch { setTimeout(pbiConnect, PBI_RETRY); return; }

  pbiWs.onopen = () => {
    pbiOk = true;
    const dot = document.getElementById("pbi-dot");
    const txt = document.getElementById("pbi-status");
    if (dot) dot.className = "pbi-dot on";
    if (txt) txt.textContent = "Connected";
    pbiUpdateUI();
    pbiWs.send(JSON.stringify({ type: "hello", editor: "powerbi" }));
  };

  pbiWs.onmessage = (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    switch (msg.type) {
      case "token":
        if (msg.content) { pbiTokenBuf += msg.content; pbiToken(msg.content); }
        break;
      case "done":
        pbiFinish();
        break;
      case "error":
        if (pbiMsgEl) { pbiMsgEl.querySelector(".pbi-cursor")?.remove(); pbiMsgEl = null; }
        pbiAddMsg("⚠️ " + (msg.message || "Error"), "err");
        pbiWorking = false; pbiTokenBuf = ""; pbiUpdateUI();
        break;
    }
  };

  pbiWs.onclose = () => {
    pbiOk = false; pbiWorking = false;
    const dot = document.getElementById("pbi-dot");
    const txt = document.getElementById("pbi-status");
    if (dot) dot.className = "pbi-dot";
    if (txt) txt.textContent = "Disconnected";
    pbiUpdateUI();
    setTimeout(pbiConnect, PBI_RETRY);
  };

  pbiWs.onerror = () => pbiWs?.close();
}

// ── SPA navigation watcher ────────────────────────────────────────────────────
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(() => refreshCtx().then(renderInfoTab), 2500);
  }
}).observe(document.body, { childList: true, subtree: true });

// ── Boot ──────────────────────────────────────────────────────────────────────
function boot() {
  injectUI();
  pbiConnect();
  setTimeout(() => refreshCtx().then(renderInfoTab), 2000);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
