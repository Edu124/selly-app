// ── WhatsApp send helpers + message templates ─────────────────────────────────
// One place for every outbound message the app sends, so the copy the client
// approved in the demos lives in exactly one file.
//
// There is a single send path available to the app:
//     sendMessageToCustomer(customerId, text)  →  POST /api/customers/:id/message
// It takes a bot_customers id, not a phone number — so anything we send has to
// be resolved to a saved customer first. resolveCustomer() does that by matching
// the last 10 digits of the order's mobile.
//
// Text only. There is no per-customer media endpoint on the backend today
// (/api/promote/image is a broadcast), so the cake "photo of your cake" message
// sends a public image URL and lets WhatsApp render the preview. See
// SERVER_CONTRACT.md.
//
// Copy source: cafe-demo/artifact.html and cakeshop-demo/artifact.html.
// ─────────────────────────────────────────────────────────────────────────────

import { sendMessageToCustomer } from "./api";

export const inr = n => "₹" + Number(n || 0).toLocaleString("en-IN");

// ── Customer resolution ───────────────────────────────────────────────────────

/** Last 10 digits of a phone number, or "" when there aren't any. */
function tail10(v) {
  return String(v || "").replace(/\D/g, "").slice(-10);
}

/**
 * Find the saved customer an order belongs to.
 * Orders carry a mobile; the send endpoint needs a bot_customers id.
 * @returns {object|null} the customer, or null when the order has no match
 *   (walk-in with no number, or a customer that was never saved).
 */
export function resolveCustomer(order, customers = []) {
  if (order?.customerId) {
    const direct = customers.find(c => String(c.id) === String(order.customerId));
    if (direct) return direct;
  }
  const digits = tail10(order?.mobile);
  if (!digits) return null;
  return customers.find(c => tail10(c.mobile) === digits) || null;
}

/**
 * Resolve then send. Throws with a readable message when there is nobody to
 * send to, so callers can surface it rather than failing silently.
 */
export async function sendToOrderCustomer(order, customers, text) {
  const cust = resolveCustomer(order, customers);
  if (!cust) {
    throw new Error(
      "This order isn't linked to a saved customer, so there's no WhatsApp number to send to."
    );
  }
  await sendMessageToCustomer(cust.id, text);
  return cust;
}

// ── Shared bits ───────────────────────────────────────────────────────────────

const shortId = id => "#" + String(id || "").slice(-5);

function cartLines(cart = []) {
  const items = Array.isArray(cart) ? cart : [];
  if (!items.length) return "• Order total";
  return items
    .map(i => {
      const qty  = Number(i.qty || 1);
      const line = Number(i.price || 0) * qty;
      const size = i.size ? ` (${i.size})` : "";
      return `• ${i.name}${size} ×${qty} — ${inr(line)}`;
    })
    .join("\n");
}

export function cartTotal(cart = []) {
  return (Array.isArray(cart) ? cart : []).reduce(
    (s, i) => s + Number(i.price || 0) * Number(i.qty || 1), 0
  );
}

/**
 * The amount an order is worth. `bill` is a jsonb object ({subtotal, discount,
 * delivery, total}) — reading it as a number is the bug this replaces.
 */
export function orderTotal(order) {
  const t = Number(order?.bill?.total);
  if (Number.isFinite(t) && t > 0) return t;
  return cartTotal(order?.cart);
}

// ═════════════════════════════════════════════════════════════════════════════
// CAFÉ TEMPLATES
// ═════════════════════════════════════════════════════════════════════════════

/** Sent when the kitchen starts on a dine-in order. */
export function tplOrderPreparing({ order, tableNo, prepMinutes = 8 }) {
  const where = tableNo ? ` — Table ${tableNo}` : "";
  const at    = tableNo ? `at your table` : `ready`;
  return (
    `👨‍🍳 *Order ${shortId(order?.id)}${where}*\n\n` +
    `We've started on your order. It'll be ${at} in about ${prepMinutes} minutes ☕`
  );
}

/** Sent when the order reaches the table. */
export function tplOrderServed({ tableNo }) {
  return (
    `🎉 *Served!*\n\n` +
    (tableNo ? `Your order is at *Table ${tableNo}* — enjoy! ☕\n\n` : `Your order is ready — enjoy! ☕\n\n`) +
    `When you're done, just reply *bill* and I'll send it here. ` +
    `No waiting, no waving. 🙂`
  );
}

/**
 * The itemised bill.
 * @param coupon  optional {code, prizeLabel, discount} — pass the *computed*
 *                rupee discount, not the coupon's raw kind/value.
 */
