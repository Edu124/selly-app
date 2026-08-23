// ── Selly · web + message demo ────────────────────────────────────────────────
// The architecture this exists to demonstrate:
//
//     WEB      is the screen  — menu, photos, cart, address. Things you look at,
//                               and things that change.
//     MESSAGE  is the reach   — "we've started cooking". Things that must arrive
//                               when nobody is looking at the screen.
//
// The interesting part is not either half on its own, it is the ROUTER between
// them: one status change, and the channel is chosen per customer at send time.
// Push if the browser gave us a subscription, WhatsApp if they arrived that way,
// SMS as the floor that always works.
//
// HONESTY ABOUT WHAT IS REAL HERE:
//   · Web push is REAL. VAPID keys, a browser subscription, a server-sent push
//     delivered to a service worker with the tab closed. Nothing is faked.
//   · SMS and WhatsApp are SIMULATED. Sending either for real needs a licensed
//     aggregator, a DLT-registered sender ID and approved templates. So instead
//     of pretending, we build the exact message, price it honestly by GSM-7
//     segment, and log it. Every simulated message is labelled as such.
//
// In memory on purpose. This is a demo, not a product.
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const webpush = require("web-push");
const fs      = require("fs");
const path    = require("path");

const PORT      = 4200;
const KEYS_FILE = path.join(__dirname, ".vapid.json");
const SMS_PAISE = 20;   // ₹0.20 per SMS segment — mid of the ₹0.15–0.25 range

// VAPID keys identify this server to the browser's push service. Persisted so a
// restart doesn't invalidate every subscription the browser already holds.
let keys;
if (fs.existsSync(KEYS_FILE)) {
  keys = JSON.parse(fs.readFileSync(KEYS_FILE, "utf8"));
} else {
  keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
}
webpush.setVapidDetails("mailto:hello@selly.in", keys.publicKey, keys.privateKey);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ── Menu ─────────────────────────────────────────────────────────────────────
// This lives on the web side precisely because it changes. A price edit here is
// live immediately. The same change over SMS would mean re-registering a DLT
// template and waiting days for approval — which is the whole argument.

const KITCHEN = { name: "Ghar Ka Khana", area: "Baner, Pune", sender: "SELLYX" };

const MENU = [
  { id: "t1", name: "Veg Thali",            price: 180, veg: true,  emoji: "🍛", tag: "Bestseller",
    desc: "2 sabzi, dal, rice, 4 roti, salad",         hue: "#f5a524" },
  { id: "m2", name: "Paneer Butter Masala", price: 260, veg: true,  emoji: "🧀", tag: "",
    desc: "Malai paneer in a slow-cooked tomato gravy", hue: "#fb7185" },
  { id: "m1", name: "Butter Chicken",       price: 320, veg: false, emoji: "🍗", tag: "Bestseller",
    desc: "Boneless, overnight marinade, mild",         hue: "#f97316" },
  { id: "m4", name: "Chicken Biryani",      price: 280, veg: false, emoji: "🍚", tag: "",
    desc: "Dum-cooked, served with raita",              hue: "#a3e635" },
  { id: "b1", name: "Butter Naan",          price: 45,  veg: true,  emoji: "🫓", tag: "",
    desc: "Tandoori, brushed with white butter",        hue: "#fcd34d" },
  { id: "b3", name: "Jeera Rice",           price: 120, veg: true,  emoji: "🍚", tag: "",
    desc: "Basmati tempered with cumin",                hue: "#93c5fd" },
];

// ── Status vocabulary — same as the real app ─────────────────────────────────
const FLOW = ["confirmed", "preparing", "out_for_delivery", "delivered"];

// ── DLT templates ────────────────────────────────────────────────────────────
// In India every commercial SMS must match a template registered on a DLT
// portal, with variables only in fixed {#var#} slots. Modelled literally here so
// the constraint is visible: the shape is frozen, only the slots move.

const DLT = {
  confirmed: {
    id: "1707169900001",
    body: "Order {#var#} confirmed at {#var#}. Total Rs {#var#}. We will update you here.",
    vars: (o) => [o.id, KITCHEN.name, String(o.total)],
  },
  preparing: {
    id: "1707169900002",
    body: "Order {#var#}: the kitchen has started cooking. Ready in about {#var#} mins.",
    vars: (o) => [o.id, String(o.etaMinutes)],
  },
  out_for_delivery: {
    id: "1707169900003",
    body: "Order {#var#} is out for delivery to {#var#}. Arriving shortly.",
    vars: (o) => [o.id, shortAddress(o.address)],
  },
  delivered: {
    id: "1707169900004",
    body: "Order {#var#} delivered. Thank you for ordering from {#var#}.",
    vars: (o) => [o.id, KITCHEN.name],
  },
};

