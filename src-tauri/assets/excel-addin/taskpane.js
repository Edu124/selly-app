// ── CodeForge AI — Excel Add-in ───────────────────────────────────────────────
const HUB_URL      = "ws://127.0.0.1:7471";
const RECONNECT_MS = 3000;

let ws             = null;
let isConnected    = false;
let isStreaming    = false;
let currentAiEl   = null;
let mode           = "ask";
let pendingFormula = null;
let formulaTarget  = null;
let pendingRange   = null;
let pendingMacro   = null;      // stores extracted VBA code waiting to be copied
let macroHistory   = [];        // conversation history for multi-turn macro refinement

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
  document.getElementById("modeFormula").classList.toggle("active", m === "formula");
  document.getElementById("modeMacro").classList.toggle("active",   m === "macro");

  if (m === "ask")     { $askBtn().textContent = "Ask";      $question().placeholder = "e.g. What is revenue for 2023?"; }
  if (m === "formula") { $askBtn().textContent = "Generate"; $question().placeholder = "e.g. Sum all rows above this cell"; }
  if (m === "macro")   { $askBtn().textContent = "Generate Macro"; $question().placeholder = "e.g. Highlight all cells above 1000 in red"; }

  const icon  = document.getElementById("emptyIcon");
  const title = document.getElementById("emptyTitle");
  const sub   = document.getElementById("emptySub");
  if (m === "ask") {
    icon.textContent  = "📊";
    title.textContent = "Ask about your data";
    sub.textContent   = "Select cells in Excel, then ask a question below.";
  } else if (m === "formula") {
    icon.textContent  = "✏️";
    title.textContent = "Generate a formula";
    sub.textContent   = "Select the target cell or data range, then describe the formula.";
  } else {
    icon.textContent  = "🔧";
    title.textContent = "Generate a VBA Macro";
    sub.textContent   = "Describe what you want the macro to do. AI will think first, then build it.";
    macroHistory      = []; // reset conversation when entering macro mode
  }
  updateAskBtn();
}

