// ── CodeForge AI — Background Service Worker ─────────────────────────────────

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// ── Schedule Alarms ────────────────────────────────────────────────────────
// When a workflow has a schedule trigger, we create a chrome.alarm for it.
// Alarm name format: "cf_alarm_<workflowId>"

const STORE_KEY = "cf_workflows";

// Sync alarms with current workflow triggers
async function syncAlarms() {
  const result = await chrome.storage.local.get([STORE_KEY]);
  const workflows = result[STORE_KEY] || [];

  // Clear all existing cf_ alarms
  const existing = await chrome.alarms.getAll();
  for (const alarm of existing) {
    if (alarm.name.startsWith("cf_alarm_")) {
      await chrome.alarms.clear(alarm.name);
    }
  }

  // Re-create alarms for workflows with schedule triggers
  for (const wf of workflows) {
    const t = wf.trigger;
    if (!t || t.type !== "schedule" || !t.enabled || !t.scheduleMinutes) continue;
    chrome.alarms.create("cf_alarm_" + wf.id, {
      periodInMinutes: Number(t.scheduleMinutes)
    });
  }
}

// When an alarm fires → find the active tab and inject the run command
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith("cf_alarm_")) return;
  const workflowId = alarm.name.replace("cf_alarm_", "");

  // Find the active tab
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "ALARM_RUN_WORKFLOW", workflowId });
  } catch {
    // Content script not injected yet — inject then send
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["automation-recorder.js"]
      });
      await chrome.tabs.sendMessage(tab.id, { type: "ALARM_RUN_WORKFLOW", workflowId });
    } catch {}
  }
});

// Sync alarms whenever storage changes (new workflow saved / trigger updated)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORE_KEY]) {
    syncAlarms();
  }
});

// ── Message routing ────────────────────────────────────────────────────────
// When content script fires TRIGGER_RUN_WORKFLOW, route it to
// the automation panel in the sidepanel (for logging) AND execute it.
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "TRIGGER_RUN_WORKFLOW") {
    const result = await chrome.storage.local.get([STORE_KEY]);
    const workflows = result[STORE_KEY] || [];
    const wf = workflows.find(w => w.id === msg.workflowId);
    if (!wf || !sender.tab?.id) return;

    // Run it on the sender tab
    try {
      await chrome.tabs.sendMessage(sender.tab.id, {
        type:       "START_RUN",
        workflow:   wf,
        alwaysSkip: []
      });
    } catch {}

    // Update lastRun
    wf.lastRun = Date.now();
    await chrome.storage.local.set({ [STORE_KEY]: workflows });

    // Notify sidepanel
    chrome.runtime.sendMessage({ type: "AUTO_RUN_STARTED", workflowId: wf.id, name: wf.name }).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }
});

// Init alarms on service worker startup
syncAlarms();