// Delivery addresses are long and SMS is billed by the character, so the DLT
// slot gets a trimmed version. On the web side the full address is shown.
function shortAddress(a) {
  const first = String(a || "").split(",")[0].trim();
  return first.length > 28 ? first.slice(0, 27) + "." : (first || "your address");
}

function renderDlt(status, order) {
  const t = DLT[status];
  if (!t) return null;
  const values = t.vars(order);
  let i = 0;
  const filled = t.body.replace(/\{#var#\}/g, () => values[i++]);
  return { templateId: t.id, text: filled + " -" + KITCHEN.sender };
}

// ── WhatsApp copy ────────────────────────────────────────────────────────────
// Deliberately richer than the SMS. WhatsApp has no 160-character wall and no
// charset penalty for emoji, so the same event gets warmer copy. Showing both
// side by side is the point: the channel changes the message, not just the pipe.

const WA = {
  confirmed: (o) =>
    "✅ *Order #" + o.id + " confirmed*\n" + KITCHEN.name + "\n\n" +
    o.cart.map((i) => i.qty + "× " + i.name).join("\n") +
    "\n\n*Total ₹" + o.total + "*\nWe'll tell you the moment cooking starts.",
  preparing: (o) =>
    "👨‍🍳 *We've started cooking*\nOrder #" + o.id + " — ready in about " + o.etaMinutes + " minutes.",
  out_for_delivery: (o) =>
    "🛵 *On the way!*\nOrder #" + o.id + " has left the kitchen.\n📍 " + o.address,
  delivered: (o) =>
    "🎉 *Delivered — enjoy!*\nThat's order #" + o.id + " with you.\n\nHow was it? Just reply here.",
};

// ── Push copy ────────────────────────────────────────────────────────────────
// A notification is a title and one line. Anything longer gets truncated by the
// OS, so this copy is the tightest of the three.

const PUSH = {
  confirmed       : (o) => ({ title: "✅ Order confirmed",         body: "#" + o.id + " · ₹" + o.total + " · " + KITCHEN.name }),
  preparing       : (o) => ({ title: "👨‍🍳 We've started cooking", body: "Order #" + o.id + " — ready in about " + o.etaMinutes + " minutes." }),
  out_for_delivery: (o) => ({ title: "🛵 On the way!",             body: "Order #" + o.id + " has left the kitchen." }),
  delivered       : (o) => ({ title: "🎉 Delivered — enjoy!",      body: "That's order #" + o.id + " with you. Tap to rate it." }),
};

// ── SMS segment maths ────────────────────────────────────────────────────────
// Why this is in the demo at all: an SMS is 160 characters — but only 70 if it
// contains a single character outside GSM-7. One emoji, or one Hindi character,
// and the cost of every message more than doubles. Priced, not asserted.

const GSM     = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€";

function smsMeta(text) {
  const chars = Array.from(text);
  const gsm   = chars.every((c) => GSM.indexOf(c) !== -1 || GSM_EXT.indexOf(c) !== -1);
  if (gsm) {
    // Extended characters occupy two septets each.
    const len = chars.reduce((n, c) => n + (GSM_EXT.indexOf(c) !== -1 ? 2 : 1), 0);
    const seg = len <= 160 ? 1 : Math.ceil(len / 153);
    return { encoding: "GSM-7", chars: len, perSegment: len <= 160 ? 160 : 153, segments: seg };
  }
  // UCS-2: any non-GSM character forces the whole message into 16-bit encoding.
  const len = chars.length;
  const seg = len <= 70 ? 1 : Math.ceil(len / 67);
  return { encoding: "UCS-2", chars: len, perSegment: len <= 70 ? 70 : 67, segments: seg };
}

// ── State ────────────────────────────────────────────────────────────────────
const customers = new Map();  // phone -> customer
const pushSubs  = new Map();  // phone -> [subscription]
const orders    = [];         // newest last
const messages  = [];         // every outbound message, whatever the channel
let   nextId    = 1001;
let   nextMsg   = 1;

const tenDigit = (v) => String(v || "").replace(/\D/g, "").slice(-10);

function customerFor(phone, patch) {
  const key = tenDigit(phone);
  if (!key) return null;
  const existing = customers.get(key) || {
    phone: key, name: "Guest", address: "", whatsappOptIn: false, createdAt: Date.now(),
  };
  customers.set(key, Object.assign(existing, patch || {}));
  return customers.get(key);
}

// ── The router ───────────────────────────────────────────────────────────────
// The single decision this whole demo is built around. Every channel is a slot,
// not an architecture — so switching one off is a branch here, not a rewrite.
// Order matters: free and rich first, paid and plain last.

function pickChannel(phone) {
  const subs = pushSubs.get(phone) || [];
  if (subs.length) return "push";                 // free, real, rich
  const c = customers.get(phone);
  if (c && c.whatsappOptIn) return "whatsapp";    // free inside the 24h window
  return "sms";                                   // costs money, but always works
}

function logMessage(entry) {
  const row = Object.assign({ id: nextMsg++, at: Date.now() }, entry);
  messages.push(row);
  return row;
}

function sendSms(order, status, reason) {
  const built = renderDlt(status, order);
  if (!built) return logMessage({ orderId: order.id, phone: order.phone, channel: "sms", status, skipped: true });

  const meta = smsMeta(built.text);
  const cost = meta.segments * SMS_PAISE;
  console.log("[route] #" + order.id + " " + status + " → sms (simulated) · " +
              meta.segments + " seg · ₹" + (cost / 100).toFixed(2));

  return logMessage({
    orderId: order.id, phone: order.phone, channel: "sms", status,
    text: built.text, templateId: built.templateId,
    encoding: meta.encoding, chars: meta.chars, perSegment: meta.perSegment, segments: meta.segments,
    delivery: "simulated",
    note: reason
      ? "Fallback: " + reason + ". Real sending needs a DLT-registered sender ID."
      : "Real sending needs a DLT-registered sender ID and an approved template.",
    costPaise: cost,
  });
}

/**
 * Send one status update to one customer over whichever channel the router
 * picks. Returns a record of what happened — including what it cost.
 *
 * Never throws: a channel failing is a fact to report, not an exception to
 * unwind the order over.
 */
async function notify(order, status) {
  const phone   = order.phone;
  const channel = pickChannel(phone);

  if (channel === "push") {
    const copy = PUSH[status] ? PUSH[status](order) : null;
    if (!copy) return logMessage({ orderId: order.id, phone, channel, status, skipped: true });

    const list  = pushSubs.get(phone) || [];
    const stale = [];
    let   sent  = 0;

    await Promise.all(list.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify({
          title: copy.title, body: copy.body, orderId: order.id, status: status, url: "/",
        }));
        sent++;
      } catch (e) {
        // 404/410 means the browser threw the subscription away. Drop it rather
        // than retrying something that can never succeed again.
        if (e.statusCode === 404 || e.statusCode === 410) stale.push(sub.endpoint);
        console.warn("[push] failed (" + (e.statusCode || "?") + "): " + (e.body || e.message));
      }
    }));
    if (stale.length) pushSubs.set(phone, list.filter((s) => stale.indexOf(s.endpoint) === -1));

    // A push that reached nothing is not a delivered message. Fall through to
    // SMS rather than reporting a success nobody received.
    if (!sent) {
      console.log("[route] #" + order.id + " push had no live device → falling back to SMS");
      return sendSms(order, status, "push subscription was stale");
    }

    console.log("[route] #" + order.id + " " + status + " → push · " + sent + " device(s) · ₹0.00");
    return logMessage({
      orderId: order.id, phone, channel: "push", status,
      title: copy.title, text: copy.body,
      devices: sent, delivery: "real", costPaise: 0,
    });
  }

  if (channel === "whatsapp") {
    const text = WA[status] ? WA[status](order) : null;
    if (!text) return logMessage({ orderId: order.id, phone, channel, status, skipped: true });
    console.log("[route] #" + order.id + " " + status + " → whatsapp (simulated) · ₹0.00");
    return logMessage({
      orderId: order.id, phone, channel: "whatsapp", status, text: text,
      delivery: "simulated",
      note: "Free inside the 24-hour service window. Real sending needs a Meta WABA.",
      costPaise: 0,
    });
  }

  return sendSms(order, status);
}

