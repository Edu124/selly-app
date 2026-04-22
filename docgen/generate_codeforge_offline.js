const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, Footer, LevelFormat,
} = require("docx");
const fs = require("fs");

// ── Colors ────────────────────────────────────────────────────────────────
const C = {
  purple     : "5B4FE8",
  purpleDark : "3D33B0",
  purpleLight: "EDEBFF",
  purpleMid  : "B5AEFF",
  white      : "FFFFFF",
  black      : "0D0D18",
  gray2      : "52526E",
  gray3      : "9090AA",
  grayBg     : "F7F6FF",
  grayLine   : "E2E0F0",
  green      : "22C55E",
  greenBg    : "ECFDF5",
  teal       : "0EA5E9",
  tealBg     : "F0F9FF",
  orange     : "F97316",
  orangeBg   : "FFF7ED",
};

const nb       = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBd     = { top: nb, bottom: nb, left: nb, right: nb };
const grayBd   = () => ({ style: BorderStyle.SINGLE, size: 1, color: C.grayLine });
const allGrayBd = { top: grayBd(), bottom: grayBd(), left: grayBd(), right: grayBd() };
const purpleBd  = () => ({ style: BorderStyle.SINGLE, size: 1, color: C.purple });
const allPurpleBd = { top: purpleBd(), bottom: purpleBd(), left: purpleBd(), right: purpleBd() };

// ── Basic elements ─────────────────────────────────────────────────────────
function sp(n) {
  return new Paragraph({ children: [], spacing: { before: 0, after: (n || 8) * 20 } });
}

function hr() {
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.grayLine, space: 1 } },
    spacing: { before: 0, after: 160 },
  });
}

function body(text, opts) {
  opts = opts || {};
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({
      text  : text,
      size  : opts.size  || 22,
      color : opts.color || C.gray2,
      bold  : opts.bold  || false,
      font  : "Arial",
    })],
    spacing: { before: 0, after: opts.after !== undefined ? opts.after : 120 },
  });
}

function bul(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    children: [new TextRun({ text: text, size: 22, color: C.gray2, font: "Arial" })],
    spacing: { before: 0, after: 60 },
  });
}

// ── Pill section label ─────────────────────────────────────────────────────
function pill(text) {
  var inner = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 17, color: C.white, font: "Arial", characterSpacing: 80 })],
    spacing: { before: 0, after: 0 },
  });
  var cell = new TableCell({
    borders: noBd,
    shading: { fill: C.purple, type: ShadingType.CLEAR },
    margins: { top: 70, bottom: 70, left: 180, right: 180 },
    children: [inner],
  });
  var row = new TableRow({ children: [cell] });
  return new Table({ width: { size: 2600, type: WidthType.DXA }, columnWidths: [2600], rows: [row] });
}

// ── Callout box ────────────────────────────────────────────────────────────
function callout(text) {
  var inner = new Paragraph({
    children: [new TextRun({ text: text, size: 22, color: C.purpleDark, font: "Arial", italics: true })],
    spacing: { before: 0, after: 0 },
  });
  var cell = new TableCell({
    borders: { top: nb, bottom: nb, right: nb, left: { style: BorderStyle.SINGLE, size: 20, color: C.purple } },
    shading: { fill: C.purpleLight, type: ShadingType.CLEAR },
    margins: { top: 160, bottom: 160, left: 240, right: 240 },
    children: [inner],
  });
  var row = new TableRow({ children: [cell] });
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360], rows: [row] });
}

// ── KPI cell ──────────────────────────────────────────────────────────────
function kpiCell(value, label, bg, tc) {
  return new TableCell({
    borders: noBd,
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 200, bottom: 200, left: 200, right: 200 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: value, bold: true, size: 44, color: tc, font: "Arial" })],
        spacing: { before: 0, after: 60 },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: label, size: 18, color: C.gray2, font: "Arial" })],
        spacing: { before: 0, after: 0 },
      }),
    ],
  });
}

