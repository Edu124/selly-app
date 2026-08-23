// ── Selly · service pitch deck ────────────────────────────────────────────────
// Seven slides, revenue-forward.
//
// A deliberate constraint shapes this deck: it describes OUTCOMES, never
// MECHANISM. What the kitchen gets, what the customer gets, and how money is
// made — but not how any of it is delivered. Anyone reading it should want the
// product without learning enough to rebuild it.
//
// Build:  node build-service.cjs
// ─────────────────────────────────────────────────────────────────────────────

const pptxgen = require("pptxgenjs");

// ── Palette ──────────────────────────────────────────────────────────────────
// Selly's own: deep navy ground, violet primary. Amber carries the food and the
// revenue accents; green is held back for the wordmark and confirmations only.
const BG      = "0A0A12";
const CARD    = "171723";
const CARD2   = "1C1C2B";
const LINE    = "2A2A3D";
const VIOLET  = "7C5CFF";
const VIOLETL = "9D87FF";
const GREEN   = "25D366";
const AMBER   = "F5A524";
const CORAL   = "F96167";
const TX      = "F2F2F7";
const TX2     = "9A9AB4";
const TX3     = "63637D";

const H = "Calibri";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";               // 13.3 x 7.5
pres.author = "Selly";
pres.title  = "Selly — service pitch";

const dark = () => { const s = pres.addSlide(); s.background = { color: BG }; return s; };

// ── Shared furniture ─────────────────────────────────────────────────────────
// One motif, repeated: soft rounded cards with a hairline edge. No accent bars.

function card(s, x, y, w, h, fill, edge) {
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.14,
    fill: { color: fill || CARD },
    line: { color: edge || LINE, width: 1 },
  });
}

function dot(s, x, y, n, color) {
  s.addShape(pres.ShapeType.ellipse, {
    x, y, w: 0.44, h: 0.44,
    fill: { color: color || VIOLET }, line: { color: color || VIOLET, width: 0 },
  });
  s.addText(String(n), {
    x, y, w: 0.44, h: 0.44, align: "center", valign: "middle",
    fontFace: H, fontSize: 14.5, bold: true, color: "FFFFFF", margin: 0,
  });
}

function wordmark(s, x, y, size) {
  s.addText(
    [{ text: "selly", options: { color: TX } }, { text: ".", options: { color: GREEN } }],
    { x, y, w: 5, h: size / 44, fontFace: H, fontSize: size, bold: true, charSpacing: -1, margin: 0 }
  );
}

function title(s, text) {
  s.addText(text, {
    x: 0.75, y: 0.6, w: 11.9, h: 0.9,
    fontFace: H, fontSize: 32, bold: true, color: TX, valign: "top", margin: 0,
  });
}

function kicker(s, text, color) {
  s.addText(text, {
    x: 0.75, y: 1.52, w: 11.9, h: 0.5,
    fontFace: H, fontSize: 17, italic: true, color: color || VIOLETL, valign: "top", margin: 0,
  });
}

function foot(s, text) {
  s.addText(text, {
    x: 0.75, y: 6.85, w: 11.9, h: 0.35,
    fontFace: H, fontSize: 11, color: TX3, valign: "top", margin: 0,
  });
}

/* ═══════════════════════ 1 · Title ═══════════════════════ */
{
  const s = dark();
  wordmark(s, 0.75, 0.72, 30);

  s.addText("Every kitchen\ndeserves its own\nfront door.", {
    x: 0.75, y: 2.15, w: 8.0, h: 2.6,
    fontFace: H, fontSize: 42, bold: true, color: TX,
    lineSpacing: 50, charSpacing: -0.5, valign: "top", margin: 0,
  });

  s.addText(
    "Direct ordering for cloud kitchens — and a far better way for their customers to eat.",
    { x: 0.78, y: 5.05, w: 7.5, h: 0.9,
      fontFace: H, fontSize: 15.5, color: TX2, lineSpacing: 24, valign: "top", margin: 0 }
  );

  // Motif: three soft cards, teasing the promise without explaining it.
  const bubbles = [
    { y: 2.25, fill: CARD,  color: TX,       t: "Ordered last night, 8:04 pm" },
    { y: 3.25, fill: VIOLET, color: "FFFFFF", t: "Scheduled for 12:30 today" },
    { y: 4.25, fill: CARD2, color: GREEN,    t: "Delivered · 12:28 pm" },
  ];
  bubbles.forEach((b) => {
    card(s, 9.35, b.y, 3.2, 0.72, b.fill, b.fill === CARD2 ? LINE : b.fill);
    s.addText(b.t, {
      x: 9.6, y: b.y, w: 2.75, h: 0.72,
      fontFace: H, fontSize: 12, color: b.color, valign: "middle", margin: 0,
    });
  });

  foot(s, "Pitch deck  ·  Confidential  ·  2026");
  s.addNotes(
    "Open on the line, not the product. A cloud kitchen today rents its customers from " +
    "somebody else. We give them a front door of their own. Keep the how out of the room."
  );
}

