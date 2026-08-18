const pptxgen = require("pptxgenjs");

// ── Palette: Selly's own. Deep navy ground, violet primary, WhatsApp green ────
// Content-informed on purpose — the product lives inside WhatsApp, so the accent
// is the green people already associate with the inbox it runs in.
const BG      = "0A0A12";
const CARD    = "171723";
const LINE    = "2A2A3D";
const VIOLET  = "7C5CFF";
const VIOLETL = "9D87FF";
const GREEN   = "25D366";
const CORAL   = "F96167";
const TX      = "F2F2F7";
const TX2     = "9A9AB4";
const TX3     = "63637D";

const H = "Calibri";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";               // 13.3 x 7.5
pres.author = "Selly";
pres.title  = "Selly — pitch";

const dark = () => { const s = pres.addSlide(); s.background = { color: BG }; return s; };

// Rounded "chat bubble" card — the one motif, repeated on every slide.
function card(s, x, y, w, h, fill) {
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.14,
    fill: { color: fill || CARD },
    line: { color: LINE, width: 1 },
  });
}

function numDot(s, x, y, n) {
  s.addShape(pres.ShapeType.ellipse, {
    x, y, w: 0.46, h: 0.46, fill: { color: VIOLET }, line: { color: VIOLET, width: 0 },
  });
  s.addText(String(n), {
    x, y, w: 0.46, h: 0.46, align: "center", valign: "middle",
    fontFace: H, fontSize: 15, bold: true, color: "FFFFFF", margin: 0,
  });
}

function wordmark(s, x, y, size) {
  s.addText(
    [{ text: "selly", options: { color: TX } }, { text: ".", options: { color: GREEN } }],
    { x, y, w: 5, h: size / 46, fontFace: H, fontSize: size, bold: true, charSpacing: -1, margin: 0 }
  );
}

function title(s, text) {
  s.addText(text, {
    x: 0.75, y: 0.62, w: 11.9, h: 0.95,
    fontFace: H, fontSize: 33, bold: true, color: TX, margin: 0,
  });
}

/* ───────────────────────── 1 · Title ───────────────────────── */
{
  const s = dark();
  wordmark(s, 0.85, 0.7, 40);

  s.addText("Helping every household\nrun its own business.", {
    x: 0.85, y: 2.05, w: 8.4, h: 1.9,
    fontFace: H, fontSize: 40, bold: true, color: TX, lineSpacing: 46, margin: 0,
  });

  s.addText("From one WhatsApp chat.", {
    x: 0.85, y: 3.95, w: 8.4, h: 0.55,
    fontFace: H, fontSize: 26, color: GREEN, margin: 0,
  });

  s.addText("No app to build. No website to pay for. No commission to anyone in the middle.", {
    x: 0.85, y: 4.75, w: 7.8, h: 0.8,
    fontFace: H, fontSize: 15, color: TX2, lineSpacing: 22, margin: 0,
  });

  s.addText("Cloud kitchens first.", {
    x: 0.85, y: 6.35, w: 6, h: 0.35,
    fontFace: H, fontSize: 13, color: TX3, margin: 0,
  });

  // The motif, introduced: a conversation.
  const bub = [
    { x: 9.5,  y: 2.25, w: 3.0,  h: 0.68, fill: CARD,  color: TX,       t: "What is good near me?" },
    { x: 9.95, y: 3.10, w: 2.55, h: 0.68, fill: GREEN, color: "05301A", t: "Ghar Ka Khana · 4.6" },
    { x: 9.5,  y: 3.95, w: 3.0,  h: 0.90, fill: CARD,  color: TX,       t: "Order confirmed.\nCooking now." },
  ];
  bub.forEach(b => {
    card(s, b.x, b.y, b.w, b.h, b.fill);
    s.addText(b.t, {
      x: b.x + 0.18, y: b.y, w: b.w - 0.36, h: b.h,
      fontFace: H, fontSize: 12, color: b.color, valign: "middle", margin: 0, lineSpacing: 15,
    });
  });

  s.addNotes("Selly turns a WhatsApp number into a working shop. We start with cloud kitchens because their pain is sharpest, but the idea is bigger: any household with a skill should be able to sell without building anything first.");
}

