# Turning on the SMS ordering flow

The flow you asked for:

1. Customer texts your number
2. They get back **one link** to set their location, once
3. Kitchens near them
4. The kitchen's menu, cart, payment — all in the browser
5. Confirmation, updates and the rating link come back as SMS

**Every page in that flow is already built and live.** What follows is only the
messaging bridge.

---

## Why this is buildable when "ordering over SMS" isn't

Nothing dynamic ever travels in a message. Every SMS is a fixed sentence with a
link in it, which is exactly what a DLT template allows:

```
Hi {#var#}, set your delivery location here: {#var#}  -SELLYX
```

The menu, the kitchen list and the prices live in the browser, where they change
freely. A registered template can carry a link; it cannot carry a menu.

---

## 1 · Get a number customers can text

You need an **inbound-capable 10-digit long code** from an Indian aggregator.
Gupshup, MSG91, Kaleyra and Route Mobile all sell them.

Ask for exactly this: *"a long code with inbound SMS and a webhook callback,
plus DLT-registered transactional sending."*

A **shortcode** (like 56767) also works and is more memorable, but costs lakhs a
year and takes months. A long code is thousands a month and days. Start there.

---

## 2 · Register on DLT

Done once on the portal your aggregator points you at (Jio, Airtel or Vodafone
DLT — any one of them, they share a registry).

**Principal Entity** → your company.
**Header / Sender ID** → six characters, e.g. `SELLYX`.

**Templates** — register all five, exactly as written. A single character's
difference from what you send gets the message dropped, silently:

| Template | Text |
|---|---|
| Welcome | `Hi {#var#}, set your delivery location here: {#var#}` |
| Returning | `Welcome back {#var#}. Kitchens near you: {#var#}` |
| Confirmed (UPI) | `Order {#var#} confirmed. Total Rs {#var#}. Pay here: {#var#}` |
| Confirmed (cash) | `Order {#var#} confirmed. Total Rs {#var#} cash on delivery.` |
| Delivered | `Order {#var#} delivered. Tell us how it was: {#var#}` |

**Whitelist your domain.** Links in SMS require the sending domain to be
registered on DLT. This is the step everyone forgets, and the symptom is
messages that vanish rather than fail — you will not get an error, they simply
never arrive.

Each approved template gets a **template id**. You will paste those below.

---

## 3 · Set the environment variables

Vercel → your project → **Settings → Environment Variables**.

```
SMS_PROVIDER            msg91 | gupshup | generic
SMS_API_KEY             from the aggregator
SMS_SENDER_ID           SELLYX
SMS_ENTITY_ID           your DLT principal entity id
SMS_WEBHOOK_SECRET      any long random string you invent
PUBLIC_BASE_URL         https://selly-app-afhb.vercel.app

SUPABASE_URL            https://ekughxkikjzkimadyyuk.supabase.co
SUPABASE_SERVICE_KEY    Supabase → Settings → API → service_role

DLT_TID_WELCOME         template id from DLT
DLT_TID_RETURNING       "
DLT_TID_CONFIRMED_PAY   "
DLT_TID_CONFIRMED_COD   "
DLT_TID_DELIVERED       "
```

**`SUPABASE_SERVICE_KEY` bypasses every security rule in the database.** It
belongs only in Vercel's environment variables, never in a page, never in the
repo, never in a screenshot. If it ever leaks, rotate it in Supabase immediately.

For `generic` providers also set `SMS_ENDPOINT`, and `SMS_AUTH_HEADER` if the
key goes in a custom header rather than `Authorization`.

---

## 4 · Point the aggregator at the webhook

In the aggregator's inbound / callback settings:

```
https://selly-app-afhb.vercel.app/api/sms-inbound?secret=<SMS_WEBHOOK_SECRET>
```

Method `POST`. Most send `from` and `text`; the handler accepts the usual
variants (`sender`, `mobile`, `msisdn`, `message`, `content`) because
aggregators disagree about names.

---

## 5 · Test it

Text anything to your long code. You should get back a link within seconds.

**If nothing arrives**, check in this order — it is almost always the last one:

1. Vercel → Deployments → the function log for `sms-inbound`. It returns `200`
   even on failure (aggregators retry non-200 and would spam the customer), so
   read the JSON body: it says exactly what went wrong.
2. `sent: false` with a `note` → the aggregator rejected it. The note is theirs.
3. `sent: true` but nothing arrives → **DLT.** Either the template text differs
   from what is registered, or the domain in the link is not whitelisted.

---

## What still needs deciding

**Rate limiting.** Nothing stops somebody texting repeatedly to generate links,
or scripting orders at a kitchen. Not urgent at low volume — every message costs
the sender money too — but worth a per-number limit before any of this reaches a
printed flyer.

**Cost.** Roughly 3 SMS per order (welcome, confirmation, delivered) at
₹0.15–0.25 each. At 100 orders a day that is ₹1,350–2,250 a month, against ₹20
per order in revenue. The margin is comfortable; it is worth watching rather
than ignoring.