/* ═══════════════════════ 2 · Problem ═══════════════════════ */
{
  const s = dark();
  title(s, "Cloud kitchens are growing. Their margins are not.");
  kicker(s, "Three problems, and none of them are about the food.", TX2);

  const items = [
    { n: 1, c: CORAL,  h: "The commission",
      b: "A large share of every order goes to the platform that delivered it. The kitchen does the work and keeps the smaller half." },
    { n: 2, c: AMBER,  h: "No customer",
      b: "The kitchen never learns who ordered, what they liked, or when they will be back. The platform keeps all of it." },
    { n: 3, c: VIOLET, h: "No control",
      b: "A ranking change or a policy update can cut the orders off overnight, with no warning and no appeal." },
  ];

  items.forEach((it, i) => {
    const x = 0.75 + i * 4.05;
    card(s, x, 2.3, 3.7, 2.95);
    dot(s, x + 0.42, 2.75, it.n, it.c);
    s.addText(it.h, {
      x: x + 0.42, y: 3.42, w: 2.9, h: 0.45,
      fontFace: H, fontSize: 18, bold: true, color: TX, valign: "top", margin: 0,
    });
    s.addText(it.b, {
      x: x + 0.42, y: 3.95, w: 2.9, h: 1.65,
      fontFace: H, fontSize: 12.5, color: TX2, lineSpacing: 18, valign: "top", margin: 0,
    });
  });

  s.addText("They are renting their own customers.", {
    x: 0.75, y: 5.72, w: 11.9, h: 0.55,
    fontFace: H, fontSize: 19, bold: true, color: TX, valign: "middle", margin: 0,
  });
  s.addNotes(
    "Land the third one hardest — it is the existential risk, and it is the one they " +
    "feel but rarely say out loud. Drop in a real commission figure here if you have a " +
    "sourced one; better to quote a kitchen you have spoken to than a market report."
  );
}

/* ═══════════════════════ 3 · What we do ═══════════════════════ */
{
  const s = dark();
  title(s, "Selly gives the kitchen a front door of its own.");
  kicker(s, "Their customers. Their orders. Their margin.");

  const rows = [
    { c: VIOLET, h: "Customers order directly",
      b: "Nothing to install, nothing to sign up for. It simply opens, and it works on the phone they already carry." },
    { c: AMBER,  h: "The kitchen owns the relationship",
      b: "Every customer, every repeat order, every preference stays with the kitchen — and stays useful." },
    { c: GREEN,  h: "Nothing sits in the middle",
      b: "No marketplace ranking to climb, no bidding for visibility, and no share of the bill going elsewhere." },
  ];

  rows.forEach((r, i) => {
    const y = 2.3 + i * 1.32;
    card(s, 0.75, y, 11.8, 1.12);
    s.addShape(pres.ShapeType.ellipse, {
      x: 1.12, y: y + 0.33, w: 0.46, h: 0.46,
      fill: { color: r.c }, line: { color: r.c, width: 0 },
    });
    s.addText(r.h, {
      x: 1.85, y: y + 0.17, w: 3.9, h: 0.42,
      fontFace: H, fontSize: 16.5, bold: true, color: TX, valign: "middle", margin: 0,
    });
    s.addText(r.b, {
      x: 5.85, y: y + 0.16, w: 6.4, h: 0.85,
      fontFace: H, fontSize: 12.5, color: TX2, lineSpacing: 17, valign: "middle", margin: 0,
    });
  });

  card(s, 0.75, 6.28, 11.8, 0.82, CARD2);
  s.addText(
    [
      { text: "The kitchen keeps the order. ", options: { bold: true, color: TX, fontSize: 17 } },
      { text: "And, for the first time, the customer.", options: { color: GREEN, fontSize: 17, bold: true } },
    ],
    { x: 1.12, y: 6.28, w: 11.1, h: 0.82, fontFace: H, valign: "middle", margin: 0 }
  );
  s.addNotes(
    "Stay at outcome level. If asked how it works, the honest answer in the room is " +
    "'that is the part we would rather show you than describe' — offer the live demo instead."
  );
}