/* ───────────────────────── 2 · Problem ───────────────────────── */
{
  const s = dark();
  title(s, "A cloud kitchen does not own its customers");

  s.addText("30%", {
    x: 0.75, y: 2.30, w: 4.3, h: 1.4,
    fontFace: H, fontSize: 96, bold: true, color: CORAL, margin: 0,
  });
  s.addText("of an order can disappear before it reaches the kitchen — commission, payment fees and forced discounts together.", {
    x: 0.78, y: 3.80, w: 4.2, h: 1.5,
    fontFace: H, fontSize: 14, color: TX2, lineSpacing: 21, margin: 0, valign: "top",
  });

  const rows = [
    ["They own the customer, not you",
     "You never see the name or the number. No repeat order, and no way to bring anyone back."],
    ["Orders arrive from everywhere",
     "WhatsApp, Instagram, phone calls, a notebook by the stove. Nothing adds up at closing time."],
    ["A website costs more than it returns",
     "Building one, and paying someone to keep it alive, costs more than a small kitchen clears in a month."],
  ];
  rows.forEach(function (r, i) {
    const y = 1.85 + i * 1.62;
    card(s, 5.75, y, 6.8, 1.4);
    s.addText(r[0], {
      x: 6.05, y: y + 0.18, w: 6.2, h: 0.36,
      fontFace: H, fontSize: 16, bold: true, color: TX, margin: 0,
    });
    s.addText(r[1], {
      x: 6.05, y: y + 0.6, w: 6.2, h: 0.68,
      fontFace: H, fontSize: 12.5, color: TX2, lineSpacing: 17, margin: 0, valign: "top",
    });
  });

  s.addNotes("The commission is the headline, but the deeper problem is ownership. A kitchen on an aggregator is renting demand it can never keep.");
}

/* ───────────────────────── 3 · Solution ───────────────────────── */
{
  const s = dark();
  title(s, "The whole shop fits in one chat");

  const steps = [
    ["They message", "One number. No app to install, nothing to sign up for."],
    ["They get a real answer", "Kitchens near them, ranked by what they are actually good at — dish by dish."],
    ["They order in the chat", "Menu, cart, address and payment, all inside WhatsApp."],
    ["You cook", "It lands on your kitchen screen. Every update goes back to them on its own."],
  ];
  steps.forEach(function (st, i) {
    const x = 0.5 + i * 3.13;
    card(s, x, 1.85, 2.88, 3.05);
    numDot(s, x + 0.28, 2.12, i + 1);
    s.addText(st[0], {
      x: x + 0.28, y: 2.75, w: 2.35, h: 0.4,
      fontFace: H, fontSize: 16, bold: true, color: TX, margin: 0,
    });
    s.addText(st[1], {
      x: x + 0.28, y: 3.2, w: 2.35, h: 1.5,
      fontFace: H, fontSize: 12.5, color: TX2, lineSpacing: 17, margin: 0, valign: "top",
    });
  });

  card(s, 0.5, 5.35, 12.3, 1.05);
  s.addText(
    [
      { text: "The kitchen keeps 100% of the order.", options: { bold: true, color: GREEN, fontSize: 19 } },
      { text: "   A flat monthly fee — never a cut of what they sell.", options: { color: TX2, fontSize: 14 } },
    ],
    { x: 0.85, y: 5.35, w: 11.6, h: 1.05, fontFace: H, valign: "middle", margin: 0 }
  );

  s.addNotes("The customer side is a WhatsApp thread. The kitchen side is an app showing live orders, a batch view of what to cook, and one tap to move an order forward — which messages the customer automatically.");
}

