// ── Selly · web-push demo server ──────────────────────────────────────────────
// The question this exists to answer: can a kitchen reach a customer with their
// tab closed, without WhatsApp?
//
// So this uses REAL Web Push — VAPID keys, a browser push subscription, and a
// server-sent push that the browser's own push service delivers to a service
// worker. Not a setTimeout in the page pretending to be a notification. If the
// tab is shut and the notification still arrives, the mechanism is real.
//
// Everything is in memory on purpose. This is a demo, not a product.
// ─────────────────────────────────────────────────────────────────────────────

const express  = require("express");
const webpush  = require("web-push");
const fs       = require("fs");
const path     = require("path");

const PORT      = 4200;
const KEYS_FILE = path.join(__dirname, ".vapid.json");

// VAPID keys identify this server to the browser's push service. Persisted so
// restarting doesn't invalidate every subscription the browser already holds.
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

// ── In-memory state ──────────────────────────────────────────────────────────
const subs   = new Map();   // customerId -> [subscription]
const orders = [];          // newest last
let   nextId = 1001;

const MENU = [
  { id: "t1", name: "Veg Thali",            price: 180, emoji: "🍛" },
  { id: "m1", name: "Butter Chicken",       price: 320, emoji: "🍗" },
  { id: "m2", name: "Paneer Butter Masala", price: 260, emoji: "🧀" },
  { id: "m4", name: "Chicken Biryani",      price: 280, emoji: "🍚" },
  { id: "b1", name: "Butter Naan",          price: 45,  emoji: "🫓" },
  { id: "b3", name: "Jeera Rice",           price: 120, emoji: "🍚" },
];

// Same status vocabulary the real app uses.
const FLOW = ["confirmed", "preparing", "out_for_delivery", "delivered"];

const COPY = {
  preparing       : o => ({
    title: "👨‍🍳 We've started cooking",
    body : `Order #${o.id} — ready in about ${o.etaMinutes} minutes.`,
  }),
  out_for_delivery: o => ({
    title: "🛵 On the way!",
    body : `Order #${o.id} has left the kitchen. Delivering to ${o.address}`,
  }),
  delivered       : o => ({
    title: "✅ Delivered — enjoy!",
    body : `That's order #${o.id} with you. Tap to rate it.`,
  }),
};

// ── API ──────────────────────────────────────────────────────────────────────

app.get("/api/vapid", (_req, res) => res.json({ publicKey: keys.publicKey }));

app.get("/api/menu", (_req, res) => res.json({ menu: MENU }));

/** The browser hands us a push subscription; we file it against the customer. */
app.post("/api/subscribe", (req, res) => {
  const { customerId, subscription } = req.body || {};
  if (!customerId || !subscription) return res.status(400).json({ error: "missing customerId or subscription" });
  const list = subs.get(customerId) || [];
  // De-dupe: the same browser re-subscribing shouldn't get two notifications.
  if (!list.some(s => s.endpoint === subscription.endpoint)) list.push(subscription);
  subs.set(customerId, list);
  console.log(`[subscribe] ${customerId} → ${list.length} device(s)`);
  res.json({ ok: true, devices: list.length });
});

app.post("/api/orders", (req, res) => {
  const { customerId, name, address, cart } = req.body || {};
  if (!cart || !cart.length) return res.status(400).json({ error: "empty cart" });
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const order = {
    id        : String(nextId++),
    customerId, name: name || "Guest",
    address   : address || "",
    cart, total,
    status    : "confirmed",
    etaMinutes: 30,
    createdAt : Date.now(),
  };
  orders.push(order);
  console.log(`[order] #${order.id} ${order.name} ₹${total}`);
  res.json({ ok: true, order });
});

app.get("/api/orders", (_req, res) => res.json({ orders: [...orders].reverse() }));

/** Advance an order and push the matching message to that customer. */
app.post("/api/orders/:id/status", async (req, res) => {
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "no such order" });

  const i    = FLOW.indexOf(order.status);
  const next = FLOW[i + 1];
  if (!next) return res.json({ ok: true, order, sent: 0, note: "already finished" });
  order.status = next;

  const copy = COPY[next] ? COPY[next](order) : null;
  if (!copy) return res.json({ ok: true, order, sent: 0 });

  const list   = subs.get(order.customerId) || [];
  const stale  = [];
  let   sent   = 0;

  await Promise.all(list.map(async sub => {
    try {
      await webpush.sendNotification(sub, JSON.stringify({
        title: copy.title, body: copy.body,
        orderId: order.id, status: next, url: "/",
      }));
      sent++;
    } catch (e) {
      // 404/410 means the browser threw the subscription away — drop it rather
      // than retrying something that can never succeed again.
      if (e.statusCode === 404 || e.statusCode === 410) stale.push(sub.endpoint);
      console.warn(`[push] failed (${e.statusCode || "?"}): ${e.body || e.message}`);
    }
  }));

  if (stale.length) {
    subs.set(order.customerId, list.filter(s => !stale.includes(s.endpoint)));
  }

  console.log(`[status] #${order.id} → ${next} · pushed to ${sent} device(s)`);
  res.json({ ok: true, order, sent, devices: list.length });
});

/**
 * Fire a push straight at a customer, no order involved. When someone asks "where
 * do I see it", the useful thing is to isolate the notification from everything
 * else that could be wrong.
 */
app.post("/api/test-push", async (req, res) => {
  const { customerId } = req.body || {};
  const list = subs.get(customerId) || [];
  if (!list.length) return res.json({ ok: false, sent: 0, error: "no subscription for " + customerId });

  let sent = 0;
  const stale = [];
  await Promise.all(list.map(async sub => {
    try {
      await webpush.sendNotification(sub, JSON.stringify({
        title: "🔔 Selly test notification",
        body : "If you can see this, the kitchen can reach you with the tab closed.",
        url  : "/",
      }));
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) stale.push(sub.endpoint);
      console.warn(`[test-push] failed (${e.statusCode || "?"})`);
    }
  }));
  if (stale.length) subs.set(customerId, list.filter(s => !stale.includes(s.endpoint)));
  console.log(`[test-push] ${customerId} → ${sent} device(s)`);
  res.json({ ok: sent > 0, sent });
});

app.get("/api/state", (_req, res) => {
  res.json({
    orders: orders.length,
    subscribers: [...subs.entries()].map(([id, l]) => ({ customerId: id, devices: l.length })),
  });
});

app.listen(PORT, () => {
  console.log(`\n  Selly web-push demo`);
  console.log(`  customer : http://localhost:${PORT}/`);
  console.log(`  kitchen  : http://localhost:${PORT}/kitchen.html\n`);
});