/* ═══════════════════════ 4 · Revenue ═══════════════════════ */
{
  const s = dark();
  title(s, "Two ways we earn.");
  kicker(s, "One from the business. One from the habit.");

  // Engine A — the kitchen
  card(s, 0.75, 2.25, 5.75, 3.85);
  dot(s, 1.15, 2.65, 1, VIOLET);
  s.addText("Kitchens pay for the platform", {
    x: 1.15, y: 3.32, w: 4.95, h: 0.85,
    fontFace: H, fontSize: 20, bold: true, color: TX, lineSpacing: 26, valign: "top", margin: 0,
  });
  s.addText(
    "A recurring subscription for the ordering system, the customer list, and the tools " +
    "that run the day.",
    { x: 1.15, y: 4.28, w: 4.95, h: 1.0,
      fontFace: H, fontSize: 13, color: TX2, lineSpacing: 18, valign: "top", margin: 0 }
  );
  s.addText("Never a cut of what they sell.", {
    x: 1.15, y: 5.42, w: 4.95, h: 0.4,
    fontFace: H, fontSize: 13.5, bold: true, color: VIOLETL, valign: "top", margin: 0,
  });

  // Engine B — the customer
  card(s, 6.8, 2.25, 5.75, 3.85);
  dot(s, 7.2, 2.65, 2, AMBER);
  s.addText("Customers pay for convenience", {
    x: 7.2, y: 3.32, w: 4.95, h: 0.85,
    fontFace: H, fontSize: 20, bold: true, color: TX, lineSpacing: 26, valign: "top", margin: 0,
  });
  s.addText(
    "An optional monthly package that unlocks ordering on their own schedule, rather " +
    "than on the kitchen's.",
    { x: 7.2, y: 4.28, w: 4.95, h: 1.0,
      fontFace: H, fontSize: 13, color: TX2, lineSpacing: 18, valign: "top", margin: 0 }
  );
  s.addText("Nominal, recurring, entirely opt-in.", {
    x: 7.2, y: 5.42, w: 4.95, h: 0.4,
    fontFace: H, fontSize: 13.5, bold: true, color: AMBER, valign: "top", margin: 0,
  });

  s.addText("Revenue that grows with the kitchen — not one that shrinks its margin.", {
    x: 0.75, y: 6.35, w: 11.9, h: 0.5,
    fontFace: H, fontSize: 15, color: TX2, valign: "middle", margin: 0,
  });
  s.addNotes(
    "Do not quote prices in the room. If pushed: the kitchen fee is a flat subscription, " +
    "the customer fee is nominal, and both are still being tested. The structural point " +
    "is that we never take a percentage of the order."
  );
}

/* ═══════════════════════ 5 · The customer package ═══════════════════════ */
{
  const s = dark();
  title(s, "Order when you are free. Eat when you are hungry.");
  kicker(s, "People do not order when they are hungry. They order when they have a minute.");

  const runs = [
    { fill: CARD,  a: "8:04 PM", al: "Tonight, while you have ten free minutes.",
                   b: "12:30 PM", bl: "Tomorrow. Lunch arrives while you are still in a meeting.",
                   c: VIOLETL },
    { fill: CARD,  a: "11:20 PM", al: "Last thing before bed, you set tomorrow up.",
                   b: "7:00 AM",  bl: "Breakfast is at the door before the day starts.",
                   c: AMBER },
  ];

  runs.forEach((r, i) => {
    const y = 2.35 + i * 1.72;
    card(s, 0.75, y, 11.8, 1.5, r.fill);

    s.addText(r.a, {
      x: 1.15, y: y + 0.2, w: 2.0, h: 0.5,
      fontFace: H, fontSize: 22, bold: true, color: r.c, valign: "middle", margin: 0,
    });
    s.addText(r.al, {
      x: 1.15, y: y + 0.72, w: 4.2, h: 0.6,
      fontFace: H, fontSize: 12, color: TX2, lineSpacing: 16, valign: "top", margin: 0,
    });

    s.addText("→", {
      x: 5.75, y: y, w: 0.8, h: 1.5,
      fontFace: H, fontSize: 26, bold: true, color: TX3, align: "center", valign: "middle", margin: 0,
    });

    s.addText(r.b, {
      x: 6.85, y: y + 0.2, w: 2.0, h: 0.5,
      fontFace: H, fontSize: 22, bold: true, color: GREEN, valign: "middle", margin: 0,
    });
    s.addText(r.bl, {
      x: 6.85, y: y + 0.72, w: 5.3, h: 0.6,
      fontFace: H, fontSize: 12, color: TX2, lineSpacing: 16, valign: "top", margin: 0,
    });
  });

  const chips = ["Order ahead, at any hour", "Early-morning delivery", "Set once, repeats daily"];
  chips.forEach((t, i) => {
    const x = 0.75 + i * 4.05;
    card(s, x, 5.85, 3.7, 0.62, CARD2);
    s.addText(t, {
      x: x, y: 5.85, w: 3.7, h: 0.62,
      fontFace: H, fontSize: 12.5, bold: true, color: TX, align: "center", valign: "middle", margin: 0,
    });
  });

  s.addText("This is what the monthly package unlocks.", {
    x: 0.75, y: 6.68, w: 11.9, h: 0.45,
    fontFace: H, fontSize: 14, italic: true, color: TX2, valign: "middle", margin: 0,
  });
  s.addNotes(
    "This slide is the consumer hook and the second revenue engine at once. The 7 AM " +
    "example lands best — nobody else reliably delivers breakfast, and it is the clearest " +
    "reason an ordinary person would pay a small monthly fee."
  );
}