/* ───────────────────────── 4 · What comes next ───────────────────────── */
{
  const s = dark();
  title(s, "Any household with a skill");

  s.addText("The kitchen is only the first one. The engine underneath does not care what is being sold.", {
    x: 0.75, y: 1.55, w: 10.8, h: 0.45,
    fontFace: H, fontSize: 15, color: TX2, margin: 0,
  });

  const cats = [
    ["Tiffin services", "Daily subscribers, paused and resumed in chat"],
    ["Tailors", "Measurements, fittings and pickup dates"],
    ["Home bakers", "Custom cakes, exact message, delivery slot"],
    ["Salon at home", "Bookings and reminders"],
    ["Tuition", "Batches, fees and schedules"],
  ];
  cats.forEach(function (c, i) {
    const x = 0.5 + i * 2.5;
    card(s, x, 2.35, 2.25, 2.15);
    s.addShape(pres.ShapeType.ellipse, {
      x: x + 0.25, y: 2.6, w: 0.28, h: 0.28,
      fill: { color: i % 2 ? GREEN : VIOLETL }, line: { color: BG, width: 0 },
    });
    s.addText(c[0], {
      x: x + 0.25, y: 3.0, w: 1.8, h: 0.6,
      fontFace: H, fontSize: 14.5, bold: true, color: TX, margin: 0, lineSpacing: 18, valign: "top",
    });
    s.addText(c[1], {
      x: x + 0.25, y: 3.6, w: 1.8, h: 0.85,
      fontFace: H, fontSize: 11.5, color: TX2, lineSpacing: 15, margin: 0, valign: "top",
    });
  });

  card(s, 0.5, 5.05, 12.3, 1.35);
  s.addText("Millions of homes already have the skill and the phone. What they are missing is the shop.", {
    x: 0.95, y: 5.05, w: 11.4, h: 1.35,
    fontFace: H, fontSize: 19, italic: true, color: TX, valign: "middle", margin: 0,
  });

  s.addNotes("Someone who cooks, sews or teaches at home has everything except a way to take orders. The same product serves all of them with different words on the screen.");
}

/* ───────────────────────── 5 · The ask ───────────────────────── */
{
  const s = dark();
  title(s, "What we would like from you");

  const asks = [
    ["Suggestions", "Tell us what is missing, and what would not survive contact with a real kitchen."],
    ["How to proceed", "Where should we start — one city, one category, or one chain of kitchens?"],
    ["Referrals", "One introduction to a kitchen owner is worth more to us than a hundred cold calls."],
    ["Investment", "To take this from a working product to a city full of kitchens running on it."],
  ];
  asks.forEach(function (a, i) {
    const x = i % 2 ? 6.95 : 0.75;
    const y = i < 2 ? 2.0 : 4.3;
    card(s, x, y, 5.6, 2.05);
    numDot(s, x + 0.35, y + 0.35, i + 1);
    s.addText(a[0], {
      x: x + 1.05, y: y + 0.33, w: 4.2, h: 0.45,
      fontFace: H, fontSize: 19, bold: true, color: TX, valign: "middle", margin: 0,
    });
    s.addText(a[1], {
      x: x + 0.35, y: y + 0.95, w: 4.95, h: 0.85,
      fontFace: H, fontSize: 13, color: TX2, lineSpacing: 18, margin: 0, valign: "top",
    });
  });

  s.addNotes("Rank these honestly: the suggestions and the referrals are worth more to us right now than the cheque.");
}

/* ───────────────────────── 6 · End ───────────────────────── */
{
  const s = dark();
  wordmark(s, 0.85, 2.3, 66);

  s.addText("Thank you.", {
    x: 0.9, y: 3.8, w: 7, h: 0.7,
    fontFace: H, fontSize: 30, bold: true, color: TX, margin: 0,
  });
  s.addText("We would rather hear what is wrong with this than be told it is good.", {
    x: 0.9, y: 4.55, w: 7.6, h: 0.5,
    fontFace: H, fontSize: 15, color: TX2, margin: 0,
  });
  s.addText("hello@selly.in", {
    x: 0.9, y: 5.4, w: 6, h: 0.45,
    fontFace: H, fontSize: 16, bold: true, color: GREEN, margin: 0,
  });

  const bub = [
    { x: 9.6,  y: 2.6,  w: 2.9, h: 0.65, fill: CARD,  color: TX,       t: "Can I try it?" },
    { x: 10.0, y: 3.42, w: 2.5, h: 0.65, fill: GREEN, color: "05301A", t: "Yes. Today." },
  ];
  bub.forEach(b => {
    card(s, b.x, b.y, b.w, b.h, b.fill);
    s.addText(b.t, {
      x: b.x + 0.18, y: b.y, w: b.w - 0.36, h: b.h,
      fontFace: H, fontSize: 12.5, color: b.color, valign: "middle", margin: 0,
    });
  });

  s.addNotes("Close by offering a live walkthrough on their own phone — the demo works end to end today.");
}

pres.writeFile({ fileName: "D:/Selly/pitch/Selly-Pitch.pptx" })
  .then(f => console.log("wrote", f));
