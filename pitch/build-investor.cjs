// ── Selly · investor deck ─────────────────────────────────────────────────────
// The detailed one. Where build-service.cjs deliberately withheld mechanism to
// avoid the idea being copied, this explains it: an investor cannot judge
// defensibility without seeing how the thing actually works.
//
// Two rules held throughout:
//   · No invented numbers. Every figure is either a decision we made (pricing),
//     an arithmetic consequence of one, or a clearly labelled assumption.
//   · Traction is stated at its real size. One pilot kitchen is one.
//
// Build:  node build-investor.cjs
// ─────────────────────────────────────────────────────────────────────────────

const pptxgen = require("pptxgenjs");

// ── Palette — same family as the service deck ────────────────────────────────
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
pres.layout = "LAYOUT_WIDE";               // 13.33 x 7.5
pres.author = "Selly";
pres.title  = "Selly — investor deck";

const dark = () => { const s = pres.addSlide(); s.background = { color: BG }; return s; };

// ── Shared furniture ─────────────────────────────────────────────────────────

function card(s, x, y, w, h, fill, edge) {
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.12,
    fill: { color: fill || CARD },
    line: { color: edge || LINE, width: 1 },
  });
}

function dot(s, x, y, n, color) {
  s.addShape(pres.ShapeType.ellipse, {
    x, y, w: 0.42, h: 0.42,
    fill: { color: color || VIOLET }, line: { color: color || VIOLET, width: 0 },
  });
  s.addText(String(n), {
    x, y, w: 0.42, h: 0.42, align: "center", valign: "middle",
    fontFace: H, fontSize: 14, bold: true, color: "FFFFFF", margin: 0,
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
    x: 0.7, y: 0.52, w: 12.0, h: 0.82,
    fontFace: H, fontSize: 30, bold: true, color: TX, valign: "top", margin: 0,
  });
}

function kicker(s, text, color) {
  s.addText(text, {
    x: 0.7, y: 1.36, w: 12.0, h: 0.5,
    fontFace: H, fontSize: 15.5, italic: true, color: color || VIOLETL, valign: "top", margin: 0,
  });
}

function foot(s, text) {
  s.addText(text, {
    x: 0.7, y: 6.94, w: 12.0, h: 0.32,
    fontFace: H, fontSize: 10, color: TX3, valign: "top", margin: 0,
  });
}

/** A labelled statistic — the number first, because that is what gets read. */
function stat(s, x, y, w, value, label, color) {
  s.addText(value, {
    x, y, w, h: 0.62, fontFace: H, fontSize: 30, bold: true,
    color: color || TX, valign: "middle", margin: 0,
  });
  s.addText(label, {
    x, y: y + 0.6, w, h: 0.78, fontFace: H, fontSize: 11.5,
    color: TX2, lineSpacing: 15, valign: "top", margin: 0,
  });
}

const CONF = "Selly  ·  Confidential  ·  Investor deck 2026";

/* ═════════════════════ 1 · Title ═════════════════════ */
{
  const s = dark();
  wordmark(s, 0.7, 0.7, 30);

  s.addText("The ordering rail\ncloud kitchens\nactually own.", {
    x: 0.7, y: 2.0, w: 8.2, h: 2.7,
    fontFace: H, fontSize: 42, bold: true, color: TX,
    lineSpacing: 50, charSpacing: -0.5, valign: "top", margin: 0,
  });

  s.addText(
    "Direct ordering, delivery and payment for cloud kitchens — reaching every " +
    "customer with a phone, without an app to install and without a platform in " +
    "the middle taking a share of every plate.",
    { x: 0.73, y: 4.85, w: 7.9, h: 1.2,
      fontFace: H, fontSize: 14.5, color: TX2, lineSpacing: 22, valign: "top", margin: 0 }
  );

  const bubbles = [
    { y: 2.05, fill: CARD,   color: TX2,      t: "You:  I want to order" },
    { y: 3.0,  fill: VIOLET, color: "FFFFFF", t: "Selly:  Kitchens near you →" },
    { y: 3.95, fill: CARD,   color: TX2,      t: "Order 09072 confirmed. Rs 150" },
    { y: 4.9,  fill: CARD2,  color: GREEN,    t: "Delivered. Tell us how it was →" },
  ];
  bubbles.forEach((b) => {
    card(s, 9.15, b.y, 3.45, 0.7, b.fill, b.fill === VIOLET ? VIOLET : LINE);
    s.addText(b.t, {
      x: 9.4, y: b.y, w: 3.0, h: 0.7,
      fontFace: H, fontSize: 11.5, color: b.color, valign: "middle", margin: 0,
    });
  });

  foot(s, CONF);
  s.addNotes(
    "Open on the sentence, not the software. A cloud kitchen today rents its customers " +
    "from somebody else and pays rent on every order forever. We sell them a front door " +
    "they own. The four bubbles on the right ARE the product — that is the whole journey."
  );
}