export function tplBill({ order, tableNo, businessName, upiId, coupon = null }) {
  const subtotal = cartTotal(order?.cart) || orderTotal(order);
  const discount = Number(coupon?.discount || 0);
  const total    = Math.max(0, subtotal - discount);

  return (
    `🧾 *Your bill from ${businessName || "our kitchen"}*\n\n` +
    (tableNo ? `Table ${tableNo}\n` : "") +
    `${cartLines(order?.cart)}\n` +
    `──────────────\n` +
    `Subtotal: ${inr(subtotal)}\n` +
    (discount > 0 ? `Coupon ${coupon.code}: −${inr(discount)}\n` : "") +
    `*Total: ${inr(total)}*\n\n` +
    (upiId ? `💳 Pay by UPI: *${upiId}*\n` : "") +
    `Or just tell your server — they've been notified.\n\n` +
    `_No waiting, no waving._ 🙂`
  );
}

/** Sent when a guest wins something in the Fun Zone. */
export function tplCoupon({ prizeLabel, code, tableNo, businessName, validDays = 15 }) {
  return (
    `🎁 *You won: ${prizeLabel}!*\n\n` +
    `Code: *${code}*\n` +
    (tableNo
      ? `Show this to your server at Table ${tableNo}, or save it for your next visit (valid ${validDays} days).\n\n`
      : `Save it for your next visit (valid ${validDays} days).\n\n`) +
    `_Thanks for playing at ${businessName || "our cafe"}._ ☕`
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BAKERY TEMPLATES
// ═════════════════════════════════════════════════════════════════════════════

/** Chef has started baking. */
export function tplCakeBaking({ order, flavour, due }) {
  return (
    `🧑‍🍳 *Update on order ${shortId(order?.id)}*\n\n` +
    `Our chef has started on your *${flavour || "cake"}*! ` +
    (due ? `It'll be fresh and ready by *${due}*. 🎂` : `We'll message you the moment it's ready. 🎂`)
  );
}

/**
 * Cake is ready. photoUrl is appended as a plain link because there is no
 * per-customer media endpoint — WhatsApp renders a preview for it.
 */
export function tplCakeReady({ name, cakeMsg, due, businessName, deliveryFee = 49, photoUrl = null }) {
  return (
    `🎂 *Your cake is ready${name ? `, ${name}` : ""}!*\n\n` +
    (cakeMsg ? `“${cakeMsg}” — exactly as you asked. 📸\n` : "") +
    (photoUrl ? `${photoUrl}\n` : "") +
    `\nPick up: ${due ? `*${due}* ` : ""}at ${businessName || "our shop"}, ` +
    `or reply *DELIVER* for home delivery (${inr(deliveryFee)}).`
  );
}

/** Sent after pickup. Mentions the saved birthday only when there is one. */
export function tplCakeFeedback({ name, savedOccasion = false }) {
  return (
    `Thank you for ordering with us${name ? `, ${name}` : ""}! 🙏\n\n` +
    `How was the cake? Rate us *1–5* ⭐\n\n` +
    (savedOccasion
      ? `_P.S. We've saved this birthday — next year, your cake reminder will arrive a week early. One less thing to remember!_ 🎂`
      : `_We'd love to bake for you again — just message anytime._`)
  );
}

/**
 * The annual birthday reminder — the whole point of the occasions table.
 * @param lastCake {flavour, kg, eggless, cakeMsg} from occasions.last_cake
 */
export function tplBirthdayReminder({ personName, whenText, lastCake = {}, discountPct = 10 }) {
  const spec = [
    lastCake.kg ? `${lastCake.kg} kg` : null,
    lastCake.flavour || null,
    lastCake.eggless ? "(eggless)" : null,
  ].filter(Boolean).join(" ");

  return (
    `🎂 *A little birdie reminded us…*\n\n` +
    `*${personName ? `${personName}'s` : "A"} birthday is ${whenText || "coming up"}!*` +
    (spec ? ` Last year you celebrated with our ${spec}.` : "") +
    `\n\nWant us to bake it again? *${discountPct}% off* for returning customers 💝\n\n` +
    `Reply *YES* to repeat last year's cake, or *NEW* to create a different one.`
  );
}

/** Confirmation after an order is placed, used by both café and bakery. */
export function tplOrderConfirmed({ order, tableNo, prepMinutes = 10 }) {
  const total = orderTotal(order);
  return (
    `✅ *Order confirmed${tableNo ? ` — Table ${tableNo}` : ""}*\n\n` +
    `${cartLines(order?.cart)}\n\n` +
    `💰 Total: *${inr(total)}* (pay at the end)\n` +
    `⏱ Ready in about ${prepMinutes} minutes`
  );
}