/* ═══════════════════════ 6 · Where this goes ═══════════════════════ */
{
  const s = dark();
  title(s, "Kitchens first. Not kitchens only.");
  kicker(s, "The hard part is not the food. It is letting a household take orders at all.");

  const next = [
    { c: AMBER,  h: "Tiffin services",  b: "The most loyal, most repeatable food business there is — and the worst served by technology." },
    { c: VIOLET, h: "Home bakers",      b: "Occasion-led, order-ahead by nature, and already running on personal phone numbers." },
    { c: GREEN,  h: "Tailors & home services", b: "Same need exactly: take an order, agree a time, be reachable when it is ready." },
  ];

  next.forEach((it, i) => {
    const x = 0.75 + i * 4.05;
    card(s, x, 2.35, 3.7, 2.95);
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.42, y: 2.78, w: 0.44, h: 0.44,
      fill: { color: it.c }, line: { color: it.c, width: 0 },
    });
    s.addText(it.h, {
      x: x + 0.42, y: 3.42, w: 2.9, h: 0.72,
      fontFace: H, fontSize: 17, bold: true, color: TX, lineSpacing: 22, valign: "top", margin: 0,
    });
    s.addText(it.b, {
      x: x + 0.42, y: 4.25, w: 2.9, h: 1.25,
      fontFace: H, fontSize: 12.5, color: TX2, lineSpacing: 18, valign: "top", margin: 0,
    });
  });

  card(s, 0.75, 5.72, 11.8, 0.82, CARD2);
  s.addText(
    "Every household with a skill becomes a business that can take an order.",
    { x: 1.12, y: 5.72, w: 11.1, h: 0.82,
      fontFace: H, fontSize: 17, bold: true, color: TX, valign: "middle", margin: 0 }
  );
  s.addNotes(
    "This is the slide that turns a food company into a bigger idea. Say plainly that " +
    "kitchens are the wedge, not the ceiling — independence for households is the point."
  );
}

/* ═══════════════════════ 7 · The ask ═══════════════════════ */
{
  const s = dark();
  title(s, "What we would like from you.");
  kicker(s, "In that order — the first two are worth more to us right now than the last.", TX2);

  const asks = [
    { n: 1, c: VIOLET, h: "Suggestions",  b: "Tell us where this is thin. You will see holes we have stopped noticing." },
    { n: 2, c: AMBER,  h: "Direction",    b: "What would you do next if this were yours? What would you stop doing?" },
    { n: 3, c: CORAL,  h: "Referrals",    b: "One kitchen owner who would try it teaches us more than a month of building." },
    { n: 4, c: GREEN,  h: "Investment",   b: "To build properly, and to reach the kitchens faster than we can on our own." },
  ];

  asks.forEach((a, i) => {
    const x = 0.75 + (i % 2) * 6.05;
    const y = 2.25 + Math.floor(i / 2) * 1.95;
    card(s, x, y, 5.75, 1.72);
    dot(s, x + 0.4, y + 0.36, a.n, a.c);
    s.addText(a.h, {
      x: x + 1.08, y: y + 0.3, w: 4.3, h: 0.42,
      fontFace: H, fontSize: 18, bold: true, color: TX, valign: "middle", margin: 0,
    });
    s.addText(a.b, {
      x: x + 1.08, y: y + 0.8, w: 4.3, h: 0.75,
      fontFace: H, fontSize: 12.5, color: TX2, lineSpacing: 17, valign: "top", margin: 0,
    });
  });

  wordmark(s, 0.75, 6.25, 26);
  s.addText("Thank you.", {
    x: 9.0, y: 6.32, w: 3.55, h: 0.5,
    fontFace: H, fontSize: 17, color: TX2, align: "right", valign: "middle", margin: 0,
  });
  s.addNotes(
    "Ask for the first two out loud and wait. Leading with money makes the other three " +
    "sound like politeness; leading with advice usually gets you all four."
  );
}

pres.writeFile({ fileName: "Selly-Service-Pitch.pptx" })
  .then((f) => console.log("wrote " + f));