/* ═════════════════════ 2 · Problem ═════════════════════ */
{
  const s = dark();
  title(s, "Cloud kitchens are growing. Their margins are not.");
  kicker(s, "Three problems, and not one of them is about the food.", TX2);

  const items = [
    { n: 1, c: CORAL, h: "The commission",
      b: "Aggregator commissions run at roughly a quarter to a third of order value, " +
         "before ad spend and discounts. On a Rs 400 order the kitchen can hand over " +
         "Rs 100 or more — on food it cooked, in a kitchen it rents, with staff it pays." },
    { n: 2, c: AMBER, h: "No customer",
      b: "The kitchen never learns who ordered, what they liked, or when they will be " +
         "back. That record is the single most valuable asset a food business can have, " +
         "and it sits on somebody else's server." },
    { n: 3, c: VIOLET, h: "No control",
      b: "A ranking change, a policy update, or a new fee can cut order flow overnight. " +
         "There is no warning and no appeal. A business built entirely on that is not " +
         "really the founder's business." },
  ];

  items.forEach((it, i) => {
    const x = 0.7 + i * 4.1;
    card(s, x, 2.15, 3.75, 3.5);
    dot(s, x + 0.4, 2.55, it.n, it.c);
    s.addText(it.h, {
      x: x + 0.4, y: 3.2, w: 3.0, h: 0.42,
      fontFace: H, fontSize: 17, bold: true, color: TX, valign: "top", margin: 0,
    });
    s.addText(it.b, {
      x: x + 0.4, y: 3.7, w: 3.0, h: 1.75,
      fontFace: H, fontSize: 11.5, color: TX2, lineSpacing: 16, valign: "top", margin: 0,
    });
  });

  s.addText(
    "The kitchen carries every cost of the meal and keeps the smaller half of the money.",
    { x: 0.7, y: 5.95, w: 12.0, h: 0.5,
      fontFace: H, fontSize: 15, italic: true, color: VIOLETL, valign: "top", margin: 0 }
  );

  foot(s, CONF);
  s.addNotes(
    "Do not rush this slide. Point three is the one that lands with operators — ask any " +
    "kitchen owner about a ranking change and you will get a story. Commission is the " +
    "number; control is the fear."
  );
}

/* ═════════════════════ 3 · Why the obvious fixes fail ═════════════════════ */
{
  const s = dark();
  title(s, "Going direct is obvious. Nobody has made it work.");
  kicker(s, "Four attempts, and four reasons each one stalls.", TX2);

  const rows = [
    { h: "Build your own app",
      b: "Nobody installs an app for one kitchen. The cost of winning an install exceeds " +
         "what a single kitchen earns from that customer — the maths never closes." },
    { h: "WhatsApp Business API",
      b: "Meta owns the channel, prices it per conversation, approves every template and " +
         "can revoke access. It replaces one landlord with another." },
    { h: "Instagram DMs and phone calls",
      b: "Human, unscalable, no record and no payment. Orders get lost at eleven at night " +
         "when the kitchen is busiest." },
    { h: "A website nobody visits",
      b: "A link with no way to reach the customer is a shop on an empty street. " +
         "Distribution is the problem, not the page." },
  ];

  rows.forEach((r, i) => {
    const y = 2.1 + i * 1.15;
    card(s, 0.7, y, 11.9, 1.0);
    s.addText(r.h, {
      x: 1.05, y, w: 3.3, h: 1.0,
      fontFace: H, fontSize: 14.5, bold: true, color: CORAL, valign: "middle", margin: 0,
    });
    s.addText(r.b, {
      x: 4.5, y, w: 7.85, h: 1.0,
      fontFace: H, fontSize: 12, color: TX2, lineSpacing: 16, valign: "middle", margin: 0,
    });
  });

  s.addText(
    "Each fails on distribution — not on product. So distribution is what we built.",
    { x: 0.7, y: 6.85, w: 12.0, h: 0.45,
      fontFace: H, fontSize: 14, italic: true, color: VIOLETL, valign: "top", margin: 0 }
  );

  s.addNotes(
    "This slide pre-empts the first three questions an investor will ask. Say plainly that " +
    "we are not claiming a better app — we are claiming a better way of reaching people."
  );
}

/* ═════════════════════ 4 · The insight ═════════════════════ */
{
  const s = dark();
  title(s, "The insight: separate reach from screen.");
  kicker(s, "A message cannot carry a menu. It can carry the door to one.");

  card(s, 0.7, 2.1, 5.8, 3.5, CARD);
  s.addText("MESSAGE  =  REACH", {
    x: 1.1, y: 2.4, w: 5.0, h: 0.45,
    fontFace: H, fontSize: 15, bold: true, color: AMBER, charSpacing: 1, valign: "top", margin: 0,
  });
  s.addText(
    "Every phone in India can receive a text. No app, no account, no data plan, no " +
    "smartphone required.\n\n" +
    "What we send is always a fixed, pre-registered sentence with one link in it. " +
    "It never changes, so it always clears the carriers.",
    { x: 1.1, y: 3.0, w: 5.0, h: 2.3,
      fontFace: H, fontSize: 12.5, color: TX2, lineSpacing: 18, valign: "top", margin: 0 }
  );

  card(s, 6.8, 2.1, 5.8, 3.5, CARD);
  s.addText("WEB  =  SCREEN", {
    x: 7.2, y: 2.4, w: 5.0, h: 0.45,
    fontFace: H, fontSize: 15, bold: true, color: VIOLETL, charSpacing: 1, valign: "top", margin: 0,
  });
  s.addText(
    "Behind that link is a real page: live menu, portions, add-ons, cart, payment, " +
    "ratings.\n\n" +
    "Prices change the moment the kitchen changes them. A dish sells out and it is gone " +
    "from the page. None of that could ever survive inside a message.",
    { x: 7.2, y: 3.0, w: 5.0, h: 2.3,
      fontFace: H, fontSize: 12.5, color: TX2, lineSpacing: 18, valign: "top", margin: 0 }
  );

  s.addText(
    "This is why 'ordering over SMS' has never worked, and why this does. We stopped " +
    "trying to put the shop inside the message.",
    { x: 0.7, y: 5.95, w: 11.9, h: 0.8,
      fontFace: H, fontSize: 15, italic: true, color: TX, lineSpacing: 21, valign: "top", margin: 0 }
  );

  foot(s, CONF);
  s.addNotes(
    "This is the slide the whole deck turns on. If they understand this one, everything " +
    "after it is detail. Say it in one breath: the message is the doorbell, the web page " +
    "is the shop."
  );
}

