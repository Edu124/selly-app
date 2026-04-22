const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, Header, Footer, LevelFormat,
  ExternalHyperlink,
} = require("docx");
const fs = require("fs");

// ── Colors ────────────────────────────────────────────────────────────────
const C = {
  purple     : "6C47FF",
  purpleDark : "4A2FCC",
  purpleLight: "EAE4FF",
  purpleMid  : "C4B5FD",
  white      : "FFFFFF",
  nearBlack  : "0D0D14",
  gray1      : "1E1E2E",
  gray2      : "4B4B6A",
  gray3      : "8888AA",
  grayBg     : "F5F3FF",
  grayLine   : "E0DDEF",
  green      : "22C55E",
  greenBg    : "ECFDF5",
  yellow     : "F59E0B",
  yellowBg   : "FFFBEB",
  accent     : "FF6B9D",
};

const border = (color = C.grayLine) => ({ style: BorderStyle.SINGLE, size: 1, color });
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allBorders = (color) => ({ top: border(color), bottom: border(color), left: border(color), right: border(color) });
const noBorders   = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

// ── Helpers ───────────────────────────────────────────────────────────────
function spacer(pt = 6) {
  return new Paragraph({ children: [], spacing: { before: 0, after: pt * 20 } });
}

function hr(color = C.grayLine) {
  return new Paragraph({
    children: [],
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color, space: 1 } },
    spacing: { before: 0, after: 120 },
  });
}

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, size: 36, color: C.nearBlack, font: "Arial" })],
    spacing: { before: 360, after: 120 },
  });
}

function heading2(text, color = C.purple) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, size: 28, color, font: "Arial" })],
    spacing: { before: 280, after: 100 },
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({
      text,
      size: opts.size || 22,
      color: opts.color || C.gray2,
      bold: opts.bold || false,
      font: "Arial",
    })],
    spacing: { before: 0, after: opts.after || 120 },
  });
}

function bullet(text, sub = false) {
  return new Paragraph({
    numbering: { reference: "bullets", level: sub ? 1 : 0 },
    children: [new TextRun({ text, size: 22, color: C.gray2, font: "Arial" })],
    spacing: { before: 0, after: 60 },
  });
}

// ── Cover Page ─────────────────────────────────────────────────────────────
function makeCoverPage() {
  const cellPad = { top: 120, bottom: 120, left: 140, right: 140 };
  return [
    // Brand header bar (purple)
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [9360],
      rows: [new TableRow({
        children: [new TableCell({
          borders: noBorders,
          shading: { fill: C.purple, type: ShadingType.CLEAR },
          margins: { top: 300, bottom: 300, left: 360, right: 360 },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new TextRun({ text: "CODEFORGE", bold: true, size: 52, color: C.white, font: "Arial", characterSpacing: 100 })],
              spacing: { before: 0, after: 60 },
            }),
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new TextRun({ text: "Instagram Commerce Automation", size: 24, color: "C4B5FD", font: "Arial" })],
              spacing: { before: 0, after: 0 },
            }),
          ],
        })],
      })],
    }),

    spacer(32),

    // Title block
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: "Product Overview", bold: true, size: 56, color: C.nearBlack, font: "Arial" })],
      spacing: { before: 0, after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: "How CodeForge turns your Instagram into a 24/7 sales engine", size: 26, color: C.gray3, font: "Arial", italics: true })],
      spacing: { before: 0, after: 480 },
    }),

    hr(C.purpleMid),
    spacer(16),

    // Key numbers row
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3120, 3120, 3120],
      rows: [new TableRow({
        children: [
          kpiCell("24 / 7", "Automated Order Taking", C.purpleLight, C.purple),
          kpiCell("5 Min", "Setup Time", C.greenBg, C.green),
          kpiCell("Zero", "Extra Apps Needed", C.yellowBg, C.yellow),
        ],
      })],
    }),

    spacer(24),
    hr(C.grayLine),
    spacer(8),

    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: "Prepared by CodeForge  |  Confidential", size: 18, color: C.gray3, font: "Arial" })],
      spacing: { before: 0, after: 0 },
    }),
  ];
}