function setConnected(v) {
  isConnected = v;
  $statusDot().className = "status-dot" + (v ? " connected" : "");
  $statusTxt().textContent = v ? "Connected" : "Disconnected";
  updateAskBtn();
}
function updateAskBtn() {
  const hasText = $question().value.trim().length > 0;
  $askBtn().disabled = !isConnected || isStreaming || !hasText;
  if (!isConnected)           $subHint().textContent = "⚠️ Open CodeForge app first";
  else if (isStreaming)       $subHint().textContent = mode === "macro" ? "Thinking…" : "Answering…";
  else if (mode === "ask")    $subHint().textContent = "Select cells in Excel, then ask a question";
  else if (mode === "formula")$subHint().textContent = "Select a cell or range, then describe the formula";
  else                        $subHint().textContent = macroHistory.length ? "Answer the questions above, then click Generate Macro" : "Describe your macro idea";
}
function hideEmpty() { const e = $empty(); if (e) e.remove(); }
function addMessage(text, type) {
  hideEmpty();
  const d = document.createElement("div");
  d.className = "msg " + type;
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

    if (mode === "formula") {
      const text     = currentAiEl.textContent.trim();
      const allForms = [...text.matchAll(/=\S[^\n\r]*/g)].map(m => m[0].trim());
      if (allForms.length > 0) {
        pendingFormula = allForms;   // array of formulas
        formulaTarget  = pendingRange;
        const preview  = allForms.length > 1
          ? `${allForms[0]}  … (+${allForms.length - 1} more)`
          : allForms[0];
        const btn = document.createElement("button");
        btn.className   = "insert-btn";
        btn.textContent = `⬆ Insert into ${formulaTarget}: ${preview}`;
        btn.onclick     = insertFormula;
        currentAiEl.appendChild(btn);
      }
    }

    if (mode === "macro") {
      const text = currentAiEl.textContent.trim();
      // Store this AI turn in macro history for follow-up turns
      macroHistory.push({ role: "assistant", content: text });
      // Detect VBA code — if Sub...End Sub present, show Copy & Install button
      const vbaMatch = text.match(/(?:Sub|Function)\s+\w[\s\S]*?End\s+(?:Sub|Function)/i);
      if (vbaMatch) {
        pendingMacro = vbaMatch[0].trim();
        const btn = document.createElement("button");
        btn.className   = "insert-btn";
        btn.textContent = "📋 Copy & Install Macro";
        btn.onclick     = copyAndInstallMacro;
        currentAiEl.appendChild(btn);
        macroHistory = []; // reset history after successful generation
      }
    }

    currentAiEl = null;
  }
  isStreaming = false;
  updateAskBtn();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function norm(s) {
  return String(s ?? "").toLowerCase().replace(/[\s\-_\.&\/\\,()]/g, "");
}
function toNum(v) {
  if (typeof v === "number") return v;
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  if (s === "-" || s === "") return null;
  const neg = s.match(/^\(([0-9,]+\.?[0-9]*)\)$/);
  if (neg) { const n = parseFloat(neg[1].replace(/,/g, "")); return isNaN(n) ? null : -n; }
  const n = parseFloat(s.replace(/[,$ ₹]/g, ""));
  return isNaN(n) ? null : n;
}
function fmt(n) {
  if (n == null) return "?";
  const abs = Math.abs(n);
  if (abs >= 1e7)  return (n/1e7).toFixed(2) + " Cr";
  if (abs >= 1e5)  return (n/1e5).toFixed(2) + " L";
  if (abs >= 1000) return n.toLocaleString("en-IN");
  return parseFloat(n.toFixed(2)).toString();
}
function colLetter(idx) {
  let letter = "", n = idx + 1;
  while (n > 0) { const r = (n-1)%26; letter = String.fromCharCode(65+r)+letter; n = Math.floor((n-1)/26); }
  return letter;
}

// ── Period detection ──────────────────────────────────────────────────────────
function excelSerialToDate(s) { return new Date((s - 25569) * 86400 * 1000); }
function isExcelDateSerial(v) { return typeof v==="number" && Number.isInteger(v) && v>=32874 && v<=72687; }
function toPeriodLabel(v) {
  if (v === null || v === undefined || v === "") return null;
  if (isExcelDateSerial(v)) return String(excelSerialToDate(v).getUTCFullYear());
  const s = String(v).trim();
  if (/^(19|20)\d{2}$/.test(s)) return s;
  if (/^FY[\-\s]?\d{2,4}$/i.test(s)) return s;
  if (/^Q[1-4][\-\s]?\d{2,4}$/i.test(s)) return s;
  if (/^H[12][\-\s]?\d{2,4}$/i.test(s)) return s;
  if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\-\s]?\d{2,4}$/i.test(s)) return s;
  return null;
}
function isPeriodLike(v) { return toPeriodLabel(v) !== null; }
function isTextLabel(v) {
  const s = String(v ?? "").trim();
  return s.length > 0 && toNum(v) === null && !isPeriodLike(v);
}