// ── Feature card ──────────────────────────────────────────────────────────
function featureCard(icon, title, desc, bg) {
  bg = bg || C.grayBg;
  var iconCell = new TableCell({
    borders: noBd,
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 140, bottom: 140, left: 140, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: icon, size: 32, font: "Segoe UI Emoji" })],
      spacing: { before: 0, after: 0 },
    })],
  });
  var bodyCell = new TableCell({
    borders: noBd,
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 140, bottom: 140, left: 140, right: 200 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 23, color: C.black, font: "Arial" })],
        spacing: { before: 0, after: 40 },
      }),
      new Paragraph({
        children: [new TextRun({ text: desc, size: 20, color: C.gray2, font: "Arial" })],
        spacing: { before: 0, after: 0 },
      }),
    ],
  });
  var row = new TableRow({ children: [iconCell, bodyCell] });
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [780, 8580], rows: [row] });
}

// ── Step row ──────────────────────────────────────────────────────────────
function stepRow(num, title, desc) {
  var numCell = new TableCell({
    borders: noBd,
    shading: { fill: C.purple, type: ShadingType.CLEAR },
    margins: { top: 120, bottom: 120, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: String(num), bold: true, size: 26, color: C.white, font: "Arial" })],
      spacing: { before: 0, after: 0 },
    })],
  });
  var descCell = new TableCell({
    borders: noBd,
    margins: { top: 120, bottom: 120, left: 200, right: 180 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: title, bold: true, size: 23, color: C.black, font: "Arial" })],
        spacing: { before: 0, after: 40 },
      }),
      new Paragraph({
        children: [new TextRun({ text: desc, size: 20, color: C.gray2, font: "Arial" })],
        spacing: { before: 0, after: 0 },
      }),
    ],
  });
  var row = new TableRow({ children: [numCell, descCell] });
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [660, 8700], rows: [row] });
}

// ── Two-column grid cell ───────────────────────────────────────────────────
function gridCell(icon, title, desc, bg) {
  bg = bg || C.grayBg;
  return new TableCell({
    borders: allGrayBd,
    shading: { fill: bg, type: ShadingType.CLEAR },
    margins: { top: 140, bottom: 140, left: 160, right: 160 },
    width: { size: 4680, type: WidthType.DXA },
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: icon + "  ", size: 24, font: "Segoe UI Emoji" }),
          new TextRun({ text: title, bold: true, size: 22, color: C.black, font: "Arial" }),
        ],
        spacing: { before: 0, after: 50 },
      }),
      new Paragraph({
        children: [new TextRun({ text: desc, size: 20, color: C.gray3, font: "Arial" })],
        spacing: { before: 0, after: 0 },
      }),
    ],
  });
}

function gridRow(a, b) {
  return new TableRow({ children: [gridCell(a[0], a[1], a[2], a[3]), gridCell(b[0], b[1], b[2], b[3])] });
}

// ── Privacy grid ──────────────────────────────────────────────────────────
function privacyTable() {
  var items = [
    ["🚫", "No Internet Required",        "The AI runs fully offline. Works even without a network connection."],
    ["☁️",  "No Cloud Processing",         "Files and questions are never sent to any external server — ever."],
    ["🔑", "No Account or Login",         "No sign-up, no email, no subscription portal. Install and use immediately."],
    ["🛡️", "No Training on Your Data",    "Your inputs are never used to train any AI model, unlike cloud tools."],
    ["🔐", "Works on Locked-Down Machines","No outbound network calls. Compatible with strict corporate IT policies."],
    ["✅", "Audit-Friendly",              "IT teams can verify zero data leaves the machine — full transparency."],
  ];
  var rows = [];
  for (var i = 0; i < items.length; i += 2) {
    rows.push(new TableRow({
      children: [
        gridCell(items[i][0], items[i][1], items[i][2], C.grayBg),
        gridCell(items[i+1][0], items[i+1][1], items[i+1][2], C.grayBg),
      ],
    }));
  }
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [4680, 4680], rows: rows });
}

