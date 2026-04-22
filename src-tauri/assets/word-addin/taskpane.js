// ── CodeForge AI — Word Add-in (Full) ─────────────────────────────────────────
const HUB_URL      = "ws://127.0.0.1:7471";
const RECONNECT_MS = 3000;

let ws             = null;
let isConnected    = false;
let isStreaming    = false;
let currentAiEl   = null;
let currentMode   = "ask";
let pendingRewrite = null;

// ── DOM helpers ───────────────────────────────────────────────────────────────
const $id  = id  => document.getElementById(id);
const $chat     = () => $id("chat");
const $question = () => $id("question");
const $askBtn   = () => $id("askBtn");
const $subHint  = () => $id("subHint");
const $empty    = () => $id("emptyState");

// ── TAB SWITCHING ─────────────────────────────────────────────────────────────
function setMode(m) {
  currentMode = m;

  // Tab active state
  ["ask","rewrite","format","templates"].forEach(t => {
    const tab = $id("tab" + t.charAt(0).toUpperCase() + t.slice(1));
    if (tab) tab.classList.toggle("active", t === m);
  });

  // Panel visibility
  const chat        = $id("chat");
  const quickBar    = $id("quickBar");
  const inputArea   = $id("inputArea");
  const formatPanel = $id("formatPanel");
  const tmplPanel   = $id("tmplPanel");

  const isChat = m === "ask" || m === "rewrite";
  if (chat)        chat.style.display        = isChat ? "flex" : "none";
  if (quickBar)    quickBar.style.display    = isChat ? "flex" : "none";
  if (inputArea)   inputArea.style.display   = isChat ? "block" : "none";
  if (formatPanel) formatPanel.style.display = m === "format"    ? "flex" : "none";
  if (tmplPanel)   tmplPanel.style.display   = m === "templates" ? "flex" : "none";

  // Update ask button label & placeholders
  if ($askBtn()) $askBtn().textContent = m === "rewrite" ? "Rewrite" : "Ask";
  if ($question()) {
    $question().placeholder = m === "ask"
      ? "Ask about your document or selected text…"
      : "Describe how to rewrite the selected text…";
  }

  // Empty state labels
  const icon  = $id("emptyIcon");
  const title = $id("emptyTitle");
  const sub   = $id("emptySub");
  if (icon && title && sub) {
    if (m === "ask") {
      icon.textContent  = "📄";
      title.textContent = "Ask about your document";
      sub.textContent   = "Select text or ask about the full document.";
    } else {
      icon.textContent  = "✏️";
      title.textContent = "Rewrite selected text";
      sub.textContent   = "Select text in Word, then describe changes.";
    }
  }
  updateAskBtn();
}

// ── CONNECTION STATUS ─────────────────────────────────────────────────────────
function setConnected(v) {
  isConnected = v;
  const dot = $id("statusDot"), txt = $id("statusText");
  if (dot) dot.className = "status-dot" + (v ? " connected" : "");
  if (txt) txt.textContent = v ? "Connected" : "Disconnected";
  updateAskBtn();
}

function updateAskBtn() {
  const btn = $askBtn(), hint = $subHint(), q = $question();
  if (!btn) return;
  const hasText = q ? q.value.trim().length > 0 : false;
  btn.disabled = !isConnected || isStreaming || !hasText;
  if (!hint) return;
  if (!isConnected)               hint.textContent = "⚠️ Open CodeForge app first";
  else if (isStreaming)           hint.textContent = "Working…";
  else if (currentMode === "ask") hint.textContent = "Select text or ask about full document";
  else                            hint.textContent = "Select text in Word first";
}

// ── CHAT RENDERING ────────────────────────────────────────────────────────────
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
    if (currentMode === "rewrite") {
      const text = currentAiEl.textContent.trim();
      if (text) {
        pendingRewrite = text;
        const wrap = document.createElement("div");
        wrap.className = "action-btns";
        const replBtn = document.createElement("button");
        replBtn.className   = "replace-btn";
        replBtn.textContent = "⬆ Replace in Word";
        replBtn.addEventListener("click", insertRewrite);
        const insBtn = document.createElement("button");
        insBtn.className   = "insert-btn";
        insBtn.textContent = "⬇ Insert Below";
        insBtn.addEventListener("click", insertBelow);
        wrap.appendChild(replBtn);
        wrap.appendChild(insBtn);
        currentAiEl.appendChild(wrap);
      }
    }
    currentAiEl = null;
  }
  isStreaming = false;
  updateAskBtn();
}