// ── API ──────────────────────────────────────────────────────────────────────

app.get("/api/vapid", (_q, res) => res.json({ publicKey: keys.publicKey }));
app.get("/api/menu",  (_q, res) => res.json({ menu: MENU, kitchen: KITCHEN }));

/** The browser hands us a push subscription; file it against the phone number. */
app.post("/api/subscribe", (req, res) => {
  const body = req.body || {};
  const key  = tenDigit(body.phone);
  if (!key || !body.subscription) return res.status(400).json({ error: "missing phone or subscription" });

  customerFor(key);
  const list = pushSubs.get(key) || [];
  // De-dupe: the same browser re-subscribing shouldn't get two notifications.
  if (!list.some((s) => s.endpoint === body.subscription.endpoint)) list.push(body.subscription);
  pushSubs.set(key, list);
  console.log("[subscribe] " + key + " → " + list.length + " device(s)");
  res.json({ ok: true, devices: list.length, channel: pickChannel(key) });
});

/** Which channel would this customer's next message go out on, and why. */
app.get("/api/route/:phone", (req, res) => {
  const key = tenDigit(req.params.phone);
  const c   = customers.get(key);
  res.json({
    phone   : key,
    channel : pickChannel(key),
    devices : (pushSubs.get(key) || []).length,
    whatsapp: !!(c && c.whatsappOptIn),
  });
});

