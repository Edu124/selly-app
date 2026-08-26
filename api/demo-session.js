/**
 * POST /api/demo-session   { mobile? }
 *
 * Stands in for the SMS aggregator we do not have yet.
 *
 * Everything here is real except the transport: a real session row, a real
 * token, a real link, and the reply text built from the same DLT templates the
 * live sender uses. The only thing that does not happen is the message
 * actually leaving over the network.
 *
 * That makes the demo honest. What the investor reads on the fake phone is
 * word for word what a customer would receive.
 */

import { rpc, link, TEMPLATES } from "./_sms.js";
import { demoMobile, newDemoMobile, demoIsOff } from "./_demo.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }
  if (demoIsOff()) {
    return res.status(403).json({ error: "The demo is switched off." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body || "{}"); } catch { body = {}; }
  }
  body = body || {};

  // No number means "a customer who has never texted us before" — the whole
  // first half of the demo. A number means "text us again", which is the half
  // that shows the product remembering them.
  let mobile;
  if (body.mobile) {
    mobile = demoMobile(body.mobile);
    if (!mobile) {
      return res.status(400).json({
        error: "Demo numbers only. Real numbers are refused here on purpose.",
      });
    }
  } else {
    mobile = newDemoMobile();
  }

  try {
    const rows = await rpc("start_sms_session", { p_mobile: mobile });
    const s = (rows && rows[0]) || {};
    if (!s.token) throw new Error("no session was created");

    const url = link(`/find.html?s=${encodeURIComponent(s.token)}`);

    // Same branch the real webhook takes. Somebody we already have a location
    // for skips the form, and the message says so.
    const returning = !!(s.is_returning && s.has_location);
    const message = returning
      ? TEMPLATES.returning.text(s.name, url)
      : TEMPLATES.welcome.text(s.name, url);

    return res.status(200).json({
      mobile,
      token       : s.token,
      link        : url,
      message,
      isReturning : returning,
      name        : s.name || null,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
