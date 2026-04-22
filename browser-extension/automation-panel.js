// ── CodeForge AI — Automation Panel ──────────────────────────────────────────
// No inline onclick anywhere — all events via addEventListener / delegation

(function () {
  "use strict";

  const STORE_KEY = "cf_workflows";

  // ── Storage ───────────────────────────────────────────────────────────────
  async function loadWorkflows() {
    return new Promise(r => chrome.storage.local.get([STORE_KEY], res => r(res[STORE_KEY] || [])));
  }
  async function saveWorkflows(list) {
    return new Promise(r => chrome.storage.local.set({ [STORE_KEY]: list }, r));
  }

  // ── State ─────────────────────────────────────────────────────────────────
  let isRecording = false;
  let liveSteps   = [];

  const $id = id => document.getElementById(id);

  function escHtml(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  // ── Chip ──────────────────────────────────────────────────────────────────
  function setChip(mode) {
    const chip = $id("autoChip"), dot = $id("autoChipDot"), txt = $id("autoChipText");
    if (!chip) return;
    chip.className = "chip " + mode;
    const map = { rec:["●","Recording"], run:["▶","Running"], idle:["○","Idle"] };
    [dot.textContent, txt.textContent] = map[mode] || ["○","Idle"];
  }

  // ── Trigger badge ─────────────────────────────────────────────────────────
  function triggerBadge(trigger) {
    if (!trigger || trigger.type === "manual" || !trigger.type)
      return { cls:"manual", label:"👆 Manual only" };
    if (!trigger.enabled) return { cls:"off", label:"⏸ Trigger off" };
    switch (trigger.type) {
      case "url":      return { cls:"url",      label:"🌐 URL: " + (trigger.urlPattern||"").slice(0,28) };
      case "element":  return { cls:"element",  label:'👁 On: "' + (trigger.elementText||"").slice(0,22) + '"' };
      case "schedule": return { cls:"schedule", label:"🕐 Every " + trigger.scheduleMinutes + " min" };
      default:         return { cls:"manual",   label:"👆 Manual only" };
    }
  }

  // ── Render workflows ──────────────────────────────────────────────────────
  async function renderWorkflows() {
    const list = await loadWorkflows();
    const wrap = $id("workflowsList");
    if (!wrap) return;
    if (!list.length) {
      wrap.innerHTML = `
        <div class="auto-empty">
          <div class="auto-empty-icon">⚡</div>
          <div class="auto-empty-title">No workflows yet</div>
          <div class="auto-empty-sub">Record a workflow once.<br>Set a trigger — agent runs it forever automatically.</div>
        </div>`;
      return;
    }
    wrap.innerHTML = "";
    list.forEach(wf => {
      const created = new Date(wf.created).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"2-digit"});
      const lastRun = wf.lastRun
        ? new Date(wf.lastRun).toLocaleString("en-IN",{hour12:true,hour:"numeric",minute:"2-digit",day:"numeric",month:"short"})
        : "Never";
      const { cls, label } = triggerBadge(wf.trigger);
      const t = wf.trigger || {};

      const card = document.createElement("div");
      card.className = "wf-card";
      card.dataset.wfId = wf.id;
      card.innerHTML = `
        <div class="wf-card-header">
          <span class="wf-name">${escHtml(wf.name)}</span>
          <span class="wf-meta">${wf.steps.length} steps · ${escHtml(created)}</span>
        </div>
        <span class="trig-badge ${escHtml(cls)}">${escHtml(label)}</span>
        <div style="font-size:10px;color:#334155;margin-top:3px;">Last run: ${escHtml(lastRun)}</div>
        <div class="wf-btns">
          <button class="wf-btn run"  data-action="run"    data-id="${escHtml(wf.id)}">▶ Run</button>
          <button class="wf-btn view" data-action="view"   data-id="${escHtml(wf.id)}">📋 Steps</button>
          <button class="wf-btn view" data-action="trigger" data-id="${escHtml(wf.id)}"
            style="border-color:#8b5cf6;color:#c4b5fd;">⚡ Trigger</button>
          <button class="wf-btn del"  data-action="delete" data-id="${escHtml(wf.id)}">🗑</button>
        </div>

        <!-- Trigger config panel -->
        <div class="trig-panel" id="trigpanel_${escHtml(wf.id)}">
          <div style="font-size:11px;font-weight:700;color:#e2e8f0;">Set Auto-Trigger</div>

          <div class="trig-type-row">
            <button class="trig-type-btn ${!t.type||t.type==='manual'?'active':''}"
              data-action="trig-type" data-id="${escHtml(wf.id)}" data-type="manual">👆 Manual</button>
            <button class="trig-type-btn ${t.type==='url'?'active':''}"
              data-action="trig-type" data-id="${escHtml(wf.id)}" data-type="url">🌐 URL</button>
            <button class="trig-type-btn ${t.type==='element'?'active':''}"
              data-action="trig-type" data-id="${escHtml(wf.id)}" data-type="element">👁 Element</button>
            <button class="trig-type-btn ${t.type==='schedule'?'active':''}"
              data-action="trig-type" data-id="${escHtml(wf.id)}" data-type="schedule">🕐 Time</button>
          </div>

          <div class="trig-field ${t.type==='url'?'visible':''}" id="trig_url_${escHtml(wf.id)}">
            <input class="trig-input" id="tval_url_${escHtml(wf.id)}"
              placeholder="URL pattern e.g. */orders/pending*"
              value="${escHtml(t.urlPattern||'')}"/>
            <div class="trig-hint">Use * as wildcard. Runs automatically when you visit this URL.</div>
          </div>

          <div class="trig-field ${t.type==='element'?'visible':''}" id="trig_elem_${escHtml(wf.id)}">
            <input class="trig-input" id="tval_elem_${escHtml(wf.id)}"
              placeholder='Text to watch for e.g. "New Order"'
              value="${escHtml(t.elementText||'')}"/>
            <div class="trig-hint">Runs when this text appears anywhere on the page.</div>
          </div>

          <div class="trig-field ${t.type==='schedule'?'visible':''}" id="trig_sched_${escHtml(wf.id)}">
            <input class="trig-input" id="tval_sched_${escHtml(wf.id)}" type="number" min="1" max="1440"
              placeholder="Interval in minutes e.g. 30"
              value="${escHtml(String(t.scheduleMinutes||''))}"/>
            <div class="trig-hint">Runs every X minutes automatically in background.</div>
          </div>

          <div class="trig-toggle-row">
            <span class="trig-toggle-label">Trigger enabled</span>
            <div class="trig-toggle ${t.enabled?'on':''}" id="ttoggle_${escHtml(wf.id)}"
              data-action="trig-enabled" data-id="${escHtml(wf.id)}"></div>
          </div>
          <button class="trig-save-btn" data-action="trig-save" data-id="${escHtml(wf.id)}">💾 Save Trigger</button>
        </div>
      `;
      wrap.appendChild(card);
    });
  }

  // ── Event delegation — single listener on autoPanel ───────────────────────
  function initDelegation() {
    const panel = $id("autoPanel");
    if (!panel) return;

    panel.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      const wfId   = btn.dataset.id;

      switch (action) {
        case "run":          await doRun(wfId);         break;
        case "view":         await doView(wfId);        break;
        case "delete":       await doDelete(wfId);      break;
        case "trigger":      doToggleTriggerPanel(wfId);break;
        case "trig-type":    doSetTrigType(wfId, btn.dataset.type); break;
        case "trig-enabled": doToggleEnabled(wfId);    break;
        case "trig-save":    await doSaveTrigger(wfId); break;
      }
    });

    // Record buttons
    $id("recStartBtn").addEventListener("click", doStartRecord);
    $id("recStopBtn").addEventListener("click",  doStopRecord);
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  function doToggleTriggerPanel(wfId) {
    const panel = $id("trigpanel_" + wfId);
    if (panel) panel.classList.toggle("open");
  }

  function doSetTrigType(wfId, type) {
    const trigPanel = $id("trigpanel_" + wfId);
    if (!trigPanel) return;
    // Toggle active class on buttons
    trigPanel.querySelectorAll(".trig-type-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.type === type);
    });
    // Show correct field
    const fieldMap = { url:"url", element:"elem", schedule:"sched" };
    ["url","elem","sched"].forEach(key => {
      const f = $id("trig_" + key + "_" + wfId);
      const matchType = Object.entries(fieldMap).find(([,v]) => v === key)?.[0];
      if (f) f.classList.toggle("visible", matchType === type);
    });
  }

  function doToggleEnabled(wfId) {
    const tog = $id("ttoggle_" + wfId);
    if (tog) tog.classList.toggle("on");
  }

  async function doSaveTrigger(wfId) {
    const list = await loadWorkflows();
    const wf = list.find(w => w.id === wfId);
    if (!wf) return;
    const trigPanel = $id("trigpanel_" + wfId);
    if (!trigPanel) return;

    const activeBtn = trigPanel.querySelector(".trig-type-btn.active");
    const type = activeBtn?.dataset.type || "manual";
    const enabled = $id("ttoggle_" + wfId)?.classList.contains("on") || false;

    wf.trigger = { type, enabled };
    if (type === "url")      wf.trigger.urlPattern      = ($id("tval_url_"   + wfId)?.value||"").trim();
    if (type === "element")  wf.trigger.elementText     = ($id("tval_elem_"  + wfId)?.value||"").trim();
    if (type === "schedule") wf.trigger.scheduleMinutes = parseInt($id("tval_sched_" + wfId)?.value||"30", 10);

    await saveWorkflows(list);
    trigPanel.classList.remove("open");
    await renderWorkflows();
    showToast("⚡ Trigger saved — " + triggerBadge(wf.trigger).label);
  }

  async function doRun(wfId) {
    const list = await loadWorkflows();
    const wf = list.find(w => w.id === wfId);
    if (!wf) return;

    $id("runLogWrap").style.display = "";
    $id("runLog").innerHTML = "";
    addRunLog("▶ Starting: " + wf.name, "");
    addRunLog("📋 Steps to run: " + wf.steps.length, "log-ok");

    // Validate steps have proper desc
    const badSteps = wf.steps.filter(s => !s.desc && s.type !== "navigate" && s.type !== "keypress");
    if (badSteps.length) {
      addRunLog("⚠️ " + badSteps.length + " step(s) have no element data — re-record this workflow.", "log-err");
      showToast("⚠️ Workflow needs re-recording — steps missing element data");
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) { addRunLog("❌ No active tab found", "log-err"); return; }

    addRunLog("🌐 Tab: " + (tab.title || tab.url || tab.id), "");

    // Reset any stuck run state first
    try { await chrome.tabs.sendMessage(tab.id, { type: "STOP_RUN" }); } catch {}

    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: "START_RUN", workflow: wf, alwaysSkip: [] });
      if (!res?.ok) throw new Error("Content script returned not-ok");
    } catch (e) {
      addRunLog("⚙️ Injecting automation engine…", "");
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["automation-recorder.js"] });
        await new Promise(r => setTimeout(r, 300));
        await chrome.tabs.sendMessage(tab.id, { type: "START_RUN", workflow: wf, alwaysSkip: [] });
      } catch (e2) {
        addRunLog("❌ Cannot run on this page: " + e2.message, "log-err");
        addRunLog("ℹ️ Try on a regular website (not chrome:// pages)", "");
        return;
      }
    }

    setChip("run");
    addRunLog("⚡ Automation running on page… watch the page!", "log-ok");
    wf.lastRun = Date.now();
    await saveWorkflows(list);
  }

  async function doView(wfId) {
    const list = await loadWorkflows();
    const wf = list.find(w => w.id === wfId);
    if (!wf) return;
    const icons = { click:"👆", type:"⌨️", navigate:"🌐" };
    $id("runLog").innerHTML = `<span style="color:#64748b;font-weight:700;">${escHtml(wf.name)}:</span><br>`;
    wf.steps.forEach((s, i) => {
      $id("runLog").innerHTML += `<span class="log-ok">${i+1}. ${icons[s.type]||"▪"} ${escHtml(s.label)}</span><br>`;
    });
    $id("runLogWrap").style.display = "";
  }

  async function doDelete(wfId) {
    const list = await loadWorkflows();
    await saveWorkflows(list.filter(w => w.id !== wfId));
    await renderWorkflows();
  }

  // ── Recording ─────────────────────────────────────────────────────────────
  async function doStartRecord() {
    const name = $id("wfName").value.trim();
    if (!name) { $id("wfName").focus(); $id("wfName").style.borderColor = "#ef4444"; return; }
    $id("wfName").style.borderColor = "";
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "START_RECORDING" });
    } catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["automation-recorder.js"] });
      await chrome.tabs.sendMessage(tab.id, { type: "START_RECORDING" });
    }
    isRecording = true; liveSteps = [];
    setChip("rec");
    $id("recStartBtn").disabled = true;
    $id("recStopBtn").disabled  = false;
    $id("stepsList").innerHTML  = "";
    $id("stepsPreviewWrap").style.display = "";
    $id("autoStepCount").textContent = "0 steps";
  }

  async function doStopRecord() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    let steps = [];
    try {
      // STOP_RECORDING returns the full steps with desc intact
      const res = await chrome.tabs.sendMessage(tab.id, { type: "STOP_RECORDING" });
      if (res?.steps?.length) steps = res.steps;
    } catch (e) {
      addRunLog("⚠️ Could not reach content script: " + e.message, "log-err");
    }

    if (!steps.length) {
      setChip("idle");
      $id("recStartBtn").disabled = false;
      $id("recStopBtn").disabled  = true;
      isRecording = false;
      showToast("⚠️ No steps recorded");
      return;
    }
    const wf = {
      id:      "wf_" + Date.now(),
      name:    $id("wfName").value.trim() || "Workflow",
      steps, created: Date.now(), lastRun: null,
      trigger: { type: "manual", enabled: false }
    };
    const list = await loadWorkflows();
    list.unshift(wf);
    await saveWorkflows(list);
    isRecording = false;
    setChip("idle");
    $id("recStartBtn").disabled = false;
    $id("recStopBtn").disabled  = true;
    $id("wfName").value = "";
    $id("stepsPreviewWrap").style.display = "none";
    $id("autoStepCount").textContent = "";
    await renderWorkflows();
    showToast("✅ Saved — " + steps.length + " steps · Click ⚡ Trigger to auto-run!");
  }

  // ── Run log ───────────────────────────────────────────────────────────────
  function addRunLog(text, cls) {
    const el = $id("runLog");
    if (!el) return;
    el.innerHTML += `<span class="${escHtml(cls||'')}">${escHtml(text)}</span><br>`;
    el.scrollTop = el.scrollHeight;
    $id("runLogWrap").style.display = "";
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg) {
    const t = document.createElement("div");
    t.style.cssText = `
      position:fixed;bottom:14px;left:50%;transform:translateX(-50%);
      background:#1e293b;border:1px solid #334155;border-radius:20px;
      color:#e2e8f0;font-size:11.5px;font-weight:600;padding:7px 16px;
      z-index:9999;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.5);
    `;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // ── Messages from content scripts ─────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "STEP_RECORDED") {
      liveSteps.push({ label: msg.label });
      const wrap = $id("stepsList");
      if (wrap) {
        const div = document.createElement("div");
        div.className = "step-item";
        div.innerHTML = `<span class="sn">${escHtml(String(msg.count))}.</span><span>${escHtml(msg.label)}</span>`;
        wrap.appendChild(div);
        wrap.scrollTop = wrap.scrollHeight;
      }
      const sc = $id("autoStepCount");
      if (sc) sc.textContent = msg.count + " steps";
    }
    if (msg.type === "STEP_RUNNING") {
      addRunLog("⏳ Step " + msg.index + "/" + msg.total + ": " + msg.label, "");
    }
    if (msg.type === "STEP_CONFIDENCE") {
      const bar = msg.confidence >= 70 ? "🟢" : msg.confidence >= 40 ? "🟡" : "🔴";
      addRunLog("   " + bar + " Match confidence: " + msg.confidence + "%", "");
    }
    if (msg.type === "STEP_DONE") {
      const icon = { ok:"✅", skipped:"⏭", "always-skip":"🚫", "re-record":"✏️" }[msg.result] || "⚠️";
      const cls  = msg.result === "ok" ? "log-ok" : msg.result.startsWith("error") ? "log-err" : "log-skip";
      addRunLog(icon + " Done: " + msg.label + " → " + msg.result, cls);
    }
    if (msg.type === "RUN_COMPLETE") {
      setChip("idle");
      addRunLog("─── Run complete ───", "");
      renderWorkflows();
    }
    if (msg.type === "AUTO_RUN_STARTED") {
      setChip("run");
      addRunLog("⚡ Auto-triggered: " + msg.name, "log-ok");
    }
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { renderWorkflows(); initDelegation(); });
  } else {
    renderWorkflows(); initDelegation();
  }

})();