function kpiCell(value, label, bgColor, textColor) {
  return new TableCell({
    borders: noBorders,
    shading: { fill: bgColor, type: ShadingType.CLEAR },
    margins: { top: 200, bottom: 200, left: 220, right: 220 },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: value, bold: true, size: 44, color: textColor, font: "Arial" })],
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

// ── Feature Row ────────────────────────────────────────────────────────────
function featureRow(icon, title, desc, bgColor = C.grayBg) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [800, 8560],
    rows: [new TableRow({
      children: [
        new TableCell({
          borders: noBorders,
          shading: { fill: bgColor, type: ShadingType.CLEAR },
          margins: { top: 140, bottom: 140, left: 160, right: 160 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: icon, size: 32, font: "Segoe UI Emoji" })],
            spacing: { before: 0, after: 0 },
          })],
        }),
        new TableCell({
          borders: noBorders,
          shading: { fill: bgColor, type: ShadingType.CLEAR },
          margins: { top: 140, bottom: 140, left: 160, right: 200 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: title, bold: true, size: 24, color: C.nearBlack, font: "Arial" })],
              spacing: { before: 0, after: 40 },
            }),
            new Paragraph({
              children: [new TextRun({ text: desc, size: 21, color: C.gray2, font: "Arial" })],
              spacing: { before: 0, after: 0 },
            }),
          ],
        }),
      ],
    })],
  });
}

// ── Section Pill ──────────────────────────────────────────────────────────
function sectionPill(text) {
  return new Table({
    width: { size: 2800, type: WidthType.DXA },
    columnWidths: [2800],
    rows: [new TableRow({
      children: [new TableCell({
        borders: noBorders,
        shading: { fill: C.purple, type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 180, right: 180 },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 18, color: C.white, font: "Arial", characterSpacing: 80 })],
          spacing: { before: 0, after: 0 },
        })],
      })],
    })],
    margins: { bottom: 120 },
  });
}

// ── How It Works step ─────────────────────────────────────────────────────
function stepRow(num, title, desc) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [700, 8660],
    rows: [new TableRow({
      children: [
        new TableCell({
          borders: noBorders,
          shading: { fill: C.purple, type: ShadingType.CLEAR },
          margins: { top: 120, bottom: 120, left: 160, right: 160 },
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: String(num), bold: true, size: 28, color: C.white, font: "Arial" })],
            spacing: { before: 0, after: 0 },
          })],
        }),
        new TableCell({
          borders: noBorders,
          margins: { top: 120, bottom: 120, left: 180, right: 180 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: title, bold: true, size: 24, color: C.nearBlack, font: "Arial" })],
              spacing: { before: 0, after: 40 },
            }),
            new Paragraph({
              children: [new TextRun({ text: desc, size: 21, color: C.gray2, font: "Arial" })],
              spacing: { before: 0, after: 0 },
            }),
          ],
        }),
      ],
    })],
  });
}

// ── Pricing table ─────────────────────────────────────────────────────────
function pricingTable() {
  const hCell = (text, w) => new TableCell({
    borders: allBorders(C.purple),
    shading: { fill: C.purple, type: ShadingType.CLEAR },
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
    width: { size: w, type: WidthType.DXA },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 22, color: C.white, font: "Arial" })],
      spacing: { before: 0, after: 0 },
    })],
  });

  const dCell = (text, w, shade = C.white, textColor = C.gray2, bold = false) => new TableCell({
    borders: allBorders(C.grayLine),
    shading: { fill: shade, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 160, right: 160 },
    width: { size: w, type: WidthType.DXA },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, size: 22, color: textColor, bold, font: "Arial" })],
      spacing: { before: 0, after: 0 },
    })],
  });

  const rows = [
    ["Component", "Detail", "Amount"],
    ["Monthly Subscription", "Full access to all features", "₹3,000 / month"],
    ["Commission (Promo Orders)", "5% on items above ₹1,000 sold via promotions", "5% per item"],
    ["Organic Orders", "No promotion sent — no commission ever", "₹0"],
    ["Free Trial", "14 days full access, no credit card required", "FREE"],
  ];

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2800, 4160, 2400],
    rows: rows.map((r, i) => {
      if (i === 0) {
        return new TableRow({ children: [hCell(r[0], 2800), hCell(r[1], 4160), hCell(r[2], 2400)] });
      }
      const shade = i % 2 === 0 ? C.grayBg : C.white;
      const isHighlight = r[2] === "FREE";
      return new TableRow({
        children: [
          dCell(r[0], 2800, shade, C.nearBlack, true),
          dCell(r[1], 4160, shade, C.gray2),
          dCell(r[2], 2400, isHighlight ? C.greenBg : shade, isHighlight ? C.green : C.purple, true),
        ],
      });
    }),
  });
}

