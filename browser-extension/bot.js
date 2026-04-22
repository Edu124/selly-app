// ── CodeForge Automation Bot Widget ──────────────────────────────────────────
// Injects a floating bot bubble into any page.
// Communicates with automation-recorder.js via window.postMessage (BOT_* channel).
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  function init() {
    if (document.getElementById('__cfbot_host')) return;
    if (!document.body) { document.addEventListener('DOMContentLoaded', init); return; }

    // ── Shadow DOM host ───────────────────────────────────────────────────────
    const host = document.createElement('div');
    host.id = '__cfbot_host';
    host.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;font-family:sans-serif;';
    document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // ── Styles ──────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    *{box-sizing:border-box;margin:0;padding:0}
    :host{}

    /* Bubble */
    #bubble{
      width:52px;height:52px;border-radius:50%;background:#6c47ff;
      border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 16px rgba(108,71,255,.45);transition:transform .15s;
    }
    #bubble:hover{transform:scale(1.08)}
    #bubble svg{width:26px;height:26px;fill:#fff}

    /* Panel */
    #panel{
      display:none;width:300px;background:#1a1a2e;border-radius:14px;
      box-shadow:0 8px 32px rgba(0,0,0,.55);overflow:hidden;
      border:1px solid rgba(108,71,255,.35);
      position:absolute;bottom:62px;right:0;
    }
    #panel.open{display:block}

    .p-head{
      background:linear-gradient(135deg,#6c47ff,#a78bfa);
      padding:12px 14px;display:flex;align-items:center;gap:8px;
    }
    .p-head svg{width:18px;height:18px;fill:#fff;flex-shrink:0}
    .p-head span{color:#fff;font-size:14px;font-weight:600;flex:1}
    .p-close{background:none;border:none;color:#fff;opacity:.7;cursor:pointer;
      font-size:18px;line-height:1;padding:0 2px}
    .p-close:hover{opacity:1}

    .p-body{padding:14px}

    /* Workflow selector */
    .wf-label{color:#a0a0c0;font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
    .wf-select{
      width:100%;background:#0d0d1a;color:#e0e0ff;border:1px solid #3a3a5c;
      border-radius:7px;padding:7px 10px;font-size:13px;cursor:pointer;outline:none;
    }
    .wf-select option{background:#0d0d1a}

    .divider{height:1px;background:#2a2a4a;margin:12px 0}

    /* How to run */
    .run-label{color:#a0a0c0;font-size:11px;text-transform:uppercase;
      letter-spacing:.06em;margin-bottom:8px}
    .run-modes{display:flex;flex-direction:column;gap:6px}
    .mode-btn{
      background:#0d0d1a;border:1.5px solid #3a3a5c;border-radius:8px;
      color:#c0c0e0;font-size:12.5px;padding:9px 12px;cursor:pointer;
      text-align:left;display:flex;align-items:center;gap:8px;transition:all .15s;
    }
    .mode-btn:hover{border-color:#6c47ff;color:#e0e0ff;background:#12122a}
    .mode-btn.active{border-color:#6c47ff;background:#1e1540;color:#fff}
    .mode-btn .icon{font-size:15px;width:20px;text-align:center}
    .mode-btn .mtitle{font-weight:600;font-size:13px}
    .mode-btn .msub{font-size:11px;color:#8080a0;margin-top:1px}
    .mode-btn.active .msub{color:#a090d0}

    /* Sub-panels */
    .sub-panel{display:none;margin-top:10px;animation:fadeIn .15s ease}
    .sub-panel.show{display:block}
    @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}

    /* Schedule sub */
    .sched-row{display:flex;align-items:center;gap:8px;margin-bottom:10px}
    .sched-row label{color:#a0a0c0;font-size:12px;white-space:nowrap}
    .sched-inp{
      background:#0d0d1a;border:1px solid #3a3a5c;border-radius:6px;
      color:#e0e0ff;font-size:13px;padding:5px 8px;width:60px;outline:none;
    }
    .sched-inp:focus{border-color:#6c47ff}
    .unit-sel{
      background:#0d0d1a;border:1px solid #3a3a5c;border-radius:6px;
      color:#e0e0ff;font-size:13px;padding:5px 8px;outline:none;cursor:pointer;flex:1;
    }

    /* Custom prompt sub */
    .prompt-area{
      width:100%;background:#0d0d1a;border:1px solid #3a3a5c;border-radius:8px;
      color:#e0e0ff;font-size:12.5px;padding:9px 10px;resize:vertical;
      min-height:72px;outline:none;font-family:inherit;line-height:1.5;
    }
    .prompt-area:focus{border-color:#6c47ff}
    .prompt-hint{font-size:11px;color:#606080;margin-top:5px;line-height:1.45}

    /* Buttons */
    .btn-row{display:flex;gap:8px;margin-top:12px}
    .btn{
      flex:1;padding:9px;border-radius:8px;border:none;cursor:pointer;
      font-size:13px;font-weight:600;transition:opacity .15s;
    }
    .btn:hover{opacity:.85}
    .btn-primary{background:#6c47ff;color:#fff}
    .btn-ghost{background:#1e1e3a;color:#a0a0d0;border:1px solid #3a3a5c}
    .btn-run{background:#22c55e;color:#fff}

    /* Status */
    .status{
      font-size:12px;margin-top:10px;padding:8px 10px;border-radius:7px;
      display:none;line-height:1.4;
    }
    .status.show{display:block}
    .status.info{background:#1a2040;color:#80a0ff;border:1px solid #2a3060}
    .status.ok{background:#0d2a1a;color:#4ade80;border:1px solid #1a5a30}
    .status.err{background:#2a0d0d;color:#f87171;border:1px solid #5a1a1a}
    .status.running{background:#1a1a2e;color:#c084fc;border:1px solid #4a2a7a}

    /* Pulse dot for running */
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
    .dot{display:inline-block;width:7px;height:7px;border-radius:50%;
      background:currentColor;margin-right:5px;animation:pulse 1.2s infinite}
  `;
  shadow.appendChild(style);

  // ── HTML ────────────────────────────────────────────────────────────────────
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="panel">
      <div class="p-head">
        <svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2zM5 15v1a7 7 0 0 0 14 0v-1H5zm5 3h4v1h-4v-1z"/></svg>
        <span>Automation Bot</span>
        <button class="p-close" id="botClose">✕</button>
      </div>
      <div class="p-body">

        <div class="wf-label">Workflow</div>
        <select class="wf-select" id="wfSelect">
          <option value="">— loading... —</option>
        </select>

        <div class="divider"></div>

        <div class="run-label">How should I run this?</div>
        <div class="run-modes">

          <button class="mode-btn" data-mode="schedule">
            <span class="icon">⏰</span>
            <div>
              <div class="mtitle">On a schedule</div>
              <div class="msub">Run automatically at set intervals</div>
            </div>
          </button>

          <button class="mode-btn" data-mode="custom">
            <span class="icon">✨</span>
            <div>
              <div class="mtitle">Custom prompt</div>
              <div class="msub">Describe what to do — AI figures it out</div>
            </div>
          </button>

          <button class="mode-btn" data-mode="manual">
            <span class="icon">👆</span>
            <div>
              <div class="mtitle">Manual only</div>
              <div class="msub">I'll click Run whenever I need it</div>
            </div>
          </button>

        </div>

        <!-- Schedule sub-panel -->
        <div class="sub-panel" id="subSchedule">
          <div class="sched-row">
            <label>Every</label>
            <input class="sched-inp" type="number" id="schedVal" value="30" min="1">
            <select class="unit-sel" id="schedUnit">
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
              <option value="days">days</option>
            </select>
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" id="btnSaveSchedule">Save schedule</button>
          </div>
        </div>

        <!-- Custom prompt sub-panel -->
        <div class="sub-panel" id="subCustom">
          <textarea class="prompt-area" id="customPrompt"
            placeholder="e.g. Search for the latest invoice and download it as PDF"></textarea>
          <div class="prompt-hint">AI will interpret your request and run the matching steps.</div>
          <div class="btn-row">
            <button class="btn btn-primary" id="btnRunCustom">▶ Run with AI</button>
          </div>
        </div>

        <!-- Manual sub-panel -->
        <div class="sub-panel" id="subManual">
          <div class="btn-row">
            <button class="btn btn-run" id="btnRunNow">▶ Run Now</button>
          </div>
        </div>

        <div class="status" id="botStatus"></div>

      </div>
    </div>

    <button id="bubble" title="Automation Bot">
      <svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7H3a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 10 4a2 2 0 0 1 2-2zM5 15v1a7 7 0 0 0 14 0v-1H5zm5 3h4v1h-4v-1z"/></svg>
    </button>
  `;
  shadow.appendChild(wrap);

  // ── State ───────────────────────────────────────────────────────────────────
  let workflows = [];
  let currentMode = null;   // 'schedule' | 'custom' | 'manual'
  let isRunning   = false;

  // ── DOM refs ────────────────────────────────────────────────────────────────
  const panel        = shadow.getElementById('panel');
  const bubble       = shadow.getElementById('bubble');
  const botClose     = shadow.getElementById('botClose');
  const wfSelect     = shadow.getElementById('wfSelect');
  const schedVal     = shadow.getElementById('schedVal');
  const schedUnit    = shadow.getElementById('schedUnit');
  const customPrompt = shadow.getElementById('customPrompt');
  const botStatus    = shadow.getElementById('botStatus');

  const subPanels = {
    schedule : shadow.getElementById('subSchedule'),
    custom   : shadow.getElementById('subCustom'),
    manual   : shadow.getElementById('subManual'),
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function setStatus(msg, type = 'info') {
    botStatus.className = `status show ${type}`;
    botStatus.innerHTML = (type === 'running' ? '<span class="dot"></span>' : '') + msg;
  }
  function clearStatus() {
    botStatus.className = 'status';
    botStatus.textContent = '';
  }

  function showSub(mode) {
    Object.entries(subPanels).forEach(([k, el]) => {
      el.classList.toggle('show', k === mode);
    });
  }

  function selectMode(mode) {
    currentMode = mode;
    shadow.querySelectorAll('.mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    showSub(mode);
    clearStatus();
    saveBotState();
  }

  function getSelectedWorkflow() {
    return workflows.find(w => w.id === wfSelect.value) || null;
  }

  // ── Persist bot UI state per workflow ───────────────────────────────────────
  const BOT_STATE_KEY = '__cfbot_state';

  function saveBotState() {
    const wfId = wfSelect.value;
    if (!wfId) return;
    const state = JSON.parse(localStorage.getItem(BOT_STATE_KEY) || '{}');
    state[wfId] = {
      mode      : currentMode,
      schedVal  : schedVal.value,
      schedUnit : schedUnit.value,
    };
    localStorage.setItem(BOT_STATE_KEY, JSON.stringify(state));
  }

  function loadBotState(wfId) {
    const state = JSON.parse(localStorage.getItem(BOT_STATE_KEY) || '{}');
    const s = state[wfId];
    if (!s) return;
    if (s.mode) selectMode(s.mode);
    if (s.schedVal)  schedVal.value  = s.schedVal;
    if (s.schedUnit) schedUnit.value = s.schedUnit;
  }

  // ── Communication with automation-recorder.js ───────────────────────────────
  // recorder listens for window messages with channel = 'CFBOT_OUT'
  // recorder posts back with channel = 'CFBOT_IN'

  function sendToRecorder(payload) {
    window.postMessage({ channel: 'CFBOT_OUT', ...payload }, '*');
  }

  window.addEventListener('message', (e) => {
    if (!e.data || e.data.channel !== 'CFBOT_IN') return;
    const msg = e.data;

    if (msg.type === 'BOT_WORKFLOWS') {
      workflows = msg.workflows || [];
      wfSelect.innerHTML = workflows.length
        ? workflows.map(w =>
            `<option value="${w.id}">${escHtml(w.name)} (${w.steps?.length || 0} steps)</option>`
          ).join('')
        : '<option value="">— no workflows recorded —</option>';

      // Restore saved state for first workflow
      if (workflows.length) loadBotState(wfSelect.value);
    }

    if (msg.type === 'BOT_RUN_STEP') {
      setStatus(`Running: ${escHtml(msg.label || 'step ' + msg.index)}`, 'running');
    }

    if (msg.type === 'BOT_RUN_COMPLETE') {
      isRunning = false;
      if (msg.success) setStatus('✓ Done! All steps completed.', 'ok');
      else             setStatus('⚠ ' + (msg.error || 'Run failed'), 'err');
    }

    if (msg.type === 'BOT_CUSTOM_DONE') {
      isRunning = false;
      if (msg.success) setStatus('✓ AI completed the task.', 'ok');
      else             setStatus('⚠ ' + (msg.error || 'AI could not complete task'), 'err');
    }
  });

  // ── Fetch workflows on open ──────────────────────────────────────────────────
  function fetchWorkflows() {
    sendToRecorder({ type: 'BOT_GET_WORKFLOWS' });
  }

  // ── Panel open / close ───────────────────────────────────────────────────────
  bubble.addEventListener('click', () => {
    const open = panel.classList.toggle('open');
    if (open) fetchWorkflows();
  });

  botClose.addEventListener('click', () => panel.classList.remove('open'));

  // ── Workflow change ──────────────────────────────────────────────────────────
  wfSelect.addEventListener('change', () => {
    currentMode = null;
    shadow.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    Object.values(subPanels).forEach(el => el.classList.remove('show'));
    clearStatus();
    loadBotState(wfSelect.value);
  });

  // ── Mode buttons ─────────────────────────────────────────────────────────────
  shadow.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => selectMode(btn.dataset.mode));
  });

  // ── Save schedule ─────────────────────────────────────────────────────────────
  shadow.getElementById('btnSaveSchedule').addEventListener('click', () => {
    const wf = getSelectedWorkflow();
    if (!wf) return setStatus('Select a workflow first.', 'err');

    const val  = parseInt(schedVal.value, 10);
    const unit = schedUnit.value;
    if (!val || val < 1) return setStatus('Enter a valid interval.', 'err');

    const minutes = unit === 'hours' ? val * 60 : unit === 'days' ? val * 1440 : val;

    sendToRecorder({ type: 'BOT_SAVE_SCHEDULE', workflowId: wf.id, scheduleMinutes: minutes });
    saveBotState();
    setStatus(`⏰ Scheduled every ${val} ${unit}.`, 'ok');
  });

  // ── Run with AI (custom prompt) ──────────────────────────────────────────────
  shadow.getElementById('btnRunCustom').addEventListener('click', () => {
    if (isRunning) return;
    const wf     = getSelectedWorkflow();
    const prompt = customPrompt.value.trim();
    if (!prompt) return setStatus('Enter a description first.', 'err');

    isRunning = true;
    setStatus('Sending to AI…', 'running');
    sendToRecorder({ type: 'BOT_CUSTOM_RUN', workflowId: wf?.id || null, prompt });
  });

  // ── Run now (manual) ─────────────────────────────────────────────────────────
  shadow.getElementById('btnRunNow').addEventListener('click', () => {
    if (isRunning) return;
    const wf = getSelectedWorkflow();
    if (!wf) return setStatus('Select a workflow first.', 'err');

    isRunning = true;
    setStatus('Starting…', 'running');
    sendToRecorder({ type: 'BOT_RUN', workflowId: wf.id });
  });

  // ── Utility ──────────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }

  } // end init()

  // Run immediately or wait for body
  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);

})();