// ── INSERT INTO WORD ──────────────────────────────────────────────────────────
async function insertRewrite() {
  if (!pendingRewrite) return;
  const text = pendingRewrite;
  try {
    await Word.run(async ctx => {
      const sel = ctx.document.getSelection();
      sel.insertText(text, "Replace");
      await ctx.sync();
      addMessage("✅ Text replaced in Word", "status-msg");
    });
  } catch (e) { addMessage("⚠️ " + e.message, "error"); }
}

async function insertBelow() {
  if (!pendingRewrite) return;
  const text = pendingRewrite;
  try {
    await Word.run(async ctx => {
      const sel = ctx.document.getSelection();
      sel.insertParagraph(text, "After");
      await ctx.sync();
      addMessage("✅ Inserted below selection", "status-msg");
    });
  } catch (e) { addMessage("⚠️ " + e.message, "error"); }
}

// ── QUICK ACTIONS ─────────────────────────────────────────────────────────────
async function quickAction(type) {
  if (!isConnected || isStreaming) return;
  const prompts = {
    grammar:   "Fix all grammar, spelling and punctuation errors. Return only the corrected text.",
    summarize: "Write a concise summary of this text in 3-5 bullet points.",
    bullets:   "Convert this text into clear, well-structured bullet points.",
    formal:    "Rewrite this text in a formal, professional tone.",
    concise:   "Make this text more concise. Remove filler words. Keep all key information."
  };
  const instruction = prompts[type];
  if (!instruction) return;

  try {
    await Word.run(async ctx => {
      const sel = ctx.document.getSelection();
      sel.load("text");
      await ctx.sync();
      const selectedText = sel.text.trim();
      if (!selectedText) {
        addMessage("⚠️ Select text in Word first, then use quick actions.", "error");
        return;
      }
      addMessage("⚡ " + type.charAt(0).toUpperCase() + type.slice(1) + "…", "status-msg");
      isStreaming = true;
      updateAskBtn();
      const prevMode = currentMode;
      currentMode = "rewrite"; // so finishAiMessage adds Insert button
      startAiMessage();
      ws.send(JSON.stringify({ type: "word_rewrite", instruction, selectedText, suggestedTokens: 800 }));
      currentMode = prevMode;
    });
  } catch (e) { addMessage("⚠️ " + e.message, "error"); }
}

// ── FORMAT TOOLBAR ────────────────────────────────────────────────────────────
function showFmtFeedback(msg, isError) {
  const el = $id("fmtFeedback");
  if (!el) return;
  el.className = "fmt-feedback " + (isError ? "err" : "ok");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 2500);
}

async function applyFmt(op, value) {
  try {
    await Word.run(async ctx => {
      const sel = ctx.document.getSelection();
      sel.load("paragraphs");

      if (op === "clear") {
        sel.font.bold      = false;
        sel.font.italic    = false;
        sel.font.underline = "None";
        sel.font.strikeThrough = false;
        sel.font.highlightColor = "NoColor";
        await ctx.sync();
        showFmtFeedback("✅ Formatting cleared");
        return;
      }

      if (op === "bold")      { sel.font.bold          = value; }
      if (op === "italic")    { sel.font.italic        = value; }
      if (op === "underline") { sel.font.underline     = value ? "Single" : "None"; }
      if (op === "strike")    { sel.font.strikeThrough = value; }

      if (op === "style") {
        sel.paragraphs.load("items");
        await ctx.sync();
        sel.paragraphs.items.forEach(p => { p.style = value; });
      }

      if (op === "align") {
        const alignMap = {
          left:      Word.Alignment.left,
          centered:  Word.Alignment.centered,
          right:     Word.Alignment.right,
          justified: Word.Alignment.justified
        };
        sel.paragraphs.load("items");
        await ctx.sync();
        sel.paragraphs.items.forEach(p => { p.alignment = alignMap[value] || Word.Alignment.left; });
      }

      if (op === "size") {
        if (value === "smaller") {
          sel.font.load("size");
          await ctx.sync();
          const cur = sel.font.size || 12;
          sel.font.size = Math.max(cur - 2, 6);
        } else if (value === "larger") {
          sel.font.load("size");
          await ctx.sync();
          const cur = sel.font.size || 12;
          sel.font.size = Math.min(cur + 2, 72);
        } else {
          sel.font.size = Number(value);
        }
      }

      if (op === "highlight") {
        sel.font.highlightColor = value === "None" ? "NoColor" : value;
      }

      if (op === "list") {
        sel.paragraphs.load("items");
        await ctx.sync();
        sel.paragraphs.items.forEach(p => {
          const lf = p.getOrAddListFormat();
          lf.applyNumberDefault();
          if (value === "bullet") {
            lf.applyBulletDefault();
          }
        });
      }

      await ctx.sync();
      showFmtFeedback("✅ Applied: " + op);
    });
  } catch (e) { showFmtFeedback("⚠️ " + e.message, true); }
}

