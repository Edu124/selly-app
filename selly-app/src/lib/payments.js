// ── Money ─────────────────────────────────────────────────────────────────────
//
// Two flows, and keeping them apart matters more than anything else in here:
//
//   CUSTOMER → KITCHEN   the bill. Goes straight to the kitchen's own UPI id.
//   KITCHEN  → SELLY     our ₹1,000 once and ₹20 per completed order.
//
// WHY THE CUSTOMER'S MONEY DOES NOT PASS THROUGH SELLY
//
// It would be convenient: we could take the bill, keep ₹20 and settle the rest.
// It would also make Selly a payment aggregator, and in India collecting
// customer funds and settling them onward is regulated by the RBI — it requires
// authorisation, or riding on a licensed aggregator's split-settlement product
// (Razorpay Route, Cashfree Easy Split) with the KYC and onboarding that brings.
//
// Neither is a code problem, and neither is something to back into by accident.
// So the customer pays the kitchen directly, Selly never touches that money, and
// we bill the kitchen separately. If split settlement is ever worth the
// licensing, only `upiLink` here has to change.
//
// WHAT A UPI INTENT LINK DOES AND DOES NOT DO
//
// It opens any UPI app with the payee and amount already filled in, and it costs
// nothing — no gateway, no per-transaction fee, no merchant onboarding. What it
// cannot do is tell us the payment happened: there is no callback. Confirmation
// is the kitchen seeing the money arrive and marking it. A gateway is what buys
// automatic confirmation, and it is the only thing that does.
// ─────────────────────────────────────────────────────────────────────────────

// A UPI id: handle@bank. Deliberately permissive on the handle — banks allow
// dots, hyphens and underscores, and rejecting a valid id is worse than passing
// a wrong one through to an app that will reject it anyway.
const VPA_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9.]{1,63}$/;

export function isValidVpa(vpa) {
  return VPA_RE.test(String(vpa || "").trim());
}

/** Two decimals, no symbol, no separators — what the UPI spec expects. */
function amt(n) {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v.toFixed(2) : null;
}

/**
 * A UPI intent link that opens the customer's payment app with everything
 * filled in.
 *
 * `ref` is the piece people leave out and then regret: it comes back on the
 * bank statement, so it is how a kitchen works out which order a ₹410 credit
 * belongs to when four arrive in the same minute.
 */
export function upiLink({ vpa, name, amount, note, ref }) {
  const pa = String(vpa || "").trim();
  if (!isValidVpa(pa)) return null;

  const params = [`pa=${encodeURIComponent(pa)}`];
  if (name)  params.push(`pn=${encodeURIComponent(String(name).slice(0, 50))}`);
  const a = amt(amount);
  if (a)     params.push(`am=${a}`);
  params.push("cu=INR");
  if (note)  params.push(`tn=${encodeURIComponent(String(note).slice(0, 50))}`);
  if (ref)   params.push(`tr=${encodeURIComponent(String(ref).slice(0, 35))}`);

  return `upi://pay?${params.join("&")}`;
}

/**
 * The same string, for rendering as a QR.
 *
 * Identical on purpose: a scanned QR and a tapped link must produce the same
 * payment, or reconciliation quietly stops working when a kitchen uses both.
 */
export const upiQrPayload = upiLink;

/** A reference the kitchen can match against a bank statement. */
export function orderRef(orderId) {
  return "SELLY" + String(orderId || "").replace(/\D/g, "").slice(-8);
}

export function billRef(businessId, period) {
  // The whole period, not a truncation. "SELLYFEEAUGUST20" reads as August 2020
  // as readily as 2026, and a reference that cannot be dated is no reference at
  // all. UPI allows 35 characters here; the full month and year fit easily.
  const p = String(period || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20);
  return "SELLYFEE" + p;
}

/**
 * Is this kitchen set up to take online payment at all?
 *
 * Returns a reason rather than a bare false, because "no" here always needs
 * explaining — the fix is a field in Settings the owner has not filled in.
 */
export function payabilityOf(settings) {
  const vpa = (settings && settings.upi_id) || "";
  if (!vpa.trim()) {
    return {
      ok: false,
      reason: "No UPI id set. Add one in Settings and customers can pay online.",
    };
  }
  if (!isValidVpa(vpa)) {
    return {
      ok: false,
      reason: `"${vpa}" doesn't look like a UPI id. It should read like name@bank.`,
    };
  }
  return { ok: true, vpa: vpa.trim() };
}

// ── What the kitchen owes Selly ──────────────────────────────────────────────
// Collected by invoice, not by auto-debit. UPI Autopay would do it hands-off but
// needs a gateway and a mandate per kitchen; at this size an invoice with a
// tappable link is less to build, less to break, and less to explain.
//
// SELLY_UPI must be a real id before any kitchen is billed. Left obviously
// unset rather than defaulted to something plausible, because a plausible wrong
// value is how money goes to the wrong account quietly.
export const SELLY_UPI  = "";                 // e.g. "selly@okicici"
export const SELLY_NAME = "Selly";

export function sellyPayable() {
  return isValidVpa(SELLY_UPI);
}

/** The link a kitchen taps to settle its monthly bill. */
export function sellyInvoiceLink({ amount, period, businessId }) {
  if (!sellyPayable()) return null;
  return upiLink({
    vpa   : SELLY_UPI,
    name  : SELLY_NAME,
    amount,
    note  : `Selly ${period || ""}`.trim(),
    ref   : billRef(businessId, period),
  });
}