/* ═════════════════════ 5 · Customer journey ═════════════════════ */
{
  const s = dark();
  title(s, "What a customer actually does.");
  kicker(s, "Five steps. No app, no account, no password — ever.", TX2);

  const steps = [
    { n: 1, h: "Texts our number",
      b: "Anything at all. This is the only thing they have to know." },
    { n: 2, h: "Sets where they are",
      b: "One link, once. Types their area — Baner, Kothrud — or shares a pin. Either works." },
    { n: 3, h: "Sees kitchens near them",
      b: "Ranked by distance where we can measure it, by area where we cannot. Open kitchens first." },
    { n: 4, h: "Orders and pays",
      b: "Live menu, portions, add-ons. UPI or cash on delivery." },
    { n: 5, h: "Eats, then rates it",
      b: "Confirmation, then a rating link when the kitchen marks it delivered." },
  ];

  steps.forEach((st, i) => {
    const x = 0.7 + i * 2.42;
    card(s, x, 2.15, 2.22, 3.3);
    dot(s, x + 0.3, 2.5, st.n, i === 4 ? GREEN : VIOLET);
    s.addText(st.h, {
      x: x + 0.3, y: 3.12, w: 1.7, h: 0.75,
      fontFace: H, fontSize: 13.5, bold: true, color: TX, lineSpacing: 17, valign: "top", margin: 0,
    });
    s.addText(st.b, {
      x: x + 0.3, y: 3.92, w: 1.72, h: 1.4,
      fontFace: H, fontSize: 10.5, color: TX2, lineSpacing: 14, valign: "top", margin: 0,
    });
  });

  s.addText(
    "The second order is shorter. We remember the number that texted us, so the link " +
    "already knows their name and address and goes straight to kitchens.",
    { x: 0.7, y: 5.75, w: 11.9, h: 0.8,
      fontFace: H, fontSize: 13.5, color: VIOLETL, lineSpacing: 19, valign: "top", margin: 0 }
  );

  foot(s, CONF);
  s.addNotes(
    "Walk this while the demo phone is on screen. The line that sells it is the last one: " +
    "repeat ordering is two taps, and repeat is the entire economics of food."
  );
}

/* ═════════════════════ 6 · Kitchen side ═════════════════════ */
{
  const s = dark();
  title(s, "What the kitchen gets.");
  kicker(s, "One screen for the whole operation — not a dashboard nobody opens.", TX2);

  const feats = [
    { h: "Live orders",     b: "Every order in one queue, from confirmed through to delivered." },
    { h: "Menu control",    b: "Prices, half and full portions, add-ons, sold-out toggles. Changes are live instantly." },
    { h: "Trading hours",   b: "The page refuses orders outside opening hours automatically. No 3 a.m. surprises." },
    { h: "Delivery",        b: "A token per packet. The rider opens address, Maps and a handover OTP — no app to install." },
    { h: "Ratings",         b: "Feedback tied to a real order, so it cannot be faked or brigaded." },
    { h: "Money",           b: "Payments land in the kitchen's own UPI account. Billing shows exactly which orders were counted." },
  ];

  feats.forEach((f, i) => {
    const x = 0.7 + (i % 3) * 4.1;
    const y = 2.15 + Math.floor(i / 3) * 2.1;
    card(s, x, y, 3.75, 1.9);
    s.addText(f.h, {
      x: x + 0.35, y: y + 0.25, w: 3.1, h: 0.4,
      fontFace: H, fontSize: 15, bold: true, color: VIOLETL, valign: "top", margin: 0,
    });
    s.addText(f.b, {
      x: x + 0.35, y: y + 0.72, w: 3.1, h: 1.0,
      fontFace: H, fontSize: 11, color: TX2, lineSpacing: 15, valign: "top", margin: 0,
    });
  });

  s.addText(
    "And the customer list is theirs. Every number that ever ordered, on their side of the table.",
    { x: 0.7, y: 6.5, w: 11.9, h: 0.45,
      fontFace: H, fontSize: 13.5, italic: true, color: GREEN, valign: "top", margin: 0 }
  );

  s.addNotes(
    "The closing line answers the 'why would a kitchen switch' question before it is asked. " +
    "Owning the customer record is the thing aggregators structurally cannot offer."
  );
}

/* ═════════════════════ 7 · Why SMS ═════════════════════ */
{
  const s = dark();
  title(s, "Why SMS, in a country full of smartphones.");
  kicker(s, "Three reasons, and the third is the one that matters most.");

  const cols = [
    { h: "Reach", c: AMBER,
      b: "Every mobile phone sold in India receives SMS. No install, no account, no data, " +
         "no minimum handset. It reaches the customer who will never download an app and " +
         "the one whose phone is full." },
    { h: "Cost", c: VIOLETL,
      b: "Roughly Rs 0.15 to Rs 0.25 per message. About three messages per order. " +
         "Under a rupee of delivery cost to earn Rs 20." },
    { h: "Control", c: GREEN,
      b: "No platform sits between us and the customer. There is no ranking, no algorithm " +
         "and no company that can change the terms or switch us off. The carriers are a " +
         "regulated utility, not a competitor." },
  ];

  cols.forEach((c, i) => {
    const x = 0.7 + i * 4.1;
    card(s, x, 2.1, 3.75, 3.05);
    s.addText(c.h, {
      x: x + 0.4, y: 2.4, w: 3.0, h: 0.5,
      fontFace: H, fontSize: 19, bold: true, color: c.c, valign: "top", margin: 0,
    });
    s.addText(c.b, {
      x: x + 0.4, y: 2.98, w: 3.0, h: 2.0,
      fontFace: H, fontSize: 11.5, color: TX2, lineSpacing: 16, valign: "top", margin: 0,
    });
  });

  card(s, 0.7, 5.4, 11.9, 1.15, CARD2);
  s.addText(
    [{ text: "The regulation is a feature.  ", options: { bold: true, color: TX } },
     { text: "India's DLT regime requires every commercial sender to register the company, " +
             "the sender ID, each message template word for word, and the domain of any link. " +
             "It takes weeks. That paperwork is a barrier to us once, and to every imitator " +
             "forever after.", options: { color: TX2 } }],
    { x: 1.05, y: 5.4, w: 11.2, h: 1.15,
      fontFace: H, fontSize: 12, lineSpacing: 17, valign: "middle", margin: 0 }
  );

  foot(s, CONF);
  s.addNotes(
    "Expect pushback: 'isn't SMS dead?' Answer: SMS is dead for marketing and completely " +
    "alive for transactions — OTPs, bank alerts, delivery updates. We are transactional."
  );
}