// ── TEMPLATES ─────────────────────────────────────────────────────────────────
const TEMPLATES = {
  sop: {
    title: "Standard Operating Procedure",
    sections: [
      { style: "Title",     text: "Standard Operating Procedure" },
      { style: "Heading 1", text: "1. Purpose" },
      { style: "Normal",    text: "This SOP defines the process for [PROCESS NAME]. It ensures consistency, quality, and compliance across all operations." },
      { style: "Heading 1", text: "2. Scope" },
      { style: "Normal",    text: "This procedure applies to [DEPARTMENT/TEAM] and covers [SCOPE OF WORK]." },
      { style: "Heading 1", text: "3. Responsibilities" },
      { style: "Normal",    text: "• Process Owner: [NAME/ROLE]\n• Reviewer: [NAME/ROLE]\n• Approver: [NAME/ROLE]" },
      { style: "Heading 1", text: "4. Procedure" },
      { style: "Heading 2", text: "Step 1: [STEP NAME]" },
      { style: "Normal",    text: "Description of step 1. Include what, who, when, and how." },
      { style: "Heading 2", text: "Step 2: [STEP NAME]" },
      { style: "Normal",    text: "Description of step 2." },
      { style: "Heading 2", text: "Step 3: [STEP NAME]" },
      { style: "Normal",    text: "Description of step 3." },
      { style: "Heading 1", text: "5. Quality Checks" },
      { style: "Normal",    text: "• Checkpoint 1: [DESCRIPTION]\n• Checkpoint 2: [DESCRIPTION]" },
      { style: "Heading 1", text: "6. Document Control" },
      { style: "Normal",    text: "Version: 1.0 | Date: [DATE] | Approved by: [NAME]" },
    ]
  },
  exam: {
    title: "Examination Paper",
    sections: [
      { style: "Title",     text: "Examination Paper" },
      { style: "Normal",    text: "Subject: [SUBJECT] | Date: [DATE] | Total Marks: 100 | Time: 3 Hours" },
      { style: "Normal",    text: "Instructions: Attempt all questions. Write clearly. Mobile phones not allowed." },
      { style: "Heading 1", text: "Section A — Multiple Choice (20 Marks)" },
      { style: "Normal",    text: "Q1. [Question text here]\n    a) Option A\n    b) Option B\n    c) Option C\n    d) Option D" },
      { style: "Normal",    text: "Q2. [Question text here]\n    a) Option A\n    b) Option B\n    c) Option C\n    d) Option D" },
      { style: "Heading 1", text: "Section B — Short Answer (30 Marks)" },
      { style: "Normal",    text: "Q3. [Question] (5 marks)\n\nAnswer: ___________________________________________" },
      { style: "Normal",    text: "Q4. [Question] (5 marks)\n\nAnswer: ___________________________________________" },
      { style: "Heading 1", text: "Section C — Long Answer (50 Marks)" },
      { style: "Normal",    text: "Q5. [Question requiring detailed answer] (10 marks)" },
      { style: "Normal",    text: "Q6. [Question requiring detailed answer] (10 marks)" },
    ]
  },
  report: {
    title: "Business Report",
    sections: [
      { style: "Title",     text: "Business Report" },
      { style: "Normal",    text: "Prepared by: [NAME] | Department: [DEPT] | Date: [DATE]" },
      { style: "Heading 1", text: "Executive Summary" },
      { style: "Normal",    text: "Brief overview of key findings, conclusions and recommendations. This section should be readable as a standalone summary." },
      { style: "Heading 1", text: "1. Introduction" },
      { style: "Normal",    text: "Background and context for this report. State the objectives and scope." },
      { style: "Heading 1", text: "2. Findings" },
      { style: "Heading 2", text: "2.1 [Finding Category]" },
      { style: "Normal",    text: "Detailed analysis and data supporting this finding." },
      { style: "Heading 2", text: "2.2 [Finding Category]" },
      { style: "Normal",    text: "Detailed analysis and data supporting this finding." },
      { style: "Heading 1", text: "3. Recommendations" },
      { style: "Normal",    text: "• Recommendation 1: [ACTION]\n• Recommendation 2: [ACTION]\n• Recommendation 3: [ACTION]" },
      { style: "Heading 1", text: "4. Conclusion" },
      { style: "Normal",    text: "Summary of the report and next steps." },
    ]
  },
  minutes: {
    title: "Meeting Minutes",
    sections: [
      { style: "Title",     text: "Meeting Minutes" },
      { style: "Normal",    text: "Meeting: [MEETING NAME] | Date: [DATE] | Time: [TIME] | Location: [LOCATION/LINK]" },
      { style: "Heading 1", text: "Attendees" },
      { style: "Normal",    text: "• [NAME] — [ROLE]\n• [NAME] — [ROLE]\n• [NAME] — [ROLE]" },
      { style: "Heading 1", text: "Agenda" },
      { style: "Normal",    text: "1. [Agenda Item 1]\n2. [Agenda Item 2]\n3. [Agenda Item 3]" },
      { style: "Heading 1", text: "Discussion" },
      { style: "Heading 2", text: "1. [Agenda Item 1]" },
      { style: "Normal",    text: "Summary of discussion. Key points raised by attendees." },
      { style: "Heading 2", text: "2. [Agenda Item 2]" },
      { style: "Normal",    text: "Summary of discussion." },
      { style: "Heading 1", text: "Decisions Made" },
      { style: "Normal",    text: "• Decision 1: [DECISION]\n• Decision 2: [DECISION]" },
      { style: "Heading 1", text: "Action Items" },
      { style: "Normal",    text: "• [ACTION] — Owner: [NAME] — Due: [DATE]\n• [ACTION] — Owner: [NAME] — Due: [DATE]" },
      { style: "Heading 1", text: "Next Meeting" },
      { style: "Normal",    text: "Date: [DATE] | Time: [TIME] | Agenda: [TOPICS]" },
    ]
  },
  proposal: {
    title: "Project Proposal",
    sections: [
      { style: "Title",     text: "Project Proposal" },
      { style: "Normal",    text: "Project: [PROJECT NAME] | Prepared by: [NAME] | Date: [DATE]" },
      { style: "Heading 1", text: "1. Project Overview" },
      { style: "Normal",    text: "Brief description of the project, its purpose and expected outcomes." },
      { style: "Heading 1", text: "2. Objectives" },
      { style: "Normal",    text: "• Objective 1: [SPECIFIC GOAL]\n• Objective 2: [SPECIFIC GOAL]\n• Objective 3: [SPECIFIC GOAL]" },
      { style: "Heading 1", text: "3. Scope" },
      { style: "Normal",    text: "What is included and excluded from this project." },
      { style: "Heading 1", text: "4. Timeline" },
      { style: "Normal",    text: "Phase 1: [PHASE NAME] — [START DATE] to [END DATE]\nPhase 2: [PHASE NAME] — [START DATE] to [END DATE]\nPhase 3: [PHASE NAME] — [START DATE] to [END DATE]" },
      { style: "Heading 1", text: "5. Budget" },
      { style: "Normal",    text: "Total Estimated Budget: ₹[AMOUNT]\n• [COST ITEM]: ₹[AMOUNT]\n• [COST ITEM]: ₹[AMOUNT]" },
      { style: "Heading 1", text: "6. Team" },
      { style: "Normal",    text: "• Project Manager: [NAME]\n• [ROLE]: [NAME]\n• [ROLE]: [NAME]" },
      { style: "Heading 1", text: "7. Risks & Mitigation" },
      { style: "Normal",    text: "• Risk 1: [DESCRIPTION] — Mitigation: [ACTION]\n• Risk 2: [DESCRIPTION] — Mitigation: [ACTION]" },
    ]
  },
  letter: {
    title: "Business Letter",
    sections: [
      { style: "Normal",    text: "[YOUR NAME / COMPANY NAME]" },
      { style: "Normal",    text: "[ADDRESS LINE 1]\n[ADDRESS LINE 2]\n[CITY, STATE, PIN]" },
      { style: "Normal",    text: "Date: [DATE]" },
      { style: "Normal",    text: "To,\n[RECIPIENT NAME]\n[DESIGNATION]\n[COMPANY NAME]\n[ADDRESS]" },
      { style: "Normal",    text: "Subject: [SUBJECT OF THE LETTER]" },
      { style: "Normal",    text: "Dear [NAME/Sir/Madam]," },
      { style: "Normal",    text: "[Opening paragraph — state the purpose of the letter clearly and concisely.]" },
      { style: "Normal",    text: "[Body paragraph — provide details, context, or supporting information.]" },
      { style: "Normal",    text: "[Closing paragraph — state what action you expect or are taking next.]" },
      { style: "Normal",    text: "Thanking you,\nYours sincerely,\n\n[YOUR NAME]\n[DESIGNATION]\n[CONTACT DETAILS]" },
    ]
  },
  jd: {
    title: "Job Description",
    sections: [
      { style: "Title",     text: "[JOB TITLE]" },
      { style: "Normal",    text: "Department: [DEPT] | Location: [LOCATION] | Type: Full-time | Experience: [X] years" },
      { style: "Heading 1", text: "About the Role" },
      { style: "Normal",    text: "We are looking for a [JOB TITLE] to join our team. In this role, you will [BRIEF DESCRIPTION OF ROLE]." },
      { style: "Heading 1", text: "Key Responsibilities" },
      { style: "Normal",    text: "• [RESPONSIBILITY 1]\n• [RESPONSIBILITY 2]\n• [RESPONSIBILITY 3]\n• [RESPONSIBILITY 4]\n• [RESPONSIBILITY 5]" },
      { style: "Heading 1", text: "Required Qualifications" },
      { style: "Normal",    text: "• [QUALIFICATION 1]\n• [QUALIFICATION 2]\n• [QUALIFICATION 3]" },
      { style: "Heading 1", text: "Preferred Skills" },
      { style: "Normal",    text: "• [SKILL 1]\n• [SKILL 2]\n• [SKILL 3]" },
      { style: "Heading 1", text: "What We Offer" },
      { style: "Normal",    text: "• Competitive salary: ₹[RANGE]\n• [BENEFIT 1]\n• [BENEFIT 2]\n• [BENEFIT 3]" },
    ]
  },
  risk: {
    title: "Risk Assessment",
    sections: [
      { style: "Title",     text: "Risk Assessment Report" },
      { style: "Normal",    text: "Project/Process: [NAME] | Assessed by: [NAME] | Date: [DATE]" },
      { style: "Heading 1", text: "1. Scope of Assessment" },
      { style: "Normal",    text: "This risk assessment covers [SCOPE]. It identifies potential risks and outlines mitigation strategies." },
      { style: "Heading 1", text: "2. Risk Register" },
      { style: "Normal",    text: "Risk 1: [RISK DESCRIPTION]\n  Likelihood: High/Medium/Low\n  Impact: High/Medium/Low\n  Owner: [NAME]\n  Mitigation: [ACTION]" },
      { style: "Normal",    text: "Risk 2: [RISK DESCRIPTION]\n  Likelihood: High/Medium/Low\n  Impact: High/Medium/Low\n  Owner: [NAME]\n  Mitigation: [ACTION]" },
      { style: "Normal",    text: "Risk 3: [RISK DESCRIPTION]\n  Likelihood: High/Medium/Low\n  Impact: High/Medium/Low\n  Owner: [NAME]\n  Mitigation: [ACTION]" },
      { style: "Heading 1", text: "3. Overall Risk Rating" },
      { style: "Normal",    text: "Overall Risk Level: [HIGH / MEDIUM / LOW]\nJustification: [EXPLANATION]" },
      { style: "Heading 1", text: "4. Review Date" },
      { style: "Normal",    text: "This assessment will be reviewed on: [DATE]" },
    ]
  },
  action: {
    title: "Action Plan",
    sections: [
      { style: "Title",     text: "Action Plan" },
      { style: "Normal",    text: "Goal: [GOAL DESCRIPTION] | Owner: [NAME] | Period: [START] to [END]" },
      { style: "Heading 1", text: "Objective" },
      { style: "Normal",    text: "Clearly state what you want to achieve and by when." },
      { style: "Heading 1", text: "Actions" },
      { style: "Heading 2", text: "Priority 1 Actions" },
      { style: "Normal",    text: "• [ACTION] — Owner: [NAME] — Due: [DATE] — Status: Pending\n• [ACTION] — Owner: [NAME] — Due: [DATE] — Status: Pending" },
      { style: "Heading 2", text: "Priority 2 Actions" },
      { style: "Normal",    text: "• [ACTION] — Owner: [NAME] — Due: [DATE] — Status: Pending\n• [ACTION] — Owner: [NAME] — Due: [DATE] — Status: Pending" },
      { style: "Heading 1", text: "Success Metrics" },
      { style: "Normal",    text: "• Metric 1: [HOW YOU MEASURE SUCCESS]\n• Metric 2: [HOW YOU MEASURE SUCCESS]" },
      { style: "Heading 1", text: "Review Schedule" },
      { style: "Normal",    text: "Weekly review every [DAY] at [TIME]. Next review: [DATE]" },
    ]
  },
  status: {
    title: "Status Report",
    sections: [
      { style: "Title",     text: "Project Status Report" },
      { style: "Normal",    text: "Project: [NAME] | Report Date: [DATE] | Reporting Period: [PERIOD] | Status: 🟢 On Track" },
      { style: "Heading 1", text: "Overall Health" },
      { style: "Normal",    text: "🟢 Schedule: On Track\n🟢 Budget: On Track\n🟡 Scope: Minor changes\n🟢 Quality: Meets standards" },
      { style: "Heading 1", text: "Accomplishments This Period" },
      { style: "Normal",    text: "• [COMPLETED TASK 1]\n• [COMPLETED TASK 2]\n• [COMPLETED TASK 3]" },
      { style: "Heading 1", text: "Planned for Next Period" },
      { style: "Normal",    text: "• [PLANNED TASK 1]\n• [PLANNED TASK 2]\n• [PLANNED TASK 3]" },
      { style: "Heading 1", text: "Issues & Risks" },
      { style: "Normal",    text: "• [ISSUE/RISK 1] — Action: [ACTION TAKEN]\n• [ISSUE/RISK 2] — Action: [ACTION TAKEN]" },
      { style: "Heading 1", text: "Budget Summary" },
      { style: "Normal",    text: "Budget: ₹[TOTAL] | Spent: ₹[SPENT] | Remaining: ₹[REMAINING] | Forecast: ₹[FORECAST]" },
      { style: "Heading 1", text: "Decisions Needed" },
      { style: "Normal",    text: "• [DECISION REQUIRED FROM STAKEHOLDERS]" },
    ]
  }
};