// ── Comparison table ──────────────────────────────────────────────────────
function comparisonTable() {
  const col = [3360, 3000, 3000];
  const hCell = (t, w) => new TableCell({
    borders: allBorders(C.purple),
    shading: { fill: C.purple, type: ShadingType.CLEAR },
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    width: { size: w, type: WidthType.DXA },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: t, bold: true, size: 22, color: C.white, font: "Arial" })],
      spacing: { before: 0, after: 0 },
    })],
  });
  const dCell = (t, w, shade, tc, bold = false) => new TableCell({
    borders: allBorders(C.grayLine),
    shading: { fill: shade, type: ShadingType.CLEAR },
    margins: { top: 90, bottom: 90, left: 140, right: 140 },
    width: { size: w, type: WidthType.DXA },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: t, size: 21, color: tc, bold, font: "Arial" })],
      spacing: { before: 0, after: 0 },
    })],
  });

  const rows = [
    ["Feature", "Without CodeForge", "With CodeForge"],
    ["Order taking", "Manual DMs, missed orders", "Automated 24/7"],
    ["Product search", "Owner replies each time", "Bot finds & shows instantly"],
    ["Payment links", "Sent manually", "Auto-generated & sent"],
    ["Promo campaigns", "Post & hope for DMs", "Blast DMs to all customers"],
    ["Cart recovery", "Never happens", "Auto DM after 24h inactivity"],
    ["Order tracking", "WhatsApp manually", "Auto DM at every status change"],
    ["Review collection", "Forgotten", "Auto DM 24h after delivery"],
    ["Instagram post → Product", "Re-type everything", "Paste URL, price done"],
  ];

  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: col,
    rows: rows.map((r, i) => {
      if (i === 0) return new TableRow({ children: [hCell(r[0], col[0]), hCell(r[1], col[1]), hCell(r[2], col[2])] });
      const shade = i % 2 === 0 ? C.grayBg : C.white;
      return new TableRow({
        children: [
          dCell(r[0], col[0], shade, C.nearBlack, true),
          dCell(r[1], col[1], shade, C.gray3),
          dCell(r[2], col[2], C.purpleLight, C.purpleDark, true),
        ],
      });
    }),
  });
}

// ── Callout box ────────────────────────────────────────────────────────────
function callout(text, bgColor = C.purpleLight, textColor = C.purpleDark) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders: { top: noBorder, bottom: noBorder, right: noBorder, left: { style: BorderStyle.SINGLE, size: 18, color: C.purple } },
        shading: { fill: bgColor, type: ShadingType.CLEAR },
        margins: { top: 160, bottom: 160, left: 240, right: 240 },
        children: [new Paragraph({
          children: [new TextRun({ text, size: 22, color: textColor, font: "Arial", italics: true })],
          spacing: { before: 0, after: 0 },
        })],
      })],
    })],
  });
}

// ── Footer ─────────────────────────────────────────────────────────────────
function makeFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.grayLine, space: 1 } },
        children: [
          new TextRun({ text: "CodeForge  |  Page ", size: 18, color: C.gray3, font: "Arial" }),
          new TextRun({ children: [PageNumber.CURRENT], size: 18, color: C.gray3, font: "Arial" }),
          new TextRun({ text: " of ", size: 18, color: C.gray3, font: "Arial" }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: C.gray3, font: "Arial" }),
        ],
        spacing: { before: 120, after: 0 },
      }),
    ],
  });
}