// ── Audience grid ─────────────────────────────────────────────────────────
function audienceTable() {
  var items = [
    ["📊", "Finance & Accounting",      "Analyse models, run valuations, generate formulas — no client data exposure."],
    ["⚖️",  "Legal & Compliance",        "Summarise contracts, draft clauses, review documents with full data privacy."],
    ["💻", "Software Developers",       "AI coding in VS Code with no proprietary code leaving your environment."],
    ["🏥", "Healthcare Professionals",  "Process patient documents while meeting strict data protection regulations."],
    ["🏢", "Enterprise IT Teams",       "Deploy org-wide AI with zero risk of unauthorised data sharing."],
    ["📈", "Business Analysts",         "Work with sensitive Excel and PowerPoint data — AI insights, no compliance risk."],
  ];
  var rows = [];
  for (var i = 0; i < items.length; i += 2) {
    rows.push(new TableRow({
      children: [
        gridCell(items[i][0], items[i][1], items[i][2], C.purpleLight),
        gridCell(items[i+1][0], items[i+1][1], items[i+1][2], C.purpleLight),
      ],
    }));
  }
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [4680, 4680], rows: rows });
}

// ── Capabilities grid ─────────────────────────────────────────────────────
function capabilitiesTable() {
  var pairs = [
    [["📊", "Analyse Excel Data",        "Ask about any selected cells, spot trends, get plain-English summaries"],
     ["✍️",  "Rewrite & Improve Text",    "Select any Word text — AI improves clarity, tone, or length instantly"]],
    [["🔢", "Generate Formulas",         "Describe what you need, AI writes the exact Excel formula for you"],
     ["📋", "Summarise Documents",       "Get concise summaries of long Word contracts or reports in seconds"]],
    [["🐛", "Fix Code Bugs",             "VS Code extension identifies and fixes bugs in your selected code"],
     ["💬", "Explain Complex Content",   "Understand financial data, code snippets, or legal language instantly"]],
    [["🔄", "Refactor Code",             "Restructure and clean up code without changing its behaviour"],
     ["📑", "Draft Slide Content",       "Generate presentation content and speaker notes in PowerPoint"]],
    [["📈", "Financial Valuation",       "Run DCF, risk analysis, and scenario modelling across linked workbooks"],
     ["🤖", "Browser Automation",        "Record and replay repetitive browser tasks with the bot extension"]],
    [["💡", "30+ Prompt Templates",      "Built-in templates for common tasks — one click to use"],
     ["🔗", "Multi-Workbook Analysis",   "Financial Analyst links multiple Excel files for cross-model AI chat"]],
  ];
  var rows = pairs.map(function(pair) {
    return new TableRow({
      children: [
        gridCell(pair[0][0], pair[0][1], pair[0][2], C.grayBg),
        gridCell(pair[1][0], pair[1][1], pair[1][2], C.grayBg),
      ],
    });
  });
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [4680, 4680], rows: rows });
}

// ── Comparison table ──────────────────────────────────────────────────────
function comparisonTable() {
  var cols = [3360, 3000, 3000];
  function hCell(text, w) {
    return new TableCell({
      borders: allPurpleBd,
      shading: { fill: C.purple, type: ShadingType.CLEAR },
      margins: { top: 110, bottom: 110, left: 140, right: 140 },
      width: { size: w, type: WidthType.DXA },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: text, bold: true, size: 22, color: C.white, font: "Arial" })],
        spacing: { before: 0, after: 0 },
      })],
    });
  }
  function dCell(text, w, shade, tc, bold) {
    return new TableCell({
      borders: allGrayBd,
      shading: { fill: shade, type: ShadingType.CLEAR },
      margins: { top: 90, bottom: 90, left: 140, right: 140 },
      width: { size: w, type: WidthType.DXA },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: text, size: 21, color: tc, bold: bold || false, font: "Arial" })],
        spacing: { before: 0, after: 0 },
      })],
    });
  }
  var data = [
    ["Data Privacy",               "Sent to external servers",          "Stays on your machine — always"],
    ["Internet Required",          "Yes — always online",               "No — works fully offline"],
    ["Account / Login",            "Required + subscription",           "None — install and use"],
    ["Excel Integration",          "Copy-paste workaround",             "Native add-in sidebar"],
    ["Word Integration",           "Separate browser tab",              "Native add-in sidebar"],
    ["VS Code Integration",        "GitHub Copilot (paid add-on)",      "Included, fully offline"],
    ["Financial Analysis",         "Generic responses only",            "Dedicated multi-workbook analyst"],
    ["Data Used for Training",     "Possible (varies by plan)",         "Never — ever"],
    ["Works in Air-Gapped Network","No",                                "Yes"],
    ["GDPR / HIPAA Suitable",      "Complex / risky",                   "Full control — compliant by design"],
  ];
  var rows = [
    new TableRow({ children: [hCell("Feature", cols[0]), hCell("Cloud AI (ChatGPT / Copilot)", cols[1]), hCell("CodeForge AI", cols[2])] }),
  ];
  data.forEach(function(r, i) {
    var shade = i % 2 === 0 ? C.grayBg : C.white;
    rows.push(new TableRow({
      children: [
        dCell(r[0], cols[0], shade, C.black, true),
        dCell(r[1], cols[1], shade, C.gray3, false),
        dCell(r[2], cols[2], C.purpleLight, C.purpleDark, true),
      ],
    }));
  });
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: cols, rows: rows });
}