async function insertTemplate(key) {
  const tmpl = TEMPLATES[key];
  if (!tmpl) return;

  // Show loading state on card
  const statusEl = $id("tmplStatus");
  if (statusEl) {
    statusEl.className   = "tmpl-status info";
    statusEl.textContent = "⏳ Inserting " + tmpl.title + "…";
    statusEl.style.display = "block";
  }

  try {
    await Word.run(async ctx => {
      const body = ctx.document.body;
      // Insert a page break first if document already has content
      body.load("text");
      await ctx.sync();
      if (body.text.trim().length > 0) {
        body.insertBreak(Word.BreakType.page, "End");
      }
      // Insert each section
      for (const section of tmpl.sections) {
        const para = body.insertParagraph(section.text, "End");
        try { para.style = section.style; } catch {}
        if (section.style === "Title") { para.font.size = 22; para.font.bold = true; }
      }
      await ctx.sync();
    });
    if (statusEl) {
      statusEl.className   = "tmpl-status ok";
      statusEl.textContent = "✅ " + tmpl.title + " inserted!";
      setTimeout(() => { statusEl.style.display = "none"; }, 3000);
    }
  } catch (e) {
    if (statusEl) {
      statusEl.className   = "tmpl-status err";
      statusEl.textContent = "⚠️ " + e.message;
    }
  }
}

