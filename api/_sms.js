// ── Sending an SMS ────────────────────────────────────────────────────────────
//
// Deliberately provider-agnostic. Indian aggregators (Gupshup, Kaleyra, Route
// Mobile, MSG91, Textlocal) all speak plain HTTP with an API key, they just
// disagree about parameter names. Rather than marry one, the request is built
// from environment variables — switching provider is an env change, not a code
// change, and being able to switch is worth a great deal when one of them has a
// bad month.
//
// ── WHAT YOU MUST SET ────────────────────────────────────────────────────────
//   SMS_PROVIDER      msg91 | gupshup | generic
//   SMS_API_KEY       from the aggregator
//   SMS_SENDER_ID     your 6-character DLT header, e.g. SELLYX
//   SMS_ENTITY_ID     your DLT principal entity id
//   SUPABASE_URL      https://<project>.supabase.co
//   SUPABASE_SERVICE_KEY   service role key — server only, NEVER in a page
//   SMS_WEBHOOK_SECRET     shared secret the aggregator puts in the callback URL
//   PUBLIC_BASE_URL   https://your-app.vercel.app
//
// ── DLT ──────────────────────────────────────────────────────────────────────
// Every template below has to be registered on your DLT portal before a single
// message will be delivered, and each has a DLT template id you paste into the
// env vars named beside it. Registering the domain that appears in the links is
// a separate step and the one people forget — messages then vanish silently
// rather than failing loudly.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const BASE         = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");

/**
 * The messages, matching what gets registered on DLT.
 *
 * Keep these in step with the portal by hand. A template that differs from the
 * registered one by a single character is rejected by the carrier, and the
 * failure is silent — which is why each one is short and has no punctuation
 * doing decorative work.
 */
export const TEMPLATES = {
  // "Hi {#var#}, set your delivery location here: {#var#}"
  welcome: {
    env : "DLT_TID_WELCOME",
    text: (name, link) =>
      `Hi ${name || "there"}, set your delivery location here: ${link}`,
  },
  // "Welcome back {#var#}. Kitchens near you: {#var#}"
  returning: {
    env : "DLT_TID_RETURNING",
    text: (name, link) =>
      `Welcome back ${name || "there"}. Kitchens near you: ${link}`,
  },
  // "Order {#var#} confirmed. Total Rs {#var#}. Pay here: {#var#}"
  confirmedPay: {
    env : "DLT_TID_CONFIRMED_PAY",
    text: (id, total, link) =>
      `Order ${id} confirmed. Total Rs ${total}. Pay here: ${link}`,
  },
  // "Order {#var#} confirmed. Total Rs {#var#} cash on delivery."
  confirmedCod: {
    env : "DLT_TID_CONFIRMED_COD",
    text: (id, total) =>
      `Order ${id} confirmed. Total Rs ${total} cash on delivery.`,
  },
  // "Order {#var#} delivered. Tell us how it was: {#var#}"
  delivered: {
    env : "DLT_TID_DELIVERED",
    text: (id, link) =>
      `Order ${id} delivered. Tell us how it was: ${link}`,
  },
};

export function link(path) {
  return `${BASE}${path}`;
}

/** Supabase RPC with the service key. Server only — this key bypasses RLS. */
export async function rpc(fn, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method : "POST",
    headers: {
      "Content-Type" : "application/json",
      apikey         : SERVICE_KEY,
      Authorization  : `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    throw new Error((data && (data.message || data.hint)) || `rpc ${fn} failed`);
  }
  return data;
}

/**
 * Hand one message to the aggregator.
 *
 * Never throws. An SMS that will not go is a fact to log, not a reason to fail
 * the order that triggered it — the food is already being cooked either way.
 */
export async function sendSms(mobile, text, templateEnv) {
  const to     = String(mobile || "").replace(/\D/g, "").slice(-10);
  const key    = process.env.SMS_API_KEY;
  const sender = process.env.SMS_SENDER_ID;
  const tid    = templateEnv ? process.env[templateEnv] : undefined;

  if (!to || !key || !sender) {
    return { ok: false, skipped: true, reason: "SMS is not configured yet" };
  }

  const provider = (process.env.SMS_PROVIDER || "generic").toLowerCase();

  try {
    let res;
    if (provider === "msg91") {
      res = await fetch("https://control.msg91.com/api/v5/flow/", {
        method : "POST",
        headers: { "Content-Type": "application/json", authkey: key },
        body   : JSON.stringify({
          template_id: tid,
          sender,
          short_url  : "0",              // DLT wants the real URL, not a shortener
          recipients : [{ mobiles: `91${to}`, VAR1: text }],
        }),
      });
    } else if (provider === "gupshup") {
      const qs = new URLSearchParams({
        method: "SendMessage", send_to: `91${to}`, msg: text,
        msg_type: "TEXT", userid: process.env.SMS_USER_ID || "",
        password: key, auth_scheme: "plain", v: "1.1",
        mask: sender, ...(tid ? { dltTemplateId: tid } : {}),
        ...(process.env.SMS_ENTITY_ID ? { principalEntityId: process.env.SMS_ENTITY_ID } : {}),
      });
      res = await fetch(`https://enterprise.smsgupshup.com/GatewayAPI/rest?${qs}`);
    } else {
      // Anything else: one POST, shaped by env. Enough for most aggregators.
      res = await fetch(process.env.SMS_ENDPOINT, {
        method : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.SMS_AUTH_HEADER
            ? { [process.env.SMS_AUTH_HEADER]: key }
            : { Authorization: `Bearer ${key}` }),
        },
        body: JSON.stringify({
          to: `91${to}`, from: sender, text,
          ...(tid ? { template_id: tid } : {}),
          ...(process.env.SMS_ENTITY_ID ? { entity_id: process.env.SMS_ENTITY_ID } : {}),
        }),
      });
    }

    const body = await res.text();
    if (!res.ok) return { ok: false, status: res.status, body: body.slice(0, 300) };
    return { ok: true, body: body.slice(0, 300) };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

/**
 * Read a table with the service key. Server only.
 *
 * Narrower than it looks: callers pass a complete PostgREST query string, and
 * every one of them constrains by something the caller has already proven they
 * are entitled to. This is not a general-purpose door into the database.
 */
export async function rest(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey        : SERVICE_KEY,
      Authorization : `Bearer ${SERVICE_KEY}`,
    },
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    throw new Error((data && (data.message || data.hint)) || "read failed");
  }
  return data || [];
}

/**
 * The order number as a person should read it.
 *
 * Order ids are timestamps -- thirteen digits. Nobody reads one out, nobody
 * types one back, and in a message every character is billed against a 160
 * character segment. The last five are unique enough for a customer and a
 * kitchen to agree which order they are talking about.
 */
export function shortId(id) {
  return String(id == null ? "" : id).slice(-5);
}
