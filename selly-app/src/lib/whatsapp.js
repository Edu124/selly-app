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
 *
 * The closing line has to match the business. Telling a delivery customer to
 * "tell your server" is nonsense — they're at home — and a café guest has no
 * delivery fee. So the wording is per type rather than one café-shaped default.
 *
 * @param typeId  "cafe" | "bakery" | "cloudkitchen"
 * @param coupon  optional {code, discount} — pass the *computed* rupee discount,
 *                not the coupon's raw kind/value.
 */
export function tplBill({ order, tableNo, businessName, upiId, typeId = "cafe", coupon = null }) {
  const subtotal = cartTotal(order?.cart) || orderTotal(order);
  const delivery = Number(order?.bill?.delivery || 0);
  const discount = Number(coupon?.discount || 0);
  const total    = Math.max(0, subtotal + delivery - discount);

  // How this bill identifies itself
  const heading =
    typeId === "cafe"   && tableNo        ? `Table ${tableNo}\n` :
    typeId === "bakery" && order?.extra?.due ? `Pickup: ${order.extra.due}\n` :
    order?.id                             ? `Order #${String(order.id).slice(-5)}\n` : "";

  // How to pay
  const closing =
    typeId === "cloudkitchen"
      ? `Pay on delivery, or by UPI above to skip the change.\n\n_Thanks for ordering direct._ 🙏`
      : typeId === "bakery"
        ? `Pay when you collect, or by UPI above.\n\n_See you soon._ 🎂`
        : `Or just tell your server — they've been notified.\n\n_No waiting, no waving._ 🙂`;

  return (
    `🧾 *Your bill from ${businessName || "our kitchen"}*\n\n` +
    heading +
    `${cartLines(order?.cart)}\n` +
    `──────────────\n` +
    `Subtotal: ${inr(subtotal)}\n` +
    (delivery > 0 ? `Delivery: ${inr(delivery)}\n` : "") +
    (discount > 0 ? `Coupon ${coupon.code}: −${inr(discount)}\n` : "") +
    `*Total: ${inr(total)}*\n\n` +
    (upiId ? `💳 Pay by UPI: *${upiId}*\n` : "") +
    closing
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

// ═════════════════════════════════════════════════════════════════════════════
// CLOUD KITCHEN TEMPLATES
// ═════════════════════════════════════════════════════════════════════════════

/** Kitchen has started. A delivery customer can't see the kitchen, so say so. */
export function tplKitchenStarted({ order, prepMinutes = 30 }) {
  return (
    `👨‍🍳 *We've started cooking — order ${shortId(order?.id)}*\n\n` +
    `Your food is being made fresh right now. ` +
    `Expect it in about ${prepMinutes} minutes 🍲`
  );
}

/** Left the kitchen. The address matters here — it's the last chance to fix it. */
export function tplOutForDelivery({ order, address, etaMinutes = 20 }) {
  return (
    `🛵 *On the way!*\n\n` +
    `Order ${shortId(order?.id)} has left our kitchen and should reach you in about ${etaMinutes} minutes.\n\n` +
    (address ? `📍 Delivering to: ${address}\n\n` : "") +
    `_Please keep your phone handy — our rider may call._`
  );
}

/** Delivered. Asks for a rating, which is the cheapest review you'll ever get. */
export function tplDelivered({ name, order }) {
  return (
    `✅ *Delivered — enjoy${name ? `, ${name}` : ""}!*\n\n` +
    `That's order ${shortId(order?.id)} with you. ` +
    `Thank you for ordering direct from us 🙏\n\n` +
    `How was it? Reply *1–5* ⭐`
  );
}

/**
 * The message that belongs to a status change, or null when a status shouldn't
 * generate one. Keeping this in one place is what stops a café template going
 * out to a delivery customer.
 *
 * @param status  the status being moved *to*
 * @param ctx     { order, customerName, tableNo, address, businessName,
 *                  prepMinutes, flavour, due, photoUrl, deliveryFee }
 * @returns {string|null}
 */
export function messageForStatus(status, ctx = {}) {
  const { order } = ctx;
  switch (status) {
    // Café
    case "preparing":
      return ctx.tableNo
        ? tplOrderPreparing({ order, tableNo: ctx.tableNo, prepMinutes: ctx.prepMinutes })
        : tplKitchenStarted({ order, prepMinutes: ctx.prepMinutes });
    case "served":
      return tplOrderServed({ tableNo: ctx.tableNo });

    // Bakery
    case "baking":
      return tplCakeBaking({ order, flavour: ctx.flavour, due: ctx.due });
    case "ready":
      return tplCakeReady({
        name: ctx.customerName, cakeMsg: ctx.cakeMsg, due: ctx.due,
        businessName: ctx.businessName, deliveryFee: ctx.deliveryFee, photoUrl: ctx.photoUrl,
      });

    // Cloud kitchen
    case "out_for_delivery":
      return tplOutForDelivery({ order, address: ctx.address });
    case "delivered":
      return tplDelivered({ name: ctx.customerName, order });

    // Money reaching the till is the owner's business, not news for the customer.
    case "paid":
    case "confirmed":
    default:
      return null;
  }
}

/** Does this status produce a customer message at all? */
export function canNotifyStatus(status) {
  return messageForStatus(status, { order: { id: "0" } }) !== null;
}

/**
 * Who a status update would actually reach, so the owner can see it before
 * tapping rather than discovering it failed afterwards.
 * @returns {{ok: true, customer: object} | {ok: false, reason: string}}
 */
export function notifyTarget(order, customers = []) {
  const cust = resolveCustomer(order, customers);
  if (!cust) {
    return {
      ok: false,
      reason: order?.mobile
        ? "This number isn't in your customer list yet"
        : "No phone number on this order",
    };
  }
  return { ok: true, customer: cust };
}

/**
 * Send the status message for an order, if there is one.
 *
 * Deliberately never throws: the kitchen has to be able to advance an order even
 * when the notification can't go out. Callers advance first, then call this, and
 * surface whatever comes back without blocking.
 *
 * @returns {{sent: boolean, skipped?: boolean, text?: string, to?: string, error?: string}}
 */
export async function notifyOrderStatus(status, ctx, customers = []) {
  const text = messageForStatus(status, ctx);
  if (!text) return { sent: false, skipped: true };

  try {
    const cust = await sendToOrderCustomer(ctx.order, customers, text);
    return { sent: true, text, to: cust?.name || cust?.mobile || "the customer" };
  } catch (e) {
    return { sent: false, text, error: e?.message || "Couldn't send the message." };
  }
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
