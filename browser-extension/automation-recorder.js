// ── CodeForge AI — Automation Recorder + Runner ───────────────────────────────
(function () {
  "use strict";

  let isRecording   = false;
  let isRunning     = false;
  let recordedSteps = [];
  let floatingBar   = null;

  // ── XPath generator ───────────────────────────────────────────────────────
  // XPath is the most reliable way to find an element again later
  function getXPath(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el.id) return '//*[@id="' + el.id + '"]';
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.body) {
      let idx = 1;
      let sib = cur.previousElementSibling;
      while (sib) { if (sib.tagName === cur.tagName) idx++; sib = sib.previousElementSibling; }
      parts.unshift(cur.tagName.toLowerCase() + (idx > 1 ? "[" + idx + "]" : ""));
      cur = cur.parentElement;
    }
    return "//" + parts.join("/");
  }

  // Find element by XPath
  function findByXPath(xpath) {
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue;
    } catch { return null; }
  }

  // ── Element description (captures everything) ─────────────────────────────
  function describeElement(el) {
    if (!el) return {};
    const tag   = el.tagName.toLowerCase();
    const text  = (el.innerText || el.textContent || "").trim().slice(0, 80);
    const label = el.getAttribute("aria-label") || el.getAttribute("title") || "";
    const ph    = el.getAttribute("placeholder") || el.getAttribute("data-placeholder") || "";
    const name  = el.getAttribute("name") || el.getAttribute("id") || "";
    const type  = el.getAttribute("type") || "";
    const role  = el.getAttribute("role") || "";
    const editable = el.getAttribute("contenteditable");
    const testid = el.getAttribute("data-testid") || "";
    const parentText = (el.parentElement?.innerText || "").trim().slice(0, 60);
    const href  = el.getAttribute("href") || "";
    const xpath = getXPath(el);
    const isContentEditable = editable === "true" || editable === "";
    return { tag, text, label, ph, name, type, role, testid, parentText, href, xpath, isContentEditable, url: location.href };
  }

  // ── Smart element finder ──────────────────────────────────────────────────
  function findElement(desc) {
    if (!desc) return { el: null, confidence: 0 };

    // 1. Try XPath first — most precise
    if (desc.xpath) {
      const el = findByXPath(desc.xpath);
      if (el && el.offsetParent !== null) return { el, confidence: 1.0 };
    }

    // 2. Try by id/name
    if (desc.name) {
      const el = document.getElementById(desc.name) ||
                 document.querySelector('[name="' + desc.name + '"]');
      if (el && el.offsetParent !== null) return { el, confidence: 0.95 };
    }

    // 3. Try by data-testid
    if (desc.testid) {
      const el = document.querySelector('[data-testid="' + desc.testid + '"]');
      if (el && el.offsetParent !== null) return { el, confidence: 0.95 };
    }

    // 4. Semantic scoring across all visible elements
    const tags = ["A","BUTTON","INPUT","SELECT","TEXTAREA","LABEL",
                  "LI","TD","DIV","SPAN","P","H1","H2","H3","SECTION"];
    const all = Array.from(document.querySelectorAll("*")).filter(el =>
      tags.includes(el.tagName) && el.offsetParent !== null
    );

    let best = null, bestScore = 0;
    for (const el of all) {
      let score = 0;
      const elText   = (el.innerText || el.textContent || "").trim().slice(0, 80);
      const elLabel  = el.getAttribute("aria-label") || el.getAttribute("title") || "";
      const elPh     = el.getAttribute("placeholder") || el.getAttribute("data-placeholder") || "";
      const elName   = el.getAttribute("name") || el.getAttribute("id") || "";
      const elHref   = el.getAttribute("href") || "";
      const elTag    = el.tagName.toLowerCase();
      const elTest   = el.getAttribute("data-testid") || "";
      const elRole   = el.getAttribute("role") || "";

      if (desc.tag   && elTag   === desc.tag)   score += 1;
      if (desc.role  && elRole  === desc.role)  score += 2;
      if (desc.label && elLabel && elLabel.toLowerCase().includes(desc.label.toLowerCase())) score += 5;
      if (desc.ph    && elPh    && elPh.toLowerCase().includes(desc.ph.toLowerCase()))       score += 4;
      if (desc.name  && elName  && elName.toLowerCase() === desc.name.toLowerCase())         score += 4;
      if (desc.text  && elText  && elText.toLowerCase().includes(desc.text.toLowerCase()))   score += 3;
      if (desc.href  && elHref  && elHref.includes(desc.href))                               score += 3;
      if (desc.testid && elTest && elTest === desc.testid)                                   score += 5;

      if (score > bestScore) { bestScore = score; best = el; }
    }

    const filledFields = ["label","ph","name","text","href","testid"].filter(k => desc[k]).length || 1;
    const confidence = Math.min(bestScore / (filledFields * 4), 1);
    return { el: best, confidence, score: bestScore };
  }

  // ── Type into any element — React/Vue/Angular compatible ─────────────────
  function typeInto(el, text) {
    el.focus();
    const isEditable = el.getAttribute("contenteditable") === "true" ||
                       el.getAttribute("contenteditable") === "";

    if (isEditable) {
      // ContentEditable (ChatGPT, Notion, Slack, etc.)
      // Must clear first, then insert — React hooks into execCommand
      el.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
      document.execCommand("insertText", false, text);

      // Always fire React-compatible input event after execCommand
      el.dispatchEvent(new InputEvent("input", {
        bubbles: true, cancelable: true,
        inputType: "insertText", data: text
      }));

      // If execCommand didn't work (some browsers), fallback
      const content = el.textContent || el.innerText || "";
      if (!content.trim()) {
        el.textContent = text;
        el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      }

    } else if (el.tagName === "SELECT") {
      const opts = Array.from(el.options);
      const match = opts.find(o =>
        o.value.toLowerCase().includes((text||"").toLowerCase()) ||
        o.text.toLowerCase().includes((text||"").toLowerCase())
      );
      if (match) {
        el.value = match.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } else {
      // Regular INPUT / TEXTAREA — use native setter so React detects change
      const proto = el.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (nativeSetter) {
        nativeSetter.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new InputEvent("input",  { bubbles: true, inputType: "insertText", data: text }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  // ── Wait for an element to become clickable (not disabled) ───────────────
  async function waitUntilEnabled(el, timeoutMs = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (!el.disabled && !el.getAttribute("disabled") &&
          el.getAttribute("aria-disabled") !== "true") return true;
      await delay(100);
    }
    return false; // still disabled after timeout
  }

  // ── Floating recording bar ────────────────────────────────────────────────
  function showBar(mode) {
    removeBar();
    const style = document.createElement("style");
    style.id = "cf-auto-style";
    style.textContent = "@keyframes cf-pulse{0%,100%{opacity:1}50%{opacity:.4}} @keyframes cf-spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(style);

    floatingBar = document.createElement("div");
    floatingBar.id = "cf-auto-bar";
    floatingBar.style.cssText = "position:fixed;top:12px;right:12px;z-index:2147483647;background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:10px 16px;display:flex;align-items:center;gap:10px;font-family:-apple-system,sans-serif;font-size:12.5px;color:#e2e8f0;box-shadow:0 4px 24px rgba(0,0,0,.6);";
    if (mode === "recording") {
      floatingBar.innerHTML = '<span style="width:9px;height:9px;border-radius:50%;background:#ef4444;flex-shrink:0;animation:cf-pulse 1.2s ease infinite;"></span><span style="color:#fca5a5;font-weight:600;">Recording</span><span id="cf-step-count" style="color:#64748b;font-size:11px;">0 steps</span><button id="cf-stop-bar" style="background:#1e293b;border:1px solid #334155;border-radius:7px;color:#94a3b8;font-size:11px;padding:4px 10px;cursor:pointer;">■ Stop</button>';
      document.body.appendChild(floatingBar);
      document.getElementById("cf-stop-bar").addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "STOP_RECORDING" });
      });
    } else if (mode === "running") {
      floatingBar.innerHTML = '<span style="width:10px;height:10px;border:2px solid #3b82f6;border-top-color:transparent;border-radius:50%;animation:cf-spin .7s linear infinite;flex-shrink:0;"></span><span style="color:#93c5fd;font-weight:600;">Running</span><span id="cf-run-step" style="color:#64748b;font-size:11px;">Step 1</span><button id="cf-stop-run" style="background:#1e293b;border:1px solid #334155;border-radius:7px;color:#94a3b8;font-size:11px;padding:4px 10px;cursor:pointer;">✕ Stop</button>';
      document.body.appendChild(floatingBar);
      document.getElementById("cf-stop-run").addEventListener("click", () => {
        isRunning = false; removeBar();
        notifyPanel({ type: "RUN_COMPLETE", log: [], skips: [] });
      });
    }
  }

  function removeBar() {
    document.getElementById("cf-auto-bar")?.remove();
    document.getElementById("cf-auto-style")?.remove();
    floatingBar = null;
  }

  function updateStepCount(n) {
    const el = document.getElementById("cf-step-count");
    if (el) el.textContent = n + " steps";
  }
  function updateRunStep(text) {
    const el = document.getElementById("cf-run-step");
    if (el) el.textContent = text;
  }

  // ── Ask overlay (when stuck) ──────────────────────────────────────────────
  function showAskOverlay(stepLabel, onShowMe, onSkip, onAlwaysSkip) {
    document.getElementById("cf-ask-overlay")?.remove();
    const ov = document.createElement("div");
    ov.id = "cf-ask-overlay";
    ov.style.cssText = "position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;font-family:-apple-system,sans-serif;";
    const box = document.createElement("div");
    box.style.cssText = "background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:24px 28px;max-width:380px;width:90%;box-shadow:0 8px 40px rgba(0,0,0,.8);";
    box.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;"><span style="font-size:22px;">🤔</span><span style="font-size:14px;font-weight:700;color:#f1f5f9;">Agent needs help</span></div><div style="font-size:12.5px;color:#94a3b8;line-height:1.65;margin-bottom:18px;">Could not find element for:<br><span style="color:#fbbf24;font-weight:600;">"' + escHtml(stepLabel) + '"</span><br><br>What should I do?</div>';
    const btns = [
      { id:"cf-ask-show",   text:"👆 Show me — I'll re-record this step", fn: onShowMe },
      { id:"cf-ask-skip",   text:"⏭ Skip this step this time",            fn: onSkip },
      { id:"cf-ask-always", text:"🚫 Always skip this step",              fn: onAlwaysSkip }
    ];
    btns.forEach(b => {
      const btn = document.createElement("button");
      btn.id = b.id;
      btn.textContent = b.text;
      btn.style.cssText = "display:block;width:100%;margin-bottom:6px;background:#161b26;border:1px solid #1e293b;border-radius:8px;color:#64748b;font-size:12px;font-weight:600;padding:9px 14px;cursor:pointer;text-align:left;";
      btn.addEventListener("click", () => { ov.remove(); b.fn(); });
      box.appendChild(btn);
    });
    ov.appendChild(box);
    document.body.appendChild(ov);
  }

  function escHtml(s) { return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  // ── Run a single step ─────────────────────────────────────────────────────
  async function runStep(step, skipSet) {
    if (!isRunning) return "stopped";
    if (skipSet && skipSet.has(step.label)) return "skipped";

    if (step.type === "navigate") {
      if (location.href !== step.url) location.href = step.url;
      return "ok";
    }

    // Keyboard step — simulate key press on active/focused element
    if (step.type === "keypress") {
      const target = document.activeElement || document.body;
      const keyOpts = { key: step.key, code: "Key" + step.key, bubbles: true, cancelable: true };
      target.dispatchEvent(new KeyboardEvent("keydown", keyOpts));
      target.dispatchEvent(new KeyboardEvent("keypress", keyOpts));
      target.dispatchEvent(new KeyboardEvent("keyup",   keyOpts));
      await delay(600);
      return "ok";
    }

    const { el, confidence, score } = findElement(step.desc);
    notifyPanel({ type: "STEP_CONFIDENCE", label: step.label, confidence: Math.round(confidence * 100), score });

    if (!el || confidence < 0.25) {
      return new Promise(resolve => {
        showAskOverlay(step.label,
          () => resolve("re-record"),
          () => resolve("skipped"),
          () => resolve("always-skip")
        );
      });
    }

    try {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      await delay(300);

      // Blue highlight so user can see what agent is touching
      const prevOutline = el.style.outline;
      el.style.outline = "3px solid #3b82f6";
      await delay(300);
      el.style.outline = prevOutline;

      if (step.type === "click") {
        // Wait up to 3s for button to become enabled (React apps update async)
        await waitUntilEnabled(el, 3000);
        el.click();
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        await delay(600);

      } else if (step.type === "type") {
        typeInto(el, step.value || "");
        // After typing, give React/Vue/Angular time to process & enable submit button
        await delay(800);
      }

      return "ok";
    } catch (err) {
      return "error:" + err.message;
    }
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Event capture ─────────────────────────────────────────────────────────
  function onClickCapture(e) {
    if (!isRecording) return;
    const el = e.target;
    if (el.closest("#cf-auto-bar") || el.closest("#cf-ask-overlay")) return;
    const desc = describeElement(el);
    const label = desc.label || desc.text || desc.ph || desc.name || desc.testid || desc.tag;
    recordedSteps.push({ type: "click", desc, label: "Click: " + (label || "element").slice(0, 40), url: location.href });
    updateStepCount(recordedSteps.length);
    notifyPanel({ type: "STEP_RECORDED", count: recordedSteps.length, label: "Click: " + (label || "element").slice(0, 40) });
  }

  // ── Keyboard capture (Enter/Tab/Escape) ──────────────────────────────────
  function onKeyCapture(e) {
    if (!isRecording) return;
    if (!["Enter","Tab","Escape"].includes(e.key)) return;
    // Don't record Enter inside a textarea that allows newlines (shift+enter)
    if (e.key === "Enter" && e.shiftKey) return;
    // Only record if focus is on an input/contenteditable (not a button)
    const el = document.activeElement;
    if (!el) return;
    const tag = el.tagName;
    const isInput = ["INPUT","TEXTAREA","SELECT"].includes(tag) ||
                    el.getAttribute("contenteditable") === "true" ||
                    el.getAttribute("contenteditable") === "";
    if (!isInput) return;
    const label = "Press " + e.key;
    recordedSteps.push({ type: "keypress", key: e.key, label, url: location.href });
    updateStepCount(recordedSteps.length);
    notifyPanel({ type: "STEP_RECORDED", count: recordedSteps.length, label });
  }

  let lastInputEl = null, lastInputTimer = null;
  function onInputCapture(e) {
    if (!isRecording) return;
    const el = e.target;
    if (!["INPUT","TEXTAREA","SELECT"].includes(el.tagName) &&
        el.getAttribute("contenteditable") !== "true" &&
        el.getAttribute("contenteditable") !== "") return;

    const desc = describeElement(el);
    const fieldLabel = desc.label || desc.ph || desc.name || desc.tag;
    const currentValue = el.value !== undefined ? el.value : (el.textContent || "");

    // Debounce — update last step if same field
    if (lastInputEl === el) {
      clearTimeout(lastInputTimer);
      const last = recordedSteps[recordedSteps.length - 1];
      if (last && last.type === "type") {
        last.value = currentValue;
        last.desc.value = currentValue;
      }
      lastInputTimer = setTimeout(() => {
        notifyPanel({ type: "STEP_RECORDED", count: recordedSteps.length, label: "Type in " + fieldLabel + ': "' + currentValue.slice(0,20) + '"' });
      }, 400);
    } else {
      lastInputEl = el;
      const stepLabel = 'Type in ' + fieldLabel + ': "' + currentValue.slice(0,20) + '"';
      recordedSteps.push({ type: "type", desc, value: currentValue, label: stepLabel, url: location.href });
      updateStepCount(recordedSteps.length);
      notifyPanel({ type: "STEP_RECORDED", count: recordedSteps.length, label: stepLabel });
    }
  }

  function attachListeners() {
    document.addEventListener("click",   onClickCapture, { capture: true });
    document.addEventListener("input",   onInputCapture, { capture: true });
    document.addEventListener("change",  onInputCapture, { capture: true });
    document.addEventListener("keydown", onKeyCapture,   { capture: true });
  }
  function detachListeners() {
    document.removeEventListener("click",   onClickCapture, { capture: true });
    document.removeEventListener("input",   onInputCapture, { capture: true });
    document.removeEventListener("change",  onInputCapture, { capture: true });
    document.removeEventListener("keydown", onKeyCapture,   { capture: true });
  }

  // ── Message handler ───────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

    if (msg.type === "PING") {
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === "START_RECORDING") {
      isRecording = true;
      recordedSteps = [];
      lastInputEl = null;
      showBar("recording");
      attachListeners();
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === "STOP_RECORDING") {
      isRecording = false;
      detachListeners();
      removeBar();
      sendResponse({ ok: true, steps: recordedSteps, count: recordedSteps.length });
      return true;
    }

    if (msg.type === "GET_STEPS") {
      sendResponse({ steps: recordedSteps });
      return true;
    }

    if (msg.type === "STOP_RUN") {
      isRunning = false;
      removeBar();
      document.getElementById("cf-ask-overlay")?.remove();
      sendResponse({ ok: true });
      return true;
    }

    if (msg.type === "START_RUN") {
      isRunning = true;
      const workflow  = msg.workflow;
      const skipSet   = new Set(msg.alwaysSkip || []);
      showBar("running");
      sendResponse({ ok: true });

      (async () => {
        const steps = workflow.steps || [];
        const log   = [];
        for (let i = 0; i < steps.length; i++) {
          if (!isRunning) break;
          updateRunStep("Step " + (i+1) + "/" + steps.length);
          notifyPanel({ type: "STEP_RUNNING", index: i+1, total: steps.length, label: steps[i].label });
          const result = await runStep(steps[i], skipSet);
          log.push({ step: i, label: steps[i].label, result });
          notifyPanel({ type: "STEP_DONE", index: i+1, label: steps[i].label, result });
          if (result === "always-skip") skipSet.add(steps[i].label);
          if (result === "stopped") break;
          await delay(700);
        }
        isRunning = false;
        removeBar();
        notifyPanel({ type: "RUN_COMPLETE", log, skips: Array.from(skipSet) });
      })();
      return true;
    }

    return true;
  });

  function notifyPanel(data) {
    try { chrome.runtime.sendMessage(data).catch(() => {}); } catch {}
  }

  // ── SPA navigation detection ──────────────────────────────────────────────
  const _push    = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);
  history.pushState    = function(...a) { _push(...a);    checkUrlTriggers(); };
  history.replaceState = function(...a) { _replace(...a); checkUrlTriggers(); };

  // ── Trigger system ────────────────────────────────────────────────────────
  function urlMatches(pattern, url) {
    if (!pattern) return false;
    try {
      return new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g,"\\$&").replace(/\*/g,".*") + "$").test(url);
    } catch { return url.includes(pattern); }
  }

  async function checkUrlTriggers() {
    const url = location.href;
    const result = await new Promise(r => chrome.storage.local.get(["cf_workflows"], r));
    const workflows = result.cf_workflows || [];
    for (const wf of workflows) {
      if (!wf.trigger || wf.trigger.type !== "url" || !wf.trigger.enabled) continue;
      if (!urlMatches(wf.trigger.urlPattern, url)) continue;
      const key = "cf_last_url_" + wf.id;
      if (sessionStorage.getItem(key) === url) continue;
      sessionStorage.setItem(key, url);
      await delay(1000);
      autoTriggerRun(wf);
    }
  }

  function watchElementTriggers(workflows) {
    const targets = workflows.filter(wf => wf.trigger?.type === "element" && wf.trigger?.enabled && wf.trigger?.elementText);
    if (!targets.length) return;
    const observer = new MutationObserver(() => {
      const bodyText = (document.body.innerText || "").toLowerCase();
      for (const wf of targets) {
        const needle = (wf.trigger.elementText || "").toLowerCase();
        if (!needle || !bodyText.includes(needle)) continue;
        observer.disconnect();
        const key = "cf_last_elem_" + wf.id;
        if (sessionStorage.getItem(key) === needle) return;
        sessionStorage.setItem(key, needle);
        delay(400).then(() => autoTriggerRun(wf));
        break;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function showAutoToast(name) {
    const t = document.createElement("div");
    t.style.cssText = "position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#0f172a;border:1px solid #3b82f6;border-radius:20px;color:#93c5fd;font-family:-apple-system,sans-serif;font-size:12px;font-weight:600;padding:8px 18px;z-index:2147483647;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.7);";
    t.textContent = "⚡ Auto-running: " + name;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  function autoTriggerRun(wf) {
    if (isRecording || isRunning) return;
    showAutoToast(wf.name);
    delay(1200).then(() => notifyPanel({ type: "TRIGGER_RUN_WORKFLOW", workflowId: wf.id }));
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "ALARM_RUN_WORKFLOW") {
      chrome.storage.local.get(["cf_workflows"], result => {
        const wf = (result.cf_workflows || []).find(w => w.id === msg.workflowId);
        if (wf) autoTriggerRun(wf);
      });
      sendResponse({ ok: true });
      return true;
    }
  });

  // ── Init triggers on page ready ───────────────────────────────────────────
  (async function () {
    await delay(1200);
    const result = await new Promise(r => chrome.storage.local.get(["cf_workflows"], r));
    const workflows = result.cf_workflows || [];
    checkUrlTriggers();
    watchElementTriggers(workflows);
  })();

  // ── Bot Widget message bridge (window.postMessage ↔ chrome.runtime) ────────
  // bot.js (in page) sends   { channel:"CFBOT_OUT", type:"BOT_*", ... }
  // we reply via             { channel:"CFBOT_IN",  type:"BOT_*", ... }

  function botReply(payload) {
    window.postMessage({ channel: "CFBOT_IN", ...payload }, "*");
  }

  window.addEventListener("message", async (e) => {
    if (!e.data || e.data.channel !== "CFBOT_OUT") return;
    const msg = e.data;

    // ── Return all saved workflows ──────────────────────────────────────────
    if (msg.type === "BOT_GET_WORKFLOWS") {
      const r = await new Promise(res => chrome.storage.local.get(["cf_workflows"], res));
      botReply({ type: "BOT_WORKFLOWS", workflows: r.cf_workflows || [] });
      return;
    }

    // ── Run a workflow by ID ────────────────────────────────────────────────
    if (msg.type === "BOT_RUN") {
      const r  = await new Promise(res => chrome.storage.local.get(["cf_workflows"], res));
      const wf = (r.cf_workflows || []).find(w => w.id === msg.workflowId);
      if (!wf) { botReply({ type: "BOT_RUN_COMPLETE", success: false, error: "Workflow not found" }); return; }
      if (isRunning) { botReply({ type: "BOT_RUN_COMPLETE", success: false, error: "Already running" }); return; }

      isRunning = true;
      const steps = wf.steps || [];
      const skipSet = new Set();

      for (let i = 0; i < steps.length; i++) {
        if (!isRunning) break;
        botReply({ type: "BOT_RUN_STEP", index: i + 1, total: steps.length, label: steps[i].label });
        const result = await runStep(steps[i], skipSet);
        if (result === "stopped") break;
        await delay(700);
      }
      isRunning = false;
      botReply({ type: "BOT_RUN_COMPLETE", success: true });
      return;
    }

    // ── Save schedule trigger ───────────────────────────────────────────────
    if (msg.type === "BOT_SAVE_SCHEDULE") {
      const r  = await new Promise(res => chrome.storage.local.get(["cf_workflows"], res));
      const wfs = r.cf_workflows || [];
      const wf  = wfs.find(w => w.id === msg.workflowId);
      if (!wf) return;
      wf.trigger = { type: "schedule", enabled: true, scheduleMinutes: msg.scheduleMinutes };
      await new Promise(res => chrome.storage.local.set({ cf_workflows: wfs }, res));
      // background.js will pick up storage change and sync alarms
      return;
    }

    // ── Custom prompt run ────────────────────────────────────────────────────
    // Sends prompt to the local AI (port 7471), gets back steps, runs them.
    if (msg.type === "BOT_CUSTOM_RUN") {
      if (isRunning) { botReply({ type: "BOT_CUSTOM_DONE", success: false, error: "Already running" }); return; }
      botReply({ type: "BOT_RUN_STEP", index: 0, total: 0, label: "Asking AI…" });

      try {
        // Build page context for AI
        const pageContext = {
          url   : location.href,
          title : document.title,
          inputs: Array.from(document.querySelectorAll("input,textarea,[contenteditable]"))
                       .slice(0, 10)
                       .map(el => ({
                         tag        : el.tagName.toLowerCase(),
                         placeholder: el.getAttribute("placeholder") || "",
                         label      : el.getAttribute("aria-label") || "",
                         name       : el.getAttribute("name") || "",
                         id         : el.id || "",
                       })),
          buttons: Array.from(document.querySelectorAll("button,a[role=button],[role=button]"))
                        .slice(0, 10)
                        .map(el => ({
                          tag  : el.tagName.toLowerCase(),
                          text : (el.innerText || "").trim().slice(0, 40),
                          label: el.getAttribute("aria-label") || "",
                        })),
        };

        const systemPrompt =
          `You are a browser automation assistant. Given a user's natural language request and the current page context, ` +
          `return a JSON array of automation steps. Each step must be one of:\n` +
          `  { "type":"click",  "desc": { "text":"<button text>", "tag":"button" } }\n` +
          `  { "type":"type",   "desc": { "tag":"input", "placeholder":"<placeholder>" }, "value":"<text to type>" }\n` +
          `  { "type":"keypress","key":"Enter" }\n` +
          `Return ONLY valid JSON array, no explanation.`;

        const userMsg =
          `Page: ${pageContext.title} (${pageContext.url})\n` +
          `Inputs: ${JSON.stringify(pageContext.inputs)}\n` +
          `Buttons: ${JSON.stringify(pageContext.buttons)}\n\n` +
          `Task: ${msg.prompt}`;

        // Use WebSocket to reach the local AI server (same as sidepanel)
        const raw = await new Promise((resolve, reject) => {
          let ws;
          try { ws = new WebSocket("ws://127.0.0.1:7471"); }
          catch (err) { reject(new Error("Cannot connect to AI server")); return; }

          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error("AI server timed out"));
          }, 15000);

          ws.onopen = () => {
            ws.send(JSON.stringify({
              type       : "browser_query",
              question   : userMsg,
              pageTitle  : document.title,
              pageUrl    : location.href,
              pageContent: systemPrompt,   // repurpose as extra system context
            }));
          };

          let accumulated = "";
          ws.onmessage = (e) => {
            try {
              const d = JSON.parse(e.data);
              if (d.type === "token" || d.type === "chunk") {
                accumulated += (d.token || d.text || "");
              } else if (d.type === "done" || d.type === "response") {
                clearTimeout(timeout);
                ws.close();
                resolve(accumulated || d.response || d.content || "");
              } else if (d.type === "error") {
                clearTimeout(timeout);
                ws.close();
                reject(new Error(d.message || "AI error"));
              }
            } catch {}
          };

          ws.onerror = () => { clearTimeout(timeout); reject(new Error("WebSocket error")); };
        });

        // Extract JSON array from response
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error("AI did not return valid steps");
        const steps = JSON.parse(jsonMatch[0]);

        if (!Array.isArray(steps) || !steps.length) throw new Error("No steps returned");

        // Run the steps
        isRunning = true;
        const skipSet = new Set();
        for (let i = 0; i < steps.length; i++) {
          if (!isRunning) break;
          // Add labels for status updates
          const s = steps[i];
          s.label = s.label || (s.type === "type" ? `Type: ${s.value}` : s.type === "click" ? `Click: ${s.desc?.text || ""}` : s.type);
          botReply({ type: "BOT_RUN_STEP", index: i + 1, total: steps.length, label: s.label });
          const result = await runStep(s, skipSet);
          if (result === "stopped") break;
          await delay(700);
        }
        isRunning = false;
        botReply({ type: "BOT_CUSTOM_DONE", success: true });

      } catch (err) {
        isRunning = false;
        botReply({ type: "BOT_CUSTOM_DONE", success: false, error: err.message });
      }
      return;
    }
  });

})();