// ── Footer ─────────────────────────────────────────────────────────────────
function makeFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.grayLine, space: 1 } },
      spacing: { before: 100, after: 0 },
      children: [
        new TextRun({ text: "CodeForge AI  |  Confidential  |  Page ", size: 17, color: C.gray3, font: "Arial" }),
        new TextRun({ children: [PageNumber.CURRENT], size: 17, color: C.gray3, font: "Arial" }),
        new TextRun({ text: " of ", size: 17, color: C.gray3, font: "Arial" }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 17, color: C.gray3, font: "Arial" }),
      ],
    })],
  });
}

// ── CTA banner ────────────────────────────────────────────────────────────
function ctaBanner() {
  var cell = new TableCell({
    borders: noBd,
    shading: { fill: C.purple, type: ShadingType.CLEAR },
    margins: { top: 320, bottom: 320, left: 400, right: 400 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Ready to bring private AI to your team?", bold: true, size: 34, color: C.white, font: "Arial" })],
        spacing: { before: 0, after: 100 },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "All 6 extensions included. Runs on Windows. No internet required.", size: 22, color: C.purpleMid, font: "Arial" })],
        spacing: { before: 0, after: 160 },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Contact CodeForge to schedule a live demo or get your copy today.", bold: true, size: 22, color: C.white, font: "Arial" })],
        spacing: { before: 0, after: 0 },
      }),
    ],
  });
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360], rows: [new TableRow({ children: [cell] })] });
}

// ══════════════════════════════════════════════════════════════════════════
//  BUILD DOCUMENT
// ══════════════════════════════════════════════════════════════════════════
var pageProps = {
  page: {
    size: { width: 12240, height: 15840 },
    margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
  },
};