/* ═════════════════════ 8 · Payments ═════════════════════ */
{
  const s = dark();
  title(s, "The money never touches us.");
  kicker(s, "A deliberate architectural choice, not a limitation.");

  card(s, 0.7, 2.1, 5.8, 2.5);
  s.addText("How it works", {
    x: 1.1, y: 2.38, w: 5.0, h: 0.42,
    fontFace: H, fontSize: 16, bold: true, color: VIOLETL, valign: "top", margin: 0 });
  s.addText(
    "The customer pays the kitchen directly by UPI, or in cash at the door. Selly issues " +
    "the request and records the result. Funds move from customer to kitchen and never " +
    "pass through an account of ours.",
    { x: 1.1, y: 2.9, w: 5.0, h: 1.5,
      fontFace: H, fontSize: 12, color: TX2, lineSpacing: 17, valign: "top", margin: 0 });

  card(s, 6.8, 2.1, 5.8, 2.5);
  s.addText("Why it matters", {
    x: 7.2, y: 2.38, w: 5.0, h: 0.42,
    fontFace: H, fontSize: 16, bold: true, color: GREEN, valign: "top", margin: 0 });
  s.addText(
    "Holding customer money makes you a payment aggregator under RBI rules, with the " +
    "licensing, capital and audit that follow. Staying out of the flow keeps us a software " +
    "company — and removes settlement risk, float and chargebacks entirely.",
    { x: 7.2, y: 2.9, w: 5.0, h: 1.5,
      fontFace: H, fontSize: 12, color: TX2, lineSpacing: 17, valign: "top", margin: 0 });

  const gains = [
    ["Zero", "gateway fees deducted\nfrom the kitchen"],
    ["Instant", "settlement — UPI lands\nin seconds, not T+2"],
    ["None", "of our capital tied up\nas float or reserve"],
    ["Simple", "compliance: no PA licence,\nno customer funds held"],
  ];
  gains.forEach((g, i) => {
    const x = 0.7 + i * 3.05;
    card(s, x, 4.85, 2.8, 1.75, CARD2);
    stat(s, x + 0.32, 4.98, 2.2, g[0], g[1], i === 0 ? GREEN : TX);
  });

  foot(s, CONF);
  s.addNotes(
    "An investor with fintech experience will immediately test whether we have accidentally " +
    "become a PA. The answer is no, by design, and this slide is the proof. It is also why " +
    "we can charge a flat fee rather than a percentage."
  );
}

/* ═════════════════════ 9 · Business model ═════════════════════ */
{
  const s = dark();
  title(s, "How we make money.");
  kicker(s, "A flat fee per order. Never a share of the plate.");

  card(s, 0.7, 2.1, 5.8, 2.15, CARD2, VIOLET);
  s.addText("Rs 1,000", {
    x: 1.1, y: 2.35, w: 5.0, h: 0.7,
    fontFace: H, fontSize: 34, bold: true, color: TX, valign: "middle", margin: 0 });
  s.addText("once, to get set up — menu loaded, ordering page live, staff shown how it works.", {
    x: 1.1, y: 3.1, w: 5.0, h: 0.95,
    fontFace: H, fontSize: 12, color: TX2, lineSpacing: 17, valign: "top", margin: 0 });

  card(s, 6.8, 2.1, 5.8, 2.15, CARD2, GREEN);
  s.addText("Rs 20", {
    x: 7.2, y: 2.35, w: 5.0, h: 0.7,
    fontFace: H, fontSize: 34, bold: true, color: GREEN, valign: "middle", margin: 0 });
  s.addText("per completed order. Not per attempt, not per cancellation — per plate that " +
            "actually reached somebody.", {
    x: 7.2, y: 3.1, w: 5.0, h: 0.95,
    fontFace: H, fontSize: 12, color: TX2, lineSpacing: 17, valign: "top", margin: 0 });

  s.addTable(
    [
      [{ text: "On a Rs 400 order", options: { bold: true, color: TX, fill: { color: CARD } } },
       { text: "Aggregator",        options: { bold: true, color: CORAL, fill: { color: CARD } } },
       { text: "Selly",             options: { bold: true, color: GREEN, fill: { color: CARD } } }],
      ["What the platform takes", "Roughly Rs 100 – 120", "Rs 20"],
      ["Basis", "A percentage — it grows with the bill", "Flat — it does not"],
      ["Who owns the customer", "The platform", "The kitchen"],
      ["Who sets the price", "Pressured by discounting", "The kitchen"],
    ],
    { x: 0.7, y: 4.55, w: 11.9, colW: [4.3, 4.0, 3.6],
      rowH: 0.38, fontFace: H, fontSize: 11.5, color: TX2,
      fill: { color: CARD2 }, border: { type: "solid", color: LINE, pt: 1 },
      valign: "middle", margin: 6 }
  );

  s.addText("Commission figures are the publicly discussed range for Indian food aggregators, " +
            "before advertising and discount funding.", {
    x: 0.7, y: 6.72, w: 11.9, h: 0.35,
    fontFace: H, fontSize: 9.5, italic: true, color: TX3, valign: "top", margin: 0 });

  s.addNotes(
    "The flat fee is the strategic choice, not just a price. It means our revenue does not " +
    "grow when the kitchen raises prices — which is exactly why a kitchen trusts it. Be " +
    "ready to defend it: yes, we leave money on the table on large orders. That is the point."
  );
}

