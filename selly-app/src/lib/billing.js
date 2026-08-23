// ── What the kitchen pays Selly ───────────────────────────────────────────────
//
// The model, in full:
//
//   ₹1,000  once, to onboard
//   ₹20     per order that actually completes
//
// That is the whole price list. No monthly fee, no percentage of the bill, no
// tiers. Two consequences worth stating because they are the point:
//
//   · A kitchen that sells nothing pays nothing. Our revenue only moves when
//     theirs does, so there is never a month where we are billing a kitchen for
//     a service that did not earn them anything.
//   · ₹20 is a FLAT fee, not a commission. On a ₹200 order it is ₹20; on a
//     ₹2,000 order it is still ₹20. A kitchen that grows its average order keeps
//     all of the upside — which is the opposite of how an aggregator works.
//
// WHAT COUNTS AS BILLABLE is the load-bearing decision here. An order the
// customer cancelled, or one the kitchen rejected, earned the kitchen nothing —
// billing for it would make us money on their bad day. So only orders that
// reached the customer count.
//
// Replaces the old ₹3,000/month + 5% commission model that lived in
// src/subscriptions.js and src/commission.js — those were Node modules sitting
// in a React Native app and could never have run here.
// ─────────────────────────────────────────────────────────────────────────────

export const PER_ORDER_FEE  = 20;      // ₹ per completed order
export const ONBOARDING_FEE = 1000;    // ₹ once, at signup

// An order is billable once it has reached the customer. Anything that fell over
// on the way — cancelled, rejected, refunded, never paid for — is not.
export const BILLABLE_STATUSES = ["delivered", "paid", "served", "completed"];

// Explicitly not billable. Listed rather than inferred so the intent survives
// somebody adding a new status later.
export const NON_BILLABLE_STATUSES = [
  "pending_payment", "cancelled", "rejected", "refunded", "failed",
];

export function isBillable(order) {
  return !!order && BILLABLE_STATUSES.includes(order.status);
}

/** Start of the calendar month containing `at`. Billing periods are months. */
export function periodStart(at = new Date()) {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

export function periodEnd(at = new Date()) {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function periodLabel(at = new Date()) {
  return new Date(at).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

function orderTime(o) {
  // Orders carry createdAt as a number in the dev store and an ISO string from
  // Supabase. Accept both rather than making callers normalise.
  const raw = o.createdAt ?? o.created_at;
  const n   = typeof raw === "number" ? raw : Date.parse(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * What this kitchen owes for one month.
 *
 * Computed from the orders themselves rather than from a running counter: a
 * counter drifts the first time an order is edited, cancelled late or
 * back-dated, and a kitchen disputing its bill can be walked through the
 * individual orders that made it.
 */
export function billForPeriod(orders, { at = new Date(), onboardingPaid = false } = {}) {
  const from = periodStart(at).getTime();
  const to   = periodEnd(at).getTime();

  const inPeriod = (orders || []).filter(o => {
    const t = orderTime(o);
    return t >= from && t <= to;
  });

  const billable = inPeriod.filter(isBillable);
  const skipped  = inPeriod.filter(o => !isBillable(o));

  const orderCharges = billable.length * PER_ORDER_FEE;
  const onboarding   = onboardingPaid ? 0 : ONBOARDING_FEE;

  return {
    period      : periodLabel(at),
    periodStart : new Date(from),
    periodEnd   : new Date(to),

    ordersTotal : inPeriod.length,
    ordersBilled: billable.length,
    ordersFree  : skipped.length,

    perOrderFee : PER_ORDER_FEE,
    orderCharges,
    onboarding,
    totalDue    : orderCharges + onboarding,

    // Kept so the Billing screen can show the kitchen exactly which orders it is
    // paying for, rather than asking them to trust a number.
    billableOrders: billable,
  };
}

/**
 * What the kitchen would have paid an aggregator on the same orders.
 *
 * Included because ₹20 sounds like a lot until you put it beside 25% of the
 * bill. Deliberately uses the kitchen's own order values, not an average.
 */
export function aggregatorComparison(billableOrders, commissionPct = 0.25) {
  const gross = (billableOrders || []).reduce(
    (s, o) => s + Number((o.bill && o.bill.total) || o.total || 0), 0
  );
  const theirCut = Math.round(gross * commissionPct);
  const ourFee   = (billableOrders || []).length * PER_ORDER_FEE;
  return {
    gross,
    commissionPct,
    theirCut,
    ourFee,
    saved: Math.max(0, theirCut - ourFee),
  };
}

/** Rolling view across recent months, newest first. For the billing history. */
export function billingHistory(orders, months = 6, at = new Date()) {
  const out = [];
  for (let i = 0; i < months; i++) {
    const when = new Date(at.getFullYear(), at.getMonth() - i, 1);
    const bill = billForPeriod(orders, { at: when, onboardingPaid: true });
    if (bill.ordersTotal === 0 && i > 0) continue;   // skip dead months, keep this one
    out.push(bill);
  }
  return out;
}

/** Normalise whatever the billing row looks like into something the UI can use. */
export function normalizeBilling(row) {
  const r = row || {};
  return {
    onboardingPaid  : !!r.onboarding_paid,
    onboardingPaidAt: r.onboarding_paid_at ? new Date(r.onboarding_paid_at) : null,
    perOrderFee     : Number(r.per_order_fee ?? PER_ORDER_FEE),
    onboardingFee   : Number(r.onboarding_fee ?? ONBOARDING_FEE),
    status          : r.status || "active",
  };
}