// ── WEBSOCKET ─────────────────────────────────────────────────────────────────
function connect() {
  try { ws = new WebSocket(HUB_URL); } catch { setTimeout(connect, RECONNECT_MS); return; }
  ws.onopen    = () => { ws.send(JSON.stringify({ type: "hello", editor: "word" })); setConnected(true); };
  ws.onmessage = ev => {
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

// ── ASK ───────────────────────────────────────────────────────────────────────
async function askQuestion() {
  const question = $question().value.trim();
  if (!question || !isConnected || isStreaming) return;
  try {
    await Word.run(async ctx => {
      const sel = ctx.document.getSelection();
      sel.load("text");
      await ctx.sync();
      let docText = sel.text.trim(), label = "Selected text";
      if (!docText) {
        const body = ctx.document.body; body.load("text"); await ctx.sync();
        docText = body.text.trim().slice(0, 4000); label = "Full document";
      }
      addMessage(label + " · " + docText.length + " chars", "status-msg");
      addMessage(question, "user");
      $question().value = ""; updateAskBtn();
      isStreaming = true; updateAskBtn(); startAiMessage();
      ws.send(JSON.stringify({ type: "word_query", question, docText, contextLabel: label, suggestedTokens: 800 }));
    });
  } catch (e) { isStreaming = false; updateAskBtn(); addMessage("⚠️ " + e.message, "error"); }
}

// ── REWRITE ───────────────────────────────────────────────────────────────────
async function askRewrite() {
  const instruction = $question().value.trim();
  if (!instruction || !isConnected || isStreaming) return;
  try {
    await Word.run(async ctx => {
      const sel = ctx.document.getSelection(); sel.load("text"); await ctx.sync();
      const selectedText = sel.text.trim();
      if (!selectedText) { addMessage("⚠️ Select text in Word first.", "error"); return; }
      addMessage("✏️ Rewriting " + selectedText.length + " chars…", "status-msg");
      addMessage(instruction, "user");
      $question().value = ""; updateAskBtn();
      isStreaming = true; updateAskBtn(); startAiMessage();
      ws.send(JSON.stringify({ type: "word_rewrite", instruction, selectedText, suggestedTokens: 1000 }));
    });
  } catch (e) { isStreaming = false; updateAskBtn(); addMessage("⚠️ " + e.message, "error"); }
}

async function ask() { currentMode === "rewrite" ? askRewrite() : askQuestion(); }
function handleKey(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }
function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 90) + "px";
  updateAskBtn();
}