/* ═════════════════════ 10 · Unit economics ═════════════════════ */
{
  const s = dark();
  title(s, "Unit economics.");
  kicker(s, "The whole cost of serving an order is the messages we send about it.");

  const line = [
    ["Revenue per completed order",           "Rs 20.00", GREEN],
    ["Messages per order (welcome, confirm, delivered)", "3", TX2],
    ["SMS cost at Rs 0.20 each",              "– Rs 0.60", CORAL],
    ["Database and hosting, per order",        "negligible at this volume", TX2],
    ["Gross contribution per order",           "≈ Rs 19.40", GREEN],
  ];

  line.forEach((l, i) => {
    const y = 2.1 + i * 0.62;
    const isTotal = i === line.length - 1;
    card(s, 0.7, y, 7.4, 0.54, isTotal ? CARD2 : CARD, isTotal ? GREEN : LINE);
    s.addText(l[0], {
      x: 1.05, y, w: 4.9, h: 0.54,
      fontFace: H, fontSize: 11.5, bold: isTotal, color: isTotal ? TX : TX2,
      valign: "middle", margin: 0 });
    s.addText(l[1], {
      x: 6.0, y, w: 1.85, h: 0.54, align: "right",
      fontFace: H, fontSize: 12, bold: true, color: l[2], valign: "middle", margin: 0 });
  });

  card(s, 8.4, 2.1, 4.2, 3.16, CARD2);
  s.addText("What this means", {
    x: 8.75, y: 2.35, w: 3.5, h: 0.4,
    fontFace: H, fontSize: 15, bold: true, color: VIOLETL, valign: "top", margin: 0 });
  s.addText(
    "Gross margin is roughly 97%, because we sell software and buy only messages.\n\n" +
    "There is no fleet, no kitchen, no inventory and no discount funding. Costs scale with " +
    "orders, not with headcount.\n\n" +
    "The Rs 1,000 onboarding fee covers the one genuinely manual step — getting a kitchen " +
    "set up — so growth does not have to be subsidised.",
    { x: 8.75, y: 2.85, w: 3.5, h: 2.3,
      fontFace: H, fontSize: 11, color: TX2, lineSpacing: 15.5, valign: "top", margin: 0 });

  card(s, 0.7, 5.5, 11.9, 1.05, CARD);
  s.addText(
    [{ text: "Assumptions stated plainly.  ", options: { bold: true, color: AMBER } },
     { text: "Rs 0.20 per SMS is mid-range for an Indian aggregator on transactional volume " +
             "and will fall with scale. Three messages per order is our current design. " +
             "Neither is a forecast — both are inputs you should push on.",
       options: { color: TX2 } }],
    { x: 1.05, y: 5.5, w: 11.2, h: 1.05,
      fontFace: H, fontSize: 11, lineSpacing: 15.5, valign: "middle", margin: 0 });

  foot(s, CONF);
  s.addNotes(
    "Naming the assumptions before they do buys enormous credibility. If asked for LTV, be " +
    "honest: we do not have enough operating history to state a retention curve yet, and a " +
    "made-up one is worse than none."
  );
}

/* ═════════════════════ 11 · Where we are ═════════════════════ */
{
  const s = dark();
  title(s, "Where we are today.");
  kicker(s, "Stated at its real size.", TX2);

  const built = [
    "Customer ordering — discovery, live menu, portions, add-ons, cart, UPI and cash",
    "Kitchen app — orders, menu, trading hours, delivery, ratings, billing",
    "Rider handover — packet token, address, Maps, delivery OTP",
    "Ratings tied to a real order, and a complaints and refunds flow",
    "The messaging bridge, built against registered templates and ready to switch on",
  ];
  const pending = [
    "DLT registration applied for — awaiting carrier approval",
    "One pilot kitchen live: Ghar ka Khaana, Baner, Pune",
    "Rate limiting, before any public campaign",
    "No revenue yet. We are pre-first-rupee and say so",
  ];

  card(s, 0.7, 2.1, 5.85, 4.2);
  s.addText("Built and verified end to end", {
    x: 1.05, y: 2.35, w: 5.1, h: 0.4,
    fontFace: H, fontSize: 15, bold: true, color: GREEN, valign: "top", margin: 0 });
  built.forEach((b, i) => {
    s.addText("✓   " + b, {
      x: 1.05, y: 2.9 + i * 0.68, w: 5.15, h: 0.62,
      fontFace: H, fontSize: 11, color: TX2, lineSpacing: 15, valign: "top", margin: 0 });
  });

  card(s, 6.75, 2.1, 5.85, 4.2);
  s.addText("Honest gaps", {
    x: 7.1, y: 2.35, w: 5.1, h: 0.4,
    fontFace: H, fontSize: 15, bold: true, color: AMBER, valign: "top", margin: 0 });
  pending.forEach((b, i) => {
    s.addText("—   " + b, {
      x: 7.1, y: 2.9 + i * 0.68, w: 5.15, h: 0.62,
      fontFace: H, fontSize: 11, color: TX2, lineSpacing: 15, valign: "top", margin: 0 });
  });

  s.addText(
    "A full order has been placed through the live system — texted in, matched by area, " +
    "paid, delivered and rated. The product is real. The scale is not, yet.",
    { x: 0.7, y: 6.45, w: 11.9, h: 0.5,
      fontFace: H, fontSize: 13, italic: true, color: VIOLETL, valign: "top", margin: 0 });

  s.addNotes(
    "Do not dress this up. An investor who catches one inflated traction claim discounts " +
    "everything else you said. 'One pilot kitchen and no revenue' delivered calmly is far " +
    "stronger than a vague number, and the working demo does the persuading."
  );
}

