// ── Telling the customer their order is in ────────────────────────────────────
//
// Called by the ordering page the moment an order is placed. Sends the
// confirmation, with a payment link when they chose to pay online.
//
//   POST /api/sms-order   { orderId, payLink }
//
// WHY THE PAGE CANNOT SEND THIS ITSELF
//   Sending needs the aggregator's API key, and anything a page holds is public.
//   The key lives here, in an environment variable, on the server. The page can
//   only ask for a message about an order that exists.
//
// WHAT SOMEBODY COULD DO WITH THIS ENDPOINT
//   Order ids are timestamps, so they are guessable. The worst case is making us
//   re-send a confirmation to the person who placed that order — the number is
//   read from the order, never from the request, so it cannot be aimed at
//   anybody else. Annoying if abused; not dangerous. A per-IP limit in front of
//   it is the fix if that ever matters.
// ─────────────────────────────────────────────────────────────────────────────

import { rpc, sendSms, link, TEMPLATES } from "./_sms.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST only" });
  }

  try {
    const body    = (typeof req.body === "object" && req.body) || {};
    const orderId = String(body.orderId || "").replace(/\D/g, "");
    if (!orderId) return res.status(400).json({ ok: false, error: "orderId required" });

    const rows = await rpc("order_sms_context", { p_order: orderId });
    const o = Array.isArray(rows) ? rows[0] : rows;
    if (!o || !o.mobile) {
      return res.status(404).json({ ok: false, error: "no such order" });
    }

    const shortId = String(orderId).slice(-5);
    const total   = Math.round(Number(o.total) || 0);

    // The payment link is built by the page, because it is the only thing that
    // knows the kitchen's UPI id and the exact amount as displayed. Passing it
    // through beats rebuilding it here and risking the two disagreeing.
    const payLink = typeof body.payLink === "string" && body.payLink.startsWith("upi://")
      ? body.payLink : null;

    const useCod = o.payment_mode !== "upi" || !payLink;
    const tpl    = useCod ? TEMPLATES.confirmedCod : TEMPLATES.confirmedPay;
    const text   = useCod
      ? tpl.text(shortId, total)
      : tpl.text(shortId, total, payLink);

    const out = await sendSms(o.mobile, text, tpl.env);
    return res.status(200).json({
      ok: out.ok,
      sent: out.ok,
      note: out.ok ? undefined : (out.reason || out.error || out.body),
      message: text,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}