// ── XLOOKUP table builder ─────────────────────────────────────────────────────
function buildLookupTable(values) {
  if (!values || values.length < 2) return null;
  const nRows = values.length, nCols = values[0]?.length || 0;
  if (nCols < 2) return null;

  const rowPeriodCount = values.map(row => row.filter(v => isPeriodLike(v)).length);
  const colPeriodCount = Array.from({length: nCols}, (_, c) => values.filter(r => isPeriodLike(r[c])).length);
  const maxRow = Math.max(...rowPeriodCount), maxCol = Math.max(...colPeriodCount);
  const horizontal = maxRow >= maxCol;

  if (horizontal) {
    const headerRowIdx = rowPeriodCount.indexOf(maxRow);
    const dataSlice    = values.slice(headerRowIdx + 1);
    let labelColIdx = 0, best = 0;
    for (let c = 0; c < Math.min(4, nCols); c++) {
      const cnt = dataSlice.filter(r => isTextLabel(r[c])).length;
      if (cnt > best) { best = cnt; labelColIdx = c; }
    }
    const periodCols = [];
    for (let c = 0; c < nCols; c++) {
      if (c === labelColIdx) continue;
      const label = toPeriodLabel(values[headerRowIdx][c]);
      if (label) periodCols.push({ colIdx: c, raw: label, normed: norm(label) });
    }
    if (periodCols.length === 0) return null;

    const table = {};
    for (let r = headerRowIdx + 1; r < nRows; r++) {
      const rawLabel = String(values[r][labelColIdx] ?? "").trim();
      if (!rawLabel) continue;
      const nLabel = norm(rawLabel);
      if (!table[nLabel]) table[nLabel] = { _raw: rawLabel, _allValues: [], _periods: [] };
      for (const p of periodCols) {
        const val = toNum(values[r][p.colIdx]);
        if (val !== null) {
          table[nLabel][p.normed] = val;
          table[nLabel][p.raw]    = val;
          table[nLabel]._allValues.push(val);
          if (!table[nLabel]._periods.includes(p.raw)) table[nLabel]._periods.push(p.raw);
        }
      }
    }
    return { table, periods: periodCols.map(p => p.raw) };

  } else {
    const headerColIdx = colPeriodCount.indexOf(maxCol);
    let labelRowIdx = 0, best = 0;
    for (let r = 0; r < Math.min(4, nRows); r++) {
      const cnt = values[r].filter((v, c) => c !== headerColIdx && isTextLabel(v)).length;
      if (cnt > best) { best = cnt; labelRowIdx = r; }
    }
    const periodRows = [];
    for (let r = 0; r < nRows; r++) {
      if (r === labelRowIdx) continue;
      const label = toPeriodLabel(values[r][headerColIdx]);
      if (label) periodRows.push({ rowIdx: r, raw: label, normed: norm(label) });
    }
    if (periodRows.length === 0) return null;

    const table = {};
    for (let c = 0; c < nCols; c++) {
      if (c === headerColIdx) continue;
      const rawLabel = String(values[labelRowIdx][c] ?? "").trim();
      if (!rawLabel) continue;
      const nLabel = norm(rawLabel);
      if (!table[nLabel]) table[nLabel] = { _raw: rawLabel, _allValues: [], _periods: [] };
      for (const p of periodRows) {
        const val = toNum(values[p.rowIdx][c]);
        if (val !== null) {
          table[nLabel][p.normed] = val;
          table[nLabel][p.raw]    = val;
          table[nLabel]._allValues.push(val);
          if (!table[nLabel]._periods.includes(p.raw)) table[nLabel]._periods.push(p.raw);
        }
      }
    }
    return { table, periods: periodRows.map(p => p.raw) };
  }
}

// ── Lookup helpers ────────────────────────────────────────────────────────────
function findInTable(table, query) {
  const q = norm(query);
  // Exact match
  if (table[q]) return table[q];
  // Substring match
  const key = Object.keys(table).find(k => k.includes(q) || q.includes(k));
  return key ? table[key] : null;
}
function findPeriodValue(entry, periodQuery) {
  if (!entry) return null;
  const q = norm(String(periodQuery));
  if (entry[q] !== undefined) return entry[q];
  if (entry[periodQuery] !== undefined) return entry[periodQuery];
  for (const [k, v] of Object.entries(entry)) {
    if (k.startsWith("_")) continue;
    if (norm(k).includes(q) || q.includes(norm(k))) return v;
  }
  if (/^(19|20)\d{2}$/.test(String(periodQuery))) {
    const short = String(periodQuery).slice(2);
    for (const [k, v] of Object.entries(entry)) {
      if (k.startsWith("_")) continue;
      if (norm(k).includes(short)) return v;
    }
  }
  return null;
}
function extractPeriod(question) {
  const patterns = [
    /\b(FY[\-\s]?\d{2,4})\b/i, /\b(Q[1-4][\-\s]?\d{2,4})\b/i,
    /\b(H[12][\-\s]?\d{2,4})\b/i,
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\-\s]?\d{2,4}\b/i,
    /\b(20\d{2})\b/, /\b(19\d{2})\b/,
  ];
  for (const p of patterns) { const m = question.match(p); if (m) return (m[1]||m[0]).trim(); }
  return null;
}