/* ═════════════════════ 12 · Expansion — the phases ═════════════════════ */
{
  const s = dark();
  title(s, "How we expand.");
  kicker(s, "Deliberately sequenced. Each phase is funded by the one before it.");

  const phases = [
    { n: 1, c: GREEN,   h: "Cloud kitchens, Pune",
      b: "Direct sales, locality by locality. Prove repeat ordering and a kitchen that " +
         "renews without being asked." },
    { n: 2, c: VIOLET,  h: "The printed doorway",
      b: "A QR code on the packaging, the flyer, the shutter. Every delivered meal becomes " +
         "an invitation to order direct next time — paid for by the aggregator order that " +
         "carried it." },
    { n: 3, c: VIOLETL, h: "Standing orders",
      b: "Monthly customer packages for scheduled meals — tiffin, daily lunch. Predictable " +
         "demand for the kitchen, predictable revenue for us." },
    { n: 4, c: AMBER,   h: "Adjacent kitchens",
      b: "Bakeries and cafés. Same rail, same billing, different vocabulary — already " +
         "supported in the product." },
    { n: 5, c: CORAL,   h: "City by city",
      b: "Repeat the locality playbook. Nothing about it is Pune-specific." },
  ];

  phases.forEach((p, i) => {
    const y = 2.1 + i * 0.94;
    card(s, 0.7, y, 11.9, 0.82);
    dot(s, 1.0, y + 0.2, p.n, p.c);
    s.addText(p.h, {
      x: 1.65, y, w: 3.1, h: 0.82,
      fontFace: H, fontSize: 14, bold: true, color: TX, valign: "middle", margin: 0 });
    s.addText(p.b, {
      x: 4.9, y, w: 7.45, h: 0.82,
      fontFace: H, fontSize: 11, color: TX2, lineSpacing: 14.5, valign: "middle", margin: 0 });
  });

  foot(s, CONF);
  s.addNotes(
    "Phase 2 is the cleverest part and worth pausing on: the aggregator pays to acquire the " +
    "customer, and the packaging converts them to direct. We ride their delivery fleet to " +
    "win the repeat order."
  );
}

/* ═════════════════════ 13 · The density flywheel ═════════════════════ */
{
  const s = dark();
  title(s, "Why this compounds locality by locality.");
  kicker(s, "The unit of growth is an area, not a city.");

  const ring = [
    { h: "A kitchen joins",     b: "Its own customers get a direct way to order." },
    { h: "Those customers stay", b: "Their details are saved, so re-ordering is two taps." },
    { h: "They search their area", b: "And now see the other kitchens nearby." },
    { h: "Those kitchens get orders", b: "From customers they did not have to acquire." },
    { h: "So more kitchens join", b: "Because the demand is already standing there." },
  ];

  ring.forEach((r, i) => {
    const x = 0.7 + i * 2.42;
    card(s, x, 2.25, 2.22, 2.25);
    s.addText(String(i + 1), {
      x: x + 0.3, y: 2.45, w: 1.7, h: 0.42,
      fontFace: H, fontSize: 13, bold: true, color: VIOLETL, valign: "top", margin: 0 });
    s.addText(r.h, {
      x: x + 0.3, y: 2.88, w: 1.72, h: 0.72,
      fontFace: H, fontSize: 12.5, bold: true, color: TX, lineSpacing: 16, valign: "top", margin: 0 });
    s.addText(r.b, {
      x: x + 0.3, y: 3.62, w: 1.72, h: 0.8,
      fontFace: H, fontSize: 10, color: TX2, lineSpacing: 13, valign: "top", margin: 0 });
    if (i < 4) {
      s.addText("→", {
        x: x + 2.16, y: 3.1, w: 0.3, h: 0.4,
        fontFace: H, fontSize: 16, color: TX3, align: "center", valign: "middle", margin: 0 });
    }
  });

  card(s, 0.7, 4.85, 11.9, 1.65, CARD2);
  s.addText(
    [{ text: "Ten kitchens in one locality beats a hundred spread across a city.  ",
       options: { bold: true, color: TX } },
     { text: "A customer in Baner does not care that we have kitchens in Kothrud. Density " +
             "in their own area is the only thing that makes the list worth opening — which " +
             "is why we match on locality rather than a radius drawn on a map, and why we " +
             "sell street by street rather than spreading thin.",
       options: { color: TX2 } }],
    { x: 1.05, y: 4.85, w: 11.2, h: 1.65,
      fontFace: H, fontSize: 12, lineSpacing: 17, valign: "middle", margin: 0 });

  foot(s, CONF);
  s.addNotes(
    "This is the answer to 'is this just a tool, or a network?' It starts as a tool for one " +
    "kitchen and becomes a network once an area fills in. The tool has to be worth buying on " +
    "day one regardless — and it is, because of the commission saved."
  );
}