// ── INIT ──────────────────────────────────────────────────────────────────────
Office.onReady(() => {
  connect();
  const q = $question();
  if (q) {
    q.addEventListener("input",   () => { autoResize(q); updateAskBtn(); });
    q.addEventListener("keydown", handleKey);
  }
  const askB = $askBtn();
  if (askB) askB.addEventListener("click", ask);

  // Wire up tab buttons
  ["ask","rewrite","format","templates"].forEach(m => {
    const btn = $id("tab" + m.charAt(0).toUpperCase() + m.slice(1));
    if (btn) btn.addEventListener("click", () => setMode(m));
  });

  // Wire up quick action buttons
  document.querySelectorAll(".qa-btn[data-action]").forEach(btn => {
    btn.addEventListener("click", () => quickAction(btn.dataset.action));
  });

  // Wire up format buttons
  document.querySelectorAll(".fmt-btn[data-op]").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.val;
      applyFmt(btn.dataset.op, val !== undefined ? (val === "true" ? true : val === "false" ? false : isNaN(val) ? val : Number(val)) : undefined);
    });
  });

  // Wire up template cards
  document.querySelectorAll(".tmpl-card[data-tmpl]").forEach(card => {
    card.addEventListener("click", () => insertTemplate(card.dataset.tmpl));
  });

  // Wire up context toggle
  const ctxToggle = $id("ctxToggle");
  if (ctxToggle) ctxToggle.addEventListener("click", () => {
    ctxToggle.classList.toggle("active");
  });

  // Clear log button
  const clearLog = $id("clearLog");
  if (clearLog) clearLog.addEventListener("click", () => {
    const chat = $chat();
    if (chat) chat.innerHTML = "";
  });

  setMode("ask");
});