// ── Direct lookup ─────────────────────────────────────────────────────────────
function tryLookup(table, question) {
  const period = extractPeriod(question);
  const q      = norm(question);

  if (period) {
    // Strip digits to get the metric name, try both forms
    const metricQ = q.replace(/\d/g, "").trim();
    const entry   = findInTable(table, metricQ) || findInTable(table, q);
    if (entry) {
      const val = findPeriodValue(entry, period);
      if (val !== null) {
        const matchedPeriod = entry._periods.find(pr =>
          norm(pr).includes(norm(period)) || norm(period).includes(norm(pr))
        ) || period;
        return { type: "found", label: entry._raw, period: matchedPeriod, value: val };
      }
    }
  }

  // No period — return trend for a metric
  const entry = findInTable(table, q.replace(/\d/g,"").trim()) || findInTable(table, q);
  if (entry && entry._allValues.length > 0) {
    return { type: "trend", label: entry._raw, periods: entry._periods, values: entry._allValues };
  }

  return null;
}

// ── Token estimator ───────────────────────────────────────────────────────────
function estimateTokens(question, found) {
  const q = question.toLowerCase().trim();
  if (q.startsWith("explain"))                          return 1500;
  if (mode === "formula")                               return 120;
  if (found?.type === "found")                          return 200;
  if (q.includes("compare") || q.includes("vs") ||
      q.includes("trend")   || q.includes("growth"))   return 800;
  return 600;
}

// ── Build data string for AI ──────────────────────────────────────────────────
function buildDataStr(table, periods, sheetName) {
  let s = `Sheet: ${sheetName} | Periods: ${periods.join(", ")}\n\n`;
  for (const entry of Object.values(table)) {
    if (entry._allValues.length === 0) continue;
    const vals = entry._periods.map(p => `${p}=${fmt(entry[p] || entry[norm(p)])}`).join("  ");
    s += `${entry._raw}: ${vals}\n`;
  }
  return s;
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
function connect() {
  try { ws = new WebSocket(HUB_URL); } catch { setTimeout(connect, RECONNECT_MS); return; }
  ws.onopen  = () => { ws.send(JSON.stringify({ type:"hello", editor:"excel" })); setConnected(true); };
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
    await Excel.run(async (context) => {
      const range = context.workbook.getSelectedRange();
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      range.load(["values", "address"]);
      sheet.load("name");
      await context.sync();

      const values = range.values;
      if (!values || values.length < 2) {
        addMessage("⚠️ Select at least 2 rows including the header row.", "error");
        return;
      }

      const lookup = buildLookupTable(values);
      if (!lookup) {
        addMessage("⚠️ Could not find period headers (years/quarters) in selection.", "error");
        return;
      }

      const { table, periods } = lookup;
      const count  = Object.keys(table).length;
      const found  = tryLookup(table, question);
      const tokens = estimateTokens(question, found);

      // Compact status line
      addMessage(`📋 ${count} rows · ${periods[0]} → ${periods[periods.length-1]}`, "status-msg");

      addMessage(question, "user");
      $question().value = "";
      $question().style.height = "";
      updateAskBtn();
      isStreaming = true;
      updateAskBtn();
      startAiMessage();

      const dataStr = buildDataStr(table, periods, sheet.name);

      // Build computed string only if we found a direct value
      let computedStr = "";
      if (found?.type === "found") {
        computedStr = `\nLOOKED UP: ${found.label} (${found.period}) = ${fmt(found.value)}\n`;
      } else if (found?.type === "trend") {
        const bd = found.periods.map((p,i) => `${p}: ${fmt(found.values[i])}`).join(", ");
        computedStr = `\nLOOKED UP: ${found.label} — ${bd}\n`;
      }

      ws.send(JSON.stringify({
        type:            "excel_query",
        question,
        dataStr,
        computedStr,
        hasComputed:     found !== null,
        suggestedTokens: tokens,
      }));
    });
  } catch (err) {
    isStreaming = false;
    updateAskBtn();
    addMessage("⚠️ " + err.message, "error");
  }
}