/* ═════════════════════ 14 · Sizing ═════════════════════ */
{
  const s = dark();
  title(s, "What the model is worth, built from the bottom up.");
  kicker(s, "Our own arithmetic, not a market report. Every input is challengeable.");

  const scen = [
    { h: "One locality",  k: "25 kitchens",   o: "15 orders/day",
      m: "Rs 2.3 lakh", y: "per month", c: VIOLETL },
    { h: "One city",      k: "400 kitchens",  o: "15 orders/day",
      m: "Rs 36 lakh",  y: "per month", c: VIOLET },
    { h: "Five cities",   k: "2,000 kitchens", o: "15 orders/day",
      m: "Rs 18 crore", y: "per year",  c: GREEN },
  ];

  scen.forEach((sc, i) => {
    const x = 0.7 + i * 4.1;
    card(s, x, 2.1, 3.75, 3.1);
    s.addText(sc.h, {
      x: x + 0.4, y: 2.35, w: 3.0, h: 0.4,
      fontFace: H, fontSize: 15, bold: true, color: sc.c, valign: "top", margin: 0 });
    s.addText(sc.k + "\n" + sc.o, {
      x: x + 0.4, y: 2.85, w: 3.0, h: 0.85,
      fontFace: H, fontSize: 12, color: TX2, lineSpacing: 17, valign: "top", margin: 0 });
    s.addText(sc.m, {
      x: x + 0.4, y: 3.85, w: 3.0, h: 0.6,
      fontFace: H, fontSize: 26, bold: true, color: TX, valign: "middle", margin: 0 });
    s.addText(sc.y + ", at Rs 20 per order", {
      x: x + 0.4, y: 4.45, w: 3.0, h: 0.5,
      fontFace: H, fontSize: 10.5, color: TX3, valign: "top", margin: 0 });
  });

  card(s, 0.7, 5.45, 11.9, 1.3, CARD);
  s.addText(
    [{ text: "Read these as arithmetic, not forecasts.  ", options: { bold: true, color: AMBER } },
     { text: "They show what the pricing produces at given volumes — nothing more. " +
             "Fifteen orders a day is a modest kitchen; onboarding fees are excluded; " +
             "and none of it happens without the retention we have not yet proven. " +
             "The honest headline is that the per-order fee reaches meaningful revenue " +
             "at kitchen counts that a direct sales team can actually reach.",
       options: { color: TX2 } }],
    { x: 1.05, y: 5.45, w: 11.2, h: 1.3,
      fontFace: H, fontSize: 11, lineSpacing: 15.5, valign: "middle", margin: 0 });

  s.addNotes(
    "If asked for TAM, resist quoting a research figure you cannot defend. Bottom-up from " +
    "your own price is more credible in the room and cannot be picked apart. Offer the " +
    "spreadsheet and let them change the inputs — that invitation is itself persuasive."
  );
}

/* ═════════════════════ 15 · Moat ═════════════════════ */
{
  const s = dark();
  title(s, "What actually stops someone copying this.");
  kicker(s, "Beginning with what does not.");

  card(s, 0.7, 2.1, 11.9, 0.95, CARD2, CORAL);
  s.addText(
    [{ text: "Not the code.  ", options: { bold: true, color: CORAL } },
     { text: "A competent team could rebuild the software in a few months. Saying otherwise " +
             "would be the least credible thing in this deck. The defensibility is everywhere else.",
       options: { color: TX2 } }],
    { x: 1.05, y: 2.1, w: 11.2, h: 0.95,
      fontFace: H, fontSize: 12, lineSpacing: 16, valign: "middle", margin: 0 });

  const moats = [
    { h: "Regulatory lead time",
      b: "Company registration, sender ID, five approved templates and domain whitelisting on " +
         "the DLT registry. Weeks of paperwork before a single message can be sent — for us " +
         "once, for every follower too." },
    { h: "Locality density",
      b: "The value to a customer is how many kitchens serve their area. A newcomer must " +
         "rebuild that street by street, against a list that is already full." },
    { h: "The customer graph",
      b: "Every number that has texted us, with saved addresses and order history. It gets " +
         "more valuable per order and cannot be bought." },
    { h: "Trust with operators",
      b: "A flat fee that never rises with the bill, and money that never passes through us. " +
         "Easy to promise, hard to copy for anyone whose model needs a percentage." },
  ];

  moats.forEach((m, i) => {
    const x = 0.7 + (i % 2) * 6.1;
    const y = 3.3 + Math.floor(i / 2) * 1.75;
    card(s, x, y, 5.75, 1.55);
    s.addText(m.h, {
      x: x + 0.4, y: y + 0.2, w: 5.0, h: 0.4,
      fontFace: H, fontSize: 14.5, bold: true, color: VIOLETL, valign: "top", margin: 0 });
    s.addText(m.b, {
      x: x + 0.4, y: y + 0.62, w: 5.0, h: 0.85,
      fontFace: H, fontSize: 10.5, color: TX2, lineSpacing: 14, valign: "top", margin: 0 });
  });

  foot(s, CONF);
  s.addNotes(
    "Opening by conceding that the code is not the moat disarms the sharpest question in the " +
    "room and makes the four real answers land as considered rather than defensive."
  );
}

/* ═════════════════════ 16 · Risks ═════════════════════ */
{
  const s = dark();
  title(s, "What could go wrong.");
  kicker(s, "The four we watch most closely, and what we do about each.", TX2);

  const risks = [
    { r: "Aggregators retaliate — de-ranking kitchens that also sell direct",
      m: "Direct ordering is not exclusive and not visible to them. A kitchen keeps both, " +
         "and we are the cheaper channel rather than the only one." },
    { r: "SMS deliverability — templates rejected, links stripped, messages silently dropped",
      m: "Templates and domain registered up front. The QR entry point delivers the identical " +
         "journey with no SMS at all, so the product works even if a message never sends." },
    { r: "Kitchens sign up and stop using it",
      m: "The onboarding fee filters for intent, and billing is per completed order — we only " +
         "earn when it is genuinely being used. Retention shows up in revenue immediately." },
    { r: "Abuse — junk orders, scripted sign-ups, cost inflation",
      m: "Rate limiting per number before any public campaign. Openly still on the list, " +
         "and it must be closed before printed distribution." },
  ];

  risks.forEach((k, i) => {
    const y = 2.1 + i * 1.2;
    card(s, 0.7, y, 11.9, 1.05);
    s.addText(k.r, {
      x: 1.05, y, w: 4.7, h: 1.05,
      fontFace: H, fontSize: 11.5, bold: true, color: CORAL, lineSpacing: 15, valign: "middle", margin: 0 });
    s.addText(k.m, {
      x: 6.0, y, w: 6.35, h: 1.05,
      fontFace: H, fontSize: 11, color: TX2, lineSpacing: 15, valign: "middle", margin: 0 });
  });

  s.addText("The largest risk is the ordinary one: that not enough kitchens want this enough " +
            "to change how they work. Only selling will answer it.", {
    x: 0.7, y: 6.95, w: 11.9, h: 0.45,
    fontFace: H, fontSize: 12, italic: true, color: VIOLETL, valign: "top", margin: 0 });

  s.addNotes(
    "Volunteering risks is a credibility move. The closing line is the one to say slowly — " +
    "it shows you know which risk is real and are not hiding behind technical ones."
  );
}