var doc = new Document({
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 600, hanging: 300 } }, run: { font: "Arial", size: 22 } },
      }],
    }],
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22, color: C.gray2 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 40, bold: true, color: C.black, font: "Arial" },
        paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: C.purple, font: "Arial" },
        paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 1 } },
    ],
  },
  sections: [

    // ── COVER ────────────────────────────────────────────────────────────
    {
      properties: pageProps,
      footers: { default: makeFooter() },
      children: [
        // Purple header banner
        new Table({
          width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360],
          rows: [new TableRow({ children: [new TableCell({
            borders: noBd,
            shading: { fill: C.purple, type: ShadingType.CLEAR },
            margins: { top: 280, bottom: 280, left: 360, right: 360 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: "CODEFORGE AI", bold: true, size: 54, color: C.white, font: "Arial", characterSpacing: 120 })],
                spacing: { before: 0, after: 60 },
              }),
              new Paragraph({
                children: [new TextRun({ text: "Private AI for Microsoft Office, VS Code & Browser  —  100% Offline", size: 22, color: C.purpleMid, font: "Arial" })],
                spacing: { before: 0, after: 0 },
              }),
            ],
          })] })],
        }),

        sp(28),
        new Paragraph({
          children: [new TextRun({ text: "Product Overview", bold: true, size: 60, color: C.black, font: "Arial" })],
          spacing: { before: 0, after: 100 },
        }),
        new Paragraph({
          children: [new TextRun({ text: "Your data never leaves your computer — ever.", size: 26, color: C.gray3, font: "Arial", italics: true })],
          spacing: { before: 0, after: 480 },
        }),

        hr(),
        sp(12),

        // KPI row
        new Table({
          width: { size: 9360, type: WidthType.DXA }, columnWidths: [2340, 2340, 2340, 2340],
          rows: [new TableRow({ children: [
            kpiCell("100%", "Offline & Private",    C.purpleLight, C.purple),
            kpiCell("6",    "Extensions Built",     C.greenBg,     C.green),
            kpiCell("30+",  "Prompt Templates",     C.tealBg,      C.teal),
            kpiCell("0",    "Data Sent to Cloud",   C.orangeBg,    C.orange),
          ] })],
        }),

        sp(20),
        hr(),
        sp(8),
        new Paragraph({
          children: [new TextRun({ text: "Prepared by CodeForge  |  Confidential  |  Version 0.5.0", size: 18, color: C.gray3, font: "Arial" })],
          spacing: { before: 0, after: 0 },
        }),
      ],
    },

    // ── CONTENT ──────────────────────────────────────────────────────────
    {
      properties: pageProps,
      footers: { default: makeFooter() },
      children: [

        // 1 — THE PROBLEM
        pill("The Problem"),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Your team uses AI — but at what cost?", bold: true, size: 40, color: C.black, font: "Arial" })], spacing: { before: 320, after: 120 } }),
        body("Every time an employee types a question into ChatGPT, Copilot, or any cloud AI tool, your data travels to an external server. This means:", { after: 160 }),
        bul("Client files, contracts, and financial models are uploaded to third-party servers"),
        bul("Sensitive spreadsheet data is processed outside your organisation"),
        bul("You have no control over how that data is stored or used for model training"),
        bul("Many industries — finance, legal, healthcare — cannot legally use cloud AI tools"),
        bul("Monthly per-user costs add up with no guarantee of data privacy"),
        sp(10),
        callout("A single accidental upload of a confidential Excel model or client document to a cloud AI service can expose your business to serious legal and reputational risk."),
        sp(16),

        // 2 — WHAT IS CODEFORGE AI
        hr(),
        pill("What We Built"),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "CodeForge AI — Private AI that runs on your machine", bold: true, size: 40, color: C.black, font: "Arial" })], spacing: { before: 320, after: 120 } }),
        body("CodeForge AI is a desktop application that runs a powerful AI model entirely on your own computer. No internet connection required. No data ever leaves your machine. It plugs directly into the tools your team already uses every day — Microsoft Excel, Word, PowerPoint, VS Code, and your browser.", { after: 200 }),
        callout("Think of it as a private ChatGPT that only you can access, with zero risk of data exposure — built directly into your Office applications."),
        sp(16),

        // 3 — THE EXTENSIONS
        hr(),
        pill("The Extensions"),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "AI built directly into your everyday tools", bold: true, size: 40, color: C.black, font: "Arial" })], spacing: { before: 320, after: 120 } }),
        body("CodeForge AI ships with six purpose-built extensions. Install once, use everywhere.", { after: 200 }),

        featureCard("📊", "Excel Add-in — AI inside your spreadsheets",
          "Select any cells, table, or range and ask the AI questions about your data. Summarise trends, explain formulas, generate new formulas, analyse financial models — all without leaving Excel. Your data stays in your spreadsheet and is never uploaded anywhere."),
        sp(8),
        featureCard("📝", "Word Add-in — AI inside your documents",
          "Select any paragraph, section, or the full document and ask the AI to explain, summarise, rewrite, translate, or improve it. Ideal for drafting contracts, reports, proposals, and emails — with complete privacy.", C.purpleLight),
        sp(8),
        featureCard("📑", "PowerPoint Add-in — AI inside your presentations",
          "Get AI assistance directly within PowerPoint. Ask for slide content suggestions, rewrite speaker notes, summarise decks, or generate talking points — without any data leaving your computer.", C.grayBg),
        sp(8),
        featureCard("💻", "VS Code Extension — AI inside your code editor",
          "Connects VS Code or Cursor to the CodeForge AI engine. The AI sees your open file, selected code, and cursor position. Right-click any selection to Explain, Refactor, Fix Bugs, or Add Comments — then apply the result directly back into your editor with one click.", C.purpleLight),
        sp(8),
        featureCard("🌐", "Browser Extension — AI inside your browser",
          "An AI sidebar that works on any webpage or web app. Includes automation recording, a bot for repetitive tasks, and direct integration with Power BI dashboards — giving your team AI assistance wherever they work online.", C.grayBg),
        sp(8),
        featureCard("📈", "Financial Analyst Extension — Built for finance teams",
          "Purpose-built for financial professionals. Link multiple Excel workbooks, run AI-powered valuations, perform risk analysis, generate charts, and chat with the AI about your financial models — completely offline and secure.", C.tealBg),
        sp(16),

        // 4 — HOW IT WORKS
        hr(),
        pill("How It Works"),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Simple to install, invisible when you work", bold: true, size: 40, color: C.black, font: "Arial" })], spacing: { before: 320, after: 120 } }),
        sp(8),
        stepRow(1, "Download and install the desktop app", "The CodeForge AI desktop app installs like any Windows application. The AI model is built in — no extra downloads, no account creation, no API keys required."),
        sp(6),
        stepRow(2, "Install the extensions for your tools", "Add the Excel, Word, or PowerPoint add-ins from your Office apps. Install the VS Code extension from a .vsix file in under two minutes. Add the browser extension to Chrome."),
        sp(6),
        stepRow(3, "Open your tool and start asking questions", "The AI panel appears as a sidebar inside Excel, Word, PowerPoint, VS Code, or your browser. Select content, type your question, get an instant answer — all processed locally on your machine."),
        sp(6),
        stepRow(4, "Your data never moves", "Every AI request runs on your own CPU. Nothing is sent to any server anywhere. The model, your files, and all responses stay on your computer at all times."),
        sp(16),

        // 5 — CAPABILITIES
        hr(),
        pill("Capabilities"),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "What your team can do with CodeForge AI", bold: true, size: 40, color: C.black, font: "Arial" })], spacing: { before: 320, after: 120 } }),
        sp(8),
        capabilitiesTable(),
        sp(16),

        // 6 — PRIVACY
        hr(),
        pill("Privacy & Security"),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Built for organisations where data privacy is non-negotiable", bold: true, size: 40, color: C.black, font: "Arial" })], spacing: { before: 320, after: 120 } }),
        body("CodeForge AI was designed from the ground up with one principle: your data is yours.", { after: 160 }),
        privacyTable(),
        sp(12),
        callout("CodeForge AI is suitable for finance, legal, healthcare, government, and any other industry with strict data protection requirements — including air-gapped environments."),
        sp(16),

        // 7 — WHO IS IT FOR
        hr(),
        pill("Who Is It For"),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Perfect for teams who work with sensitive data", bold: true, size: 40, color: C.black, font: "Arial" })], spacing: { before: 320, after: 120 } }),
        sp(8),
        audienceTable(),
        sp(16),

        // 8 — COMPARISON
        hr(),
        pill("Comparison"),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "CodeForge AI vs Cloud AI Tools", bold: true, size: 40, color: C.black, font: "Arial" })], spacing: { before: 320, after: 120 } }),
        sp(8),
        comparisonTable(),
        sp(16),

        // 9 — CTA
        hr(),
        ctaBanner(),
      ],
    },
  ],
});

Packer.toBuffer(doc).then(function(buf) {
  fs.writeFileSync("D:/offlineai/CodeForge_AI_Product_Overview.docx", buf);
  console.log("Done: D:/offlineai/CodeForge_AI_Product_Overview.docx");
}).catch(function(e) {
  console.error(e.message);
  process.exit(1);
});