// ── Formula mode ──────────────────────────────────────────────────────────────
async function askFormula() {
  const request = $question().value.trim();
  if (!request || !isConnected || isStreaming) return;

  try {
    await Excel.run(async (context) => {
      const range = context.workbook.getSelectedRange();
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      range.load(["address","rowIndex","columnIndex","rowCount","columnCount","values"]);
      sheet.load("name");
      await context.sync();

      const selRowIdx = range.rowIndex, selColIdx = range.columnIndex;
      const selRows   = range.rowCount,  selCols  = range.columnCount;
      const isSingle  = selRows === 1 && selCols === 1;

      // The selected range IS the target — always insert into what the user selected.
      // Read surrounding data as context (columns to the left, rows above).
      const targetRowIdx   = selRowIdx;
      const targetColIdx   = selColIdx;
      const targetRowCount = selRows;

      // Build context: read up to 10 cols to the left + the rows spanning the selection
      const ctxStartCol = Math.max(0, selColIdx - 10);
      const ctxCols     = selColIdx - ctxStartCol; // exclude the target col itself
      let contextStr = `Target range: ${range.address}\n`;
      if (ctxCols > 0) {
        const ctxRange = sheet.getRangeByIndexes(selRowIdx, ctxStartCol, selRows, ctxCols);
        ctxRange.load(["values"]);
        await context.sync();
        ctxRange.values.forEach((row, ri) => {
          const absRow = selRowIdx + ri + 1;
          contextStr  += row.map((v, ci) =>
            `${colLetter(ctxStartCol+ci)}${absRow}=${v===""||v===null?"(empty)":v}`
          ).join(" | ") + "\n";
        });
      }

      const targetCell  = `${colLetter(targetColIdx)}${targetRowIdx + 1}`;
      const targetRange = targetRowCount > 1
        ? `${targetCell}:${colLetter(targetColIdx)}${targetRowIdx + targetRowCount}`
        : targetCell;
      pendingRange = targetRange;

      addMessage(`📍 Target: ${targetRange}`, "status-msg");
      addMessage(request, "user");
      $question().value = "";
      $question().style.height = "";
      updateAskBtn();
      isStreaming = true;
      updateAskBtn();
      startAiMessage();

      ws.send(JSON.stringify({
        type: "excel_formula", request,
        cellAddress: targetCell,
        targetRange,
        rowCount:    targetRowCount,
        sheetName:   sheet.name,
        context:     contextStr,
      }));
    });
  } catch (err) {
    isStreaming = false;
    updateAskBtn();
    addMessage("⚠️ " + err.message, "error");
  }
}