/* ═════════════════════ 17 · Next twelve months ═════════════════════ */
{
  const s = dark();
  title(s, "The next twelve months.");
  kicker(s, "What we intend to prove, in order.");

  const qs = [
    { q: "Now → 3 months", c: GREEN,
      b: "DLT approval live. Rate limiting closed. First paying kitchens in one Pune " +
         "locality. The number to watch: what share of a kitchen's orders come back direct." },
    { q: "3 → 6 months", c: VIOLETL,
      b: "Fill that locality until the nearby list is worth opening. Turn on the printed QR " +
         "so delivered packaging recruits the next customer. First retention curve." },
    { q: "6 → 9 months", c: VIOLET,
      b: "Standing orders for scheduled meals. Second and third localities using the same " +
         "playbook, run by someone who is not a founder — the test of whether it is repeatable." },
    { q: "9 → 12 months", c: AMBER,
      b: "Bakeries and cafés on the same rail. Second city. A cost-per-kitchen-acquired " +
         "number solid enough to spend against." },
  ];

  qs.forEach((q, i) => {
    const x = 0.7 + i * 3.05;
    card(s, x, 2.1, 2.8, 3.4);
    s.addShape(pres.ShapeType.roundRect, {
      x: x + 0.35, y: 2.4, w: 1.95, h: 0.38, rectRadius: 0.08,
      fill: { color: q.c }, line: { color: q.c, width: 0 } });
    s.addText(q.q, {
      x: x + 0.35, y: 2.4, w: 1.95, h: 0.38, align: "center",
      fontFace: H, fontSize: 10.5, bold: true, color: "0A0A12", valign: "middle", margin: 0 });
    s.addText(q.b, {
      x: x + 0.35, y: 3.0, w: 2.1, h: 2.3,
      fontFace: H, fontSize: 10.5, color: TX2, lineSpacing: 15, valign: "top", margin: 0 });
  });

  card(s, 0.7, 5.75, 11.9, 1.0, CARD2, VIOLET);
  s.addText(
    [{ text: "What we are raising, and for what.  ", options: { bold: true, color: TX } },
     { text: "[ amount ] to fund [ sales headcount · SMS and infrastructure · runway to " +
             "month N ]. Replace this line before the meeting.",
       options: { color: AMBER } }],
    { x: 1.05, y: 5.75, w: 11.2, h: 1.0,
      fontFace: H, fontSize: 12, lineSpacing: 16, valign: "middle", margin: 0 });

  s.addNotes(
    "FILL THE ASK IN BEFORE YOU PRESENT. It is left blank deliberately — inventing a raise " +
    "amount and a use of funds on your behalf would be the one thing in this deck you could " +
    "not defend under questioning."
  );
}

/* ═════════════════════ 18 · Close ═════════════════════ */
{
  const s = dark();
  wordmark(s, 0.7, 0.72, 26);

  s.addText("A kitchen should not have to\nrent its own customers.", {
    x: 0.7, y: 2.1, w: 8.2, h: 1.7,
    fontFace: H, fontSize: 33, bold: true, color: TX,
    lineSpacing: 44, charSpacing: -0.4, valign: "top", margin: 0 });

  s.addText(
    "We reach every phone in the country without an app, put a real shop behind every " +
    "message, take a flat twenty rupees instead of a quarter of the plate, and never touch " +
    "the money.\n\n" +
    "The product is built and working. What we need now is kitchens.",
    { x: 0.72, y: 4.0, w: 7.9, h: 2.0,
      fontFace: H, fontSize: 14, color: TX2, lineSpacing: 21, valign: "top", margin: 0 });

  const asks = [
    "Introductions to cloud kitchen operators in Pune",
    "Anyone you know who has sold software to restaurants",
    "A hard look at our retention assumptions",
    "And, if it fits, the round",
  ];
  asks.forEach((a, i) => {
    card(s, 9.0, 2.15 + i * 0.85, 3.6, 0.7, i === 3 ? CARD2 : CARD, i === 3 ? VIOLET : LINE);
    s.addText(a, {
      x: 9.3, y: 2.15 + i * 0.85, w: 3.1, h: 0.7,
      fontFace: H, fontSize: 10.5, color: i === 3 ? TX : TX2,
      lineSpacing: 13, valign: "middle", margin: 0 });
  });

  s.addText("Thank you.", {
    x: 9.0, y: 5.75, w: 3.6, h: 0.5,
    fontFace: H, fontSize: 16, color: TX2, align: "right", valign: "middle", margin: 0 });

  foot(s, CONF);
  s.addNotes(
    "Ask for the first three out loud and then stop talking. Leading with the money makes " +
    "the rest sound like courtesy; leading with advice usually gets you all four."
  );
}

pres.writeFile({ fileName: "Selly-Investor-Deck.pptx" })
  .then((f) => console.log("wrote " + f));