/** Demo control: pretend this customer arrived via WhatsApp. */
app.post("/api/route/:phone/whatsapp", (req, res) => {
  const key = tenDigit(req.params.phone);
  const c   = customerFor(key, { whatsappOptIn: !!(req.body || {}).on });
  if (!c) return res.status(400).json({ error: "bad phone" });
  res.json({ ok: true, channel: pickChannel(key), whatsapp: c.whatsappOptIn });
});

app.post("/api/orders", async (req, res) => {
  const body = req.body || {};
  if (!body.cart || !body.cart.length) return res.status(400).json({ error: "empty cart" });

  const key = tenDigit(body.phone);
  if (key.length !== 10) return res.status(400).json({ error: "need a 10-digit mobile number" });
  if (!String(body.address || "").trim()) return res.status(400).json({ error: "need a delivery address" });

  customerFor(key, { name: body.name || "Guest", address: body.address });

  const total = body.cart.reduce((s, i) => s + i.price * i.qty, 0);
  const order = {
    id     : String(nextId++),
    phone  : key,
    name   : body.name || "Guest",
    address: String(body.address).trim(),
    cart   : body.cart,
    total  : total,
    status : "confirmed",
    etaMinutes: 30,
    createdAt : Date.now(),
  };
  orders.push(order);
  console.log("[order] #" + order.id + " " + order.name + " ₹" + total + " → " + key);

  // The confirmation is itself a routed message — the first proof of the split.
  const msg = await notify(order, "confirmed");
  res.json({ ok: true, order: order, message: msg });
});

app.get("/api/orders", (_q, res) => res.json({ orders: [...orders].reverse() }));

app.get("/api/orders/:id", (req, res) => {
  const o = orders.find((x) => x.id === req.params.id);
  if (!o) return res.status(404).json({ error: "no such order" });
  res.json({ order: o, messages: messages.filter((m) => m.orderId === o.id) });
});

/** Advance an order and route the matching message. */
app.post("/api/orders/:id/status", async (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "no such order" });

  const next = FLOW[FLOW.indexOf(order.status) + 1];
  if (!next) return res.json({ ok: true, order: order, note: "already finished" });

  order.status = next;
  const msg = await notify(order, next);
  res.json({ ok: true, order: order, message: msg });
});

/** Everything ever sent — optionally just one customer's thread. */
app.get("/api/messages", (req, res) => {
  const key  = tenDigit(req.query.phone);
  const rows = key ? messages.filter((m) => m.phone === key) : messages;
  const spend = rows.reduce((s, m) => s + (m.costPaise || 0), 0);
  res.json({ messages: rows, count: rows.length, spendPaise: spend });
});

app.get("/api/customers", (_q, res) => {
  res.json({
    customers: [...customers.values()].map((c) => Object.assign({}, c, {
      devices: (pushSubs.get(c.phone) || []).length,
      channel: pickChannel(c.phone),
      orders : orders.filter((o) => o.phone === c.phone).length,
    })),
  });
});

app.get("/api/state", (_q, res) => {
  const spend = messages.reduce((s, m) => s + (m.costPaise || 0), 0);
  const byChannel = messages.reduce((acc, m) => {
    acc[m.channel] = (acc[m.channel] || 0) + 1;
    return acc;
  }, {});
  res.json({
    orders: orders.length, customers: customers.size,
    messages: messages.length, byChannel: byChannel,
    spendRupees: (spend / 100).toFixed(2),
    smsAvoided : ((messages.filter((m) => m.channel !== "sms").length * SMS_PAISE) / 100).toFixed(2),
  });
});

app.listen(PORT, () => {
  console.log("\n  Selly · web + message demo");
  console.log("  ─────────────────────────────────────────────────");
  console.log("  1. customer  http://localhost:" + PORT + "/             ← order here");
  console.log("  2. kitchen   http://localhost:" + PORT + "/kitchen.html  ← advance the order");
  console.log("  3. phone     http://localhost:" + PORT + "/phone.html    ← what arrives, and what it cost\n");
});