// ══════════════════════════════════════════════════════════════════════════
//  BUILD DOCUMENT
// ══════════════════════════════════════════════════════════════════════════
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 600, hanging: 300 } }, run: { font: "Arial", size: 22 } } },
          { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 960, hanging: 300 } }, run: { font: "Arial", size: 20 } } },
        ],
      },
    ],
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22, color: C.gray2 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, color: C.nearBlack, font: "Arial" },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, color: C.purple, font: "Arial" },
        paragraph: { spacing: { before: 280, after: 100 }, outlineLevel: 1 } },
    ],
  },
  sections: [
    // ── PAGE 1: Cover ──────────────────────────────────────────────────────
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      footers: { default: makeFooter() },
      children: [
        ...makeCoverPage(),
      ],
    },

    // ── PAGE 2+: Content ───────────────────────────────────────────────────
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      footers: { default: makeFooter() },
      children: [

        // ─ SECTION 1: The Problem ──────────────────────────────────────────
        sectionPill("The Problem"),
        heading1("Your Instagram is busy — but you're missing sales"),
        body("Customers send you DMs at all hours asking about products, sizes, prices and availability. Responding manually means:", { after: 160 }),
        bullet("Missed DMs when you're asleep or busy"),
        bullet("Slow replies that lose impatient buyers"),
        bullet("Time spent copy-pasting payment links"),
        bullet("No way to follow up with customers who showed interest but never ordered"),
        bullet("Promotions that require individually messaging hundreds of followers"),
        spacer(10),
        callout("The average Instagram seller loses 40–60% of potential orders simply because they cannot respond fast enough."),
        spacer(16),

        // ─ SECTION 2: What is CodeForge ───────────────────────────────────
        hr(),
        sectionPill("What We Do"),
        heading1("CodeForge — Your Instagram Sales Assistant"),
        body("CodeForge is a fully automated Instagram DM bot that runs your entire sales operation. A customer DMs you — the bot takes over, helps them find products, collects their address, generates a payment link, and updates them at every step of the order.", { after: 200 }),

        callout("You focus on your products and business. CodeForge handles every customer conversation, every order, every follow-up — automatically."),
        spacer(16),

        // ─ SECTION 3: Features ────────────────────────────────────────────
        hr(),
        sectionPill("Key Features"),
        heading1("Everything your sales team would do — automated"),
        spacer(6),

        featureRow("🤖", "Smart Product Search", "Customers type what they want in natural language (\"sarees under 1500\", \"blue candles\") and the bot instantly finds and shows matching products with images and prices from your catalog."),
        spacer(8),
        featureRow("📸", "Instagram Post → Product in Seconds", "Paste an Instagram post URL into your dashboard, set a price, and CodeForge auto-fills the product name, category, and image. Your catalog is always in sync with your feed.", C.purpleLight),
        spacer(8),
        featureRow("💳", "Automated Payment Links", "The bot generates a Razorpay payment link for every order and sends it directly in the DM. No more manually creating links or chasing payments.", C.grayBg),
        spacer(8),
        featureRow("🚚", "Order Status Updates", "Every time you update an order — packed, shipped, delivered — the customer gets an automatic DM with their tracking number. Zero manual messaging.", C.purpleLight),
        spacer(8),
        featureRow("⚡", "Flash Sale & New Arrival Blasts", "Send a promotional DM to all your customers in one click. Every customer who orders after receiving the DM is tagged — so you can measure ROI exactly.", C.grayBg),
        spacer(8),
        featureRow("🛒", "Abandoned Cart Recovery", "The bot identifies customers who asked about products but never completed an order and automatically sends a follow-up DM 24 hours later.", C.purpleLight),
        spacer(8),
        featureRow("👥", "Referral Program", "Every customer gets a unique referral code. When a friend uses it, both get a discount and you get a new customer — fully automated.", C.grayBg),
        spacer(8),
        featureRow("⭐", "Review Collection", "24 hours after delivery the bot sends a personalised review request. Positive reviews improve your Instagram credibility and drive more sales.", C.purpleLight),
        spacer(16),

        // ─ SECTION 4: How It Works ────────────────────────────────────────
        hr(),
        sectionPill("How It Works"),
        heading1("Up and running in 5 minutes"),
        spacer(8),
        stepRow(1, "Connect your Instagram account", "Link your Instagram business account through ManyChat (Meta-approved). No app login or password sharing needed."),
        spacer(6),
        stepRow(2, "Upload your catalog", "Add products via the web dashboard. Paste an Instagram post URL and we auto-fill the details — just set a price."),
        spacer(6),
        stepRow(3, "Go live", "Your bot is now active. Every DM to your Instagram account is handled automatically — product search, ordering, payment, tracking."),
        spacer(6),
        stepRow(4, "Manage from the Selly app", "Use the Selly mobile app to view orders, update statuses, send promotions, and track your commissions and billing — all from your phone."),
        spacer(16),

        // ─ SECTION 5: Before / After ──────────────────────────────────────
        hr(),
        sectionPill("Before vs After"),
        heading1("See the difference"),
        spacer(8),
        comparisonTable(),
        spacer(16),

        // ─ SECTION 6: Pricing ─────────────────────────────────────────────
        hr(),
        sectionPill("Pricing"),
        heading1("Simple, transparent pricing"),
        body("No hidden fees. No per-order charges. Just a flat monthly subscription plus a small commission only on orders driven by your promotions.", { after: 200 }),
        pricingTable(),
        spacer(12),
        callout("Commission only applies when CodeForge actively drives the sale — through a Flash Sale, New Arrival blast, Abandoned Cart recovery, or Referral. Organic orders (customers who DM you on their own) are always commission-free."),
        spacer(16),

        // ─ SECTION 7: What You Get ────────────────────────────────────────
        hr(),
        sectionPill("What's Included"),
        heading1("Everything in one subscription"),
        spacer(8),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [4680, 4680],
          rows: [
            makeIncludeRow("Instagram DM Automation", "24/7 automated customer conversations", "Selly Mobile App", "Manage orders, catalog & promotions from your phone"),
            makeIncludeRow("Smart Product Search", "Natural language search across your catalog", "Abandoned Cart Recovery", "Auto follow-up DMs for lost customers"),
            makeIncludeRow("Auto Payment Links", "Razorpay integration, sent in DM", "Flash Sale Blasts", "One-click promo DMs to all customers"),
            makeIncludeRow("Order Status DMs", "Auto-notify customers at every step", "Referral Program", "Built-in referral codes with discount rewards"),
            makeIncludeRow("Instagram Post Import", "Paste URL, auto-fill catalog", "Review Collection", "Auto review request 24h after delivery"),
            makeIncludeRow("Business Dashboard", "Web dashboard for full control", "14-Day Free Trial", "Full access, no card required"),
          ],
        }),
        spacer(16),

        // ─ SECTION 8: CTA ─────────────────────────────────────────────────
        hr(),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [9360],
          rows: [new TableRow({
            children: [new TableCell({
              borders: noBorders,
              shading: { fill: C.purple, type: ShadingType.CLEAR },
              margins: { top: 320, bottom: 320, left: 400, right: 400 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "Ready to automate your Instagram sales?", bold: true, size: 32, color: C.white, font: "Arial" })],
                  spacing: { before: 0, after: 120 },
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "Start your 14-day free trial — no credit card required.", size: 24, color: "C4B5FD", font: "Arial" })],
                  spacing: { before: 0, after: 160 },
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: "Contact CodeForge to get started today", bold: true, size: 24, color: C.white, font: "Arial" })],
                  spacing: { before: 0, after: 0 },
                }),
              ],
            })],
          })],
        }),
      ],
    },
  ],
});

function makeIncludeRow(t1, d1, t2, d2) {
  const cell = (title, desc) => new TableCell({
    borders: allBorders(C.grayLine),
    shading: { fill: C.grayBg, type: ShadingType.CLEAR },
    margins: { top: 110, bottom: 110, left: 160, right: 160 },
    width: { size: 4680, type: WidthType.DXA },
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: "✓  ", size: 22, color: C.green, bold: true, font: "Arial" }),
          new TextRun({ text: title, size: 22, color: C.nearBlack, bold: true, font: "Arial" }),
        ],
        spacing: { before: 0, after: 30 },
      }),
      new Paragraph({
        children: [new TextRun({ text: "    " + desc, size: 19, color: C.gray3, font: "Arial" })],
        spacing: { before: 0, after: 0 },
      }),
    ],
  });
  return new TableRow({ children: [cell(t1, d1), cell(t2, d2)] });
}

// Write output
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync("D:/offlineai/CodeForge_Product_Overview.docx", buf);
  console.log("Done: D:/offlineai/CodeForge_Product_Overview.docx");
}).catch(e => { console.error(e.message); process.exit(1); });
