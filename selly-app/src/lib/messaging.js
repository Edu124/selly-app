// ── Reaching the customer ─────────────────────────────────────────────────────
//
// The channel is a setting, not an architecture. WhatsApp today, SMS for the
// customer who doesn't use it, push when the ordering page ships. One function
// decides, so losing a channel is a config change rather than a rewrite.
//
// TWO THINGS THIS FIXES ABOUT THE OLD PATH
//
//  1. It resolved the customer out of bot_customers — a table only the WhatsApp
//     bot ever wrote to. An order the kitchen typed in has no such row, so
//     advancing it failed with "this order isn't linked to a saved customer"
//     and no message could ever be sent. The order carries the mobile number.
//     That is all anyone needs, and it works no matter how the order arrived.
//
//  2. It assumed WhatsApp end to end, including in its name.
//
// HOW SENDING ACTUALLY WORKS IN PHASE 1 — AND WHAT IT DOES NOT DO
//
// There is no aggregator, no WhatsApp Business API and no server in this path.
// The kitchen taps a button and their own phone opens the chat with the message
// already written; they press send. That is why nothing here reports
// "delivered" — we know we handed the message over, we do not know it was sent,
// and claiming otherwise would put a number in front of the kitchen that is not
// true. When a real send path exists, only `deliver()` changes.
// ─────────────────────────────────────────────────────────────────────────────

import { Linking, Platform } from "react-native";
import { messageForStatus, canNotifyStatus } from "./whatsapp";

export const CHANNELS = {
  sms     : { key: "sms",      label: "SMS",      icon: "chatbox",       colour: "#f5a524" },
  whatsapp: { key: "whatsapp", label: "WhatsApp", icon: "logo-whatsapp", colour: "#25D366" },
};

// SMS, not WhatsApp. The product deliberately does not depend on WhatsApp any
// more: SMS reaches every phone, needs no app installed, and no platform can
// switch it off. WhatsApp stays as a per-customer override because some
// customers genuinely prefer it and supporting it costs one config value --
// but nothing defaults to it.
export const DEFAULT_CHANNEL = "sms";

// Where rate.html is served from. On web that is this same origin, which is what
// makes the link work in dev and in production without configuration. On native
// there is no origin, so it falls back to the deployed domain.
const RATING_HOST = "https://selly.codeforgeai.app";

export function ratingBase() {
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return window.location.origin;
  }
  return RATING_HOST;
}

/**
 * The one-tap rating link for an order.
 *
 * Returns null rather than a broken link when the order has no token — an order
 * created before the migration ran, or a fixture. A missing link is better than
 * one that lands the customer on "this link isn't valid".
 */
export function ratingLink(order) {
  const token = order && (order.rating_token || order.ratingToken);
  return token ? `${ratingBase()}/rate.html?t=${token}` : null;
}

/** Last ten digits — the form every other part of the app matches on. */
export const tenDigit = (v) => String(v || "").replace(/\D/g, "").slice(-10);

/**
 * Where to reach the customer for this order.
 *
 * Reads the order first because that is the record of what was actually agreed;
 * the contacts row is only a fallback for an order saved before the number was
 * required.
 */
export function contactFor(order, contacts = []) {
  const mobile = tenDigit(order && order.mobile);
  if (!mobile) return null;

  const known = (contacts || []).find(c => tenDigit(c.mobile) === mobile);
  return {
    mobile,
    name   : (order && order.name) || (known && known.name) || "the customer",
    channel: (known && known.preferred_channel) || DEFAULT_CHANNEL,
  };
}

/**
 * The deep link that opens the right app with the message already typed.
 *
 * The SMS scheme is genuinely inconsistent: iOS wants `&body=`, everything else
 * wants `?body=`. Getting it wrong opens the composer with an empty message and
 * the kitchen retypes it by hand, so it is worth the branch.
 */
export function contactLink({ mobile, text, channel = DEFAULT_CHANNEL }) {
  const digits = tenDigit(mobile);
  if (!digits) return null;
  const body = encodeURIComponent(text || "");

  if (channel === "sms") {
    const sep = Platform.OS === "ios" ? "&" : "?";
    return `sms:+91${digits}${sep}body=${body}`;
  }
  return `https://wa.me/91${digits}?text=${body}`;
}

/**
 * Hand one message to the customer's phone.
 *
 * Never throws. A channel that will not open is a fact the kitchen needs to see
 * next to the order, not an exception that unwinds a status change they already
 * made.
 */
export async function deliver({ mobile, text, channel = DEFAULT_CHANNEL }) {
  const url = contactLink({ mobile, text, channel });
  if (!url) {
    return { ok: false, channel, error: "No mobile number on this order." };
  }
  try {
    const supported = await Linking.canOpenURL(url).catch(() => true);
    if (!supported) {
      return {
        ok: false, channel, url,
        error: channel === "sms"
          ? "This phone can't open the messaging app."
          : "WhatsApp doesn't seem to be installed on this phone.",
      };
    }
    await Linking.openURL(url);
    return { ok: true, channel, url, outcome: "opened" };
  } catch (e) {
    return { ok: false, channel, url, error: e?.message || "Couldn't open the app." };
  }
}

/**
 * Everything a status change needs: the right words, the right person, the
 * right app. Returns what happened so the caller can report it honestly.
 *
 * `channel` overrides the customer's usual one — for the case where a text
 * went unanswered and the kitchen wants to try WhatsApp instead.
 */
export async function notifyStatus(status, ctx, contacts = [], channel = null) {
  if (!canNotifyStatus(status)) {
    return { sent: false, skipped: true, reason: "No message for this status." };
  }

  let text = messageForStatus(status, ctx);
  if (!text) return { sent: false, skipped: true, reason: "No message for this status." };

  // Delivery is the only moment the customer is holding the food and thinking
  // about it. Asking a day later gets a fraction of the replies, so the ask
  // rides along with the message that is already going out.
  if (status === "delivered") {
    const link = ratingLink(ctx.order);
    if (link) text += `\n\nHow was it? One tap:\n${link}`;
  }

  const contact = contactFor(ctx.order, contacts);
  if (!contact) {
    return {
      sent: false, text,
      error: "This order has no mobile number, so there's nobody to send it to.",
    };
  }

  const use = channel || contact.channel;
  const res = await deliver({ mobile: contact.mobile, text, channel: use });

  return {
    sent   : res.ok,
    text,
    channel: use,
    to     : contact.name,
    mobile : contact.mobile,
    error  : res.error || null,
    outcome: res.ok ? "opened" : "failed",
  };
}

/** Which channel a message to this order would use, for showing before sending. */
export function channelFor(order, contacts = []) {
  const c = contactFor(order, contacts);
  return c ? CHANNELS[c.channel] || CHANNELS[DEFAULT_CHANNEL] : null;
}

/** Is there anyone to send to at all? Drives whether the button is offered. */
export function isReachable(order) {
  return tenDigit(order && order.mobile).length === 10;
}
