/**
 * GET /api/demo-thread?mobile=55xxxxxxxx
 *
 * The messages Selly would have sent to this demo number since the order was
 * placed, so the fake phone can show them arriving.
 *
 * Only the ones that happen AFTER the customer has left the browser live here.
 * The order confirmation is already known to the page at the moment it places
 * the order, and it announces itself to the phone directly — asking the server
 * to reconstruct a message the browser was holding a second ago would be
 * roundabout, and would mean rebuilding the UPI link a second time and hoping
 * the two agreed.
 *
 * What is left is the one that genuinely arrives out of the blue: the kitchen
 * marks the order delivered, and a rating link turns up on the customer's
 * phone. On stage that is the moment worth showing.
 */

import { rest, link, shortId, TEMPLATES } from "./_sms.js";
import { demoMobile, demoIsOff } from "./_demo.js";

export default async function handler(req, res) {
  if (demoIsOff()) {
    return res.status(403).json({ error: "The demo is switched off." });
  }

  const mobile = demoMobile(
    (req.query && req.query.mobile) ||
      new URL(req.url, "http://x").searchParams.get("mobile")
  );
  if (!mobile) {
    // Not a demo number, so not ours to read. This is the guard that stops the
    // endpoint being an order-history lookup for any customer in the database.
    return res.status(400).json({ error: "Demo numbers only." });
  }

  try {
    const orders = await rest(
      `orders?mobile=eq.${mobile}` +
        `&select=id,status,rating_token,created_at` +
        `&order=created_at.asc&limit=20`
    );

    const messages = [];
    for (const o of orders) {
      if (String(o.status || "").toLowerCase() !== "delivered") continue;
      if (!o.rating_token) continue;
      messages.push({
        id     : `delivered:${o.id}`,
        orderId: o.id,
        at     : o.created_at,
        text   : TEMPLATES.delivered.text(
          shortId(o.id),
          link(`/rate.html?t=${o.rating_token}`)
        ),
      });
    }

    return res.status(200).json({ mobile, messages });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