async function insertFormula() {
  if (!pendingFormula) return;
  const formulas = Array.isArray(pendingFormula) ? pendingFormula : [pendingFormula];
  const t = formulaTarget;
  pendingFormula = null;
  document.querySelectorAll(".insert-btn").forEach(b => { b.disabled = true; b.textContent = "Inserting…"; });
  try {
    await Excel.run(async (context) => {
      const sheet   = context.workbook.worksheets.getActiveWorksheet();
      const rng     = sheet.getRange(t);
      rng.load(["rowCount"]);
      await context.sync();
      const rowCount = rng.rowCount;

      let finalFormulas;
      if (formulas.length >= rowCount) {
        // AI gave one formula per row — use as-is
        finalFormulas = formulas.slice(0, rowCount).map(f => [f]);
      } else {
        // Only one formula — increment row numbers for each subsequent row
        const baseRow = parseInt(t.match(/\d+/)[0]); // e.g. 3 from "L3:L7"
        finalFormulas = Array.from({ length: rowCount }, (_, i) => {
          const f = formulas[0].replace(/([A-Z\$]+)(\d+)/g, (match, col, row) => {
            const r = parseInt(row);
            return r === baseRow ? col + (baseRow + i) : match;
          });
          return [f];
        });
      }
      rng.formulas = finalFormulas;
      await context.sync();
      addMessage(`✅ Inserted ${rowCount} formula${rowCount > 1 ? "s" : ""} → ${t}`, "status-msg");
    });
  } catch (err) { addMessage("⚠️ Insert failed: " + err.message, "error"); }
  document.querySelectorAll(".insert-btn").forEach(b => { b.disabled = false; });
}

// ── Macro mode ────────────────────────────────────────────────────────────────
async function askMacro() {
  const idea = $question().value.trim();
  if (!idea || !isConnected || isStreaming) return;

  // Store user turn in history
  macroHistory.push({ role: "user", content: idea });

  addMessage(idea, "user");
  $question().value      = "";
  $question().style.height = "";
  updateAskBtn();
  isStreaming = true;
  updateAskBtn();
  startAiMessage();

  ws.send(JSON.stringify({
    type:    "macro_query",
    idea,
    history: macroHistory.slice(0, -1), // send previous turns (exclude current)
    suggestedTokens: 1000,
  }));
}

// Copy generated VBA to clipboard and show install instructions
async function copyAndInstallMacro() {
  if (!pendingMacro) return;
  document.querySelectorAll(".insert-btn").forEach(b => { b.disabled = true; b.textContent = "Copied!"; });
  try {
    await navigator.clipboard.writeText(pendingMacro);
    showMacroInstructions();
  } catch {
    // Fallback: select text from a temp textarea
    const ta = document.createElement("textarea");
    ta.value = pendingMacro;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    showMacroInstructions();
  }
  setTimeout(() => {
    document.querySelectorAll(".insert-btn").forEach(b => { b.disabled = false; b.textContent = "📋 Copy & Install Macro"; });
  }, 2000);
}

function showMacroInstructions() {
  const overlay = document.createElement("div");
  overlay.className = "macro-overlay";
  overlay.innerHTML = `
    <div class="macro-overlay-box">
      <div class="macro-overlay-title">✅ Macro copied! Now install it:</div>
      <ol class="macro-steps">
        <li><div class="macro-step-num">1</div><span>Press <span class="macro-key">Alt</span> + <span class="macro-key">F11</span> to open VBA Editor</span></li>
        <li><div class="macro-step-num">2</div><span>Click <span class="macro-key">Insert</span> → <span class="macro-key">Module</span></span></li>
        <li><div class="macro-step-num">3</div><span>Press <span class="macro-key">Ctrl</span> + <span class="macro-key">V</span> to paste</span></li>
        <li><div class="macro-step-num">4</div><span>Press <span class="macro-key">F5</span> to run the macro</span></li>
        <li><div class="macro-step-num">5</div><span>Close the VBA Editor</span></li>
      </ol>
      <div class="macro-warn">💡 Save your file as <b>.xlsm</b> to keep macros permanently</div>
      <button class="macro-ok-btn" id="macroOkBtn">Got it</button>
    </div>`;
  overlay.querySelector("#macroOkBtn").onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}

async function ask() { mode === "formula" ? askFormula() : mode === "macro" ? askMacro() : askQuestion(); }

function handleKey(e) { if (e.key==="Enter"&&!e.shiftKey){e.preventDefault();ask();} }
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 90) + "px";
  updateAskBtn();
}
Office.onReady(() => { connect(); $question().addEventListener("input", updateAskBtn); setMode("ask"); });
