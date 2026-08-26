// ── The customer texts in ─────────────────────────────────────────────────────
//
// The aggregator calls this when somebody sends an SMS to your long code. It
// starts or resumes their session and replies with one link.
//
// Point your aggregator's inbound webhook at:
//   https://<your-app>/api/sms-inbound?secret=<SMS_WEBHOOK_SECRET>
//
// WHY A SECRET IN THE URL
//   Aggregators vary wildly in what they let you configure — some send no custom
//   headers at all — and a query parameter is the one thing all of them support.
//   It is not a strong credential, so this endpoint deliberately does nothing
//   dangerous with what it receives: it can only create a session for the number
//   that texted, and send that number a link. Somebody who guessed the secret
//   could make us send an SMS to a number of their choosing, which is why the
//   reply always goes to the sender rather than to anything in the body.
//
// WHY IT ALWAYS RETURNS 200
//   Aggregators retry non-200 responses, sometimes aggressively. A bug here that
//   returned 500 would turn into the same customer being texted repeatedly. The
//   response says what happened; the status code says "received".
// ─────────────────────────────────────────────────────────────────────────────

import { rpc, sendSms, link, TEMPLATES } from "./_sms.js";

/** Aggregators disagree about field names. Accept the common ones. */
function readInbound(req) {
  const q = req.query || {};
  const b = (typeof req.body === "object" && req.body) || {};
  const pick = (...keys) => {
    for (const k of keys) {
      if (b[k] != null && b[k] !== "") return String(b[k]);
      if (q[k] != null && q[k] !== "") return String(q[k]);
    }
    return "";
  };
  return {
    from: pick("from", "sender", "mobile", "msisdn", "source", "phone"),
    text: pick("text", "message", "content", "body", "msg"),
  };
}

export default async function handler(req, res) {
  const secret = process.env.SMS_WEBHOOK_SECRET;
  const given  = (req.query && req.query.secret) || "";
  if (!secret || given !== secret) {
    return res.status(401).json({ ok: false, error: "bad secret" });
  }

  try {
    const { from, text } = readInbound(req);
    const mobile = String(from).replace(/\D/g, "").slice(-10);

    if (mobile.length !== 10) {
      return res.status(200).json({ ok: false, reason: "no sender number" });
    }

    // Any message starts a session. Nobody texts a food ordering number by
    // accident, and making them guess a magic keyword is friction for nothing.
    const rows = await rpc("start_sms_session", { p_mobile: mobile });
    const s = Array.isArray(rows) ? rows[0] : rows;
    if (!s || !s.token) {
      return res.status(200).json({ ok: false, reason: "no session" });
    }

    // A returning customer with a location goes straight to the kitchen list.
    // Asking somebody who ordered last week to set their address again is the
    // fastest way to lose them.
    const straightToKitchens = s.is_returning && s.has_location;
    const url = link(`/find.html?s=${s.token}`);

    const tpl  = straightToKitchens ? TEMPLATES.returning : TEMPLATES.welcome;
    const body = tpl.text(s.name, url);
    const out  = await sendSms(mobile, body, tpl.env);

    return res.status(200).json({
      ok: true,
      returning: !!s.is_returning,
      sent: out.ok,
      note: out.ok ? undefined : (out.reason || out.error || out.body),
      // Echoed so the aggregator's own log shows what we tried to send, which is
      // the first thing anyone looks at when a message does not arrive.
      message: body,
      received: text ? text.slice(0, 60) : undefined,
    });
  } catch (e) {
    // 200 on purpose — see the header. The body carries the failure.
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
}
