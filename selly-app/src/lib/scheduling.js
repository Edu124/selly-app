// ── Scheduled orders and customer packages ────────────────────────────────────
//
// The insight this exists to serve: people do not order when they are hungry,
// they order when they have a free minute. Somebody with ten minutes at 8pm
// wants breakfast at 7am — and today the only way to get that is to remember to
// order at 6:40am, which nobody does.
//
// Two separate ideas live here, and keeping them separate matters:
//
//   SCHEDULING   when the food is wanted.        A property of the order.
//   PACKAGE      whether they may ask at all.    A property of the relationship.
//
// The package is the CUSTOMER paying the KITCHEN monthly. It has nothing to do
// with the kitchen's own subscription to Selly, which is billed elsewhere and to
// somebody else — see BillingScreen. Conflating the two is the easy mistake.
//
// No screen imports here on purpose: the navigator pulls in the screens, so a
// screen import would close a cycle.
// ─────────────────────────────────────────────────────────────────────────────

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

// ── Defaults ─────────────────────────────────────────────────────────────────
// A kitchen can override every one of these in business_settings.schedule_config.
// The windows are chosen around when Indian households actually eat, not around
// even three-hour blocks.

export const DEFAULT_SLOTS = [
  { key: "breakfast", label: "Breakfast", emoji: "🌅", from: "07:00", to: "09:30" },
  { key: "lunch",     label: "Lunch",     emoji: "🍛", from: "12:00", to: "14:30" },
  { key: "evening",   label: "Evening",   emoji: "☕", from: "16:30", to: "18:30" },
  { key: "dinner",    label: "Dinner",    emoji: "🌙", from: "19:30", to: "22:00" },
];

export const DEFAULT_SCHEDULE_CONFIG = {
  enabled     : true,
  slots       : DEFAULT_SLOTS,
  leadMinutes : 45,     // earliest a slot may be booked from now
  maxDaysAhead: 7,      // how far the calendar opens
  slotMinutes : 30,     // granularity inside a window
  packagePrice: null,   // kitchen sets this; null = not yet priced
  trialDays   : 14,
  // When true, anyone may schedule and the package only buys extras. Left false
  // because scheduling is the thing customers are being asked to pay for.
  freeWithoutPackage: false,
};

/** Merge a kitchen's stored config over the defaults. Always returns a whole config. */
export function scheduleConfig(settings) {
  const raw = (settings && (settings.schedule_config || settings.scheduleConfig)) || {};
  const cfg = Object.assign({}, DEFAULT_SCHEDULE_CONFIG, raw);
  // A partial or empty slots array should not silently remove every window.
  if (!Array.isArray(cfg.slots) || !cfg.slots.length) cfg.slots = DEFAULT_SLOTS;
  return cfg;
}

// ── Small time helpers ───────────────────────────────────────────────────────

function hhmmToMinutes(s) {
  const [h, m] = String(s || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function atMinutes(day, minutes) {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() + minutes * MIN);
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth() &&
         a.getDate()     === b.getDate();
}

export function dayLabel(date, now) {
  const today = now ? new Date(now) : new Date();
  const tomorrow = new Date(today.getTime() + DAY);
  if (sameDay(date, today))    return "Today";
  if (sameDay(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
}

export function timeLabel(date) {
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

// ── Building the picker ──────────────────────────────────────────────────────

/**
 * Every bookable time for the next `maxDaysAhead` days, grouped by day.
 *
 * A slot is offered only if it is at least `leadMinutes` away — otherwise the
 * customer books a 7:00 breakfast at 6:58 and the kitchen has already lost.
 */
export function availableDays(config, now = new Date()) {
  const cfg  = scheduleConfig({ schedule_config: config });
  const days = [];

  for (let i = 0; i < cfg.maxDaysAhead; i++) {
    const day   = new Date(now.getTime() + i * DAY);
    const times = [];

    cfg.slots.forEach((slot) => {
      const from = hhmmToMinutes(slot.from);
      const to   = hhmmToMinutes(slot.to);
      for (let m = from; m <= to; m += cfg.slotMinutes) {
        const at = atMinutes(day, m);
        if (at.getTime() - now.getTime() < cfg.leadMinutes * MIN) continue;
        times.push({
          at,
          iso     : at.toISOString(),
          slotKey : slot.key,
          slot    : slot.label,
          emoji   : slot.emoji,
          label   : timeLabel(at),
        });
      }
    });

    if (times.length) {
      days.push({ date: day, label: dayLabel(day, now), times });
    }
  }
  return days;
}

/** The named window a timestamp falls in, or "custom" if it sits outside them all. */
export function slotForTime(when, config) {
  const cfg = scheduleConfig({ schedule_config: config });
  const d   = new Date(when);
  const mins = d.getHours() * 60 + d.getMinutes();
  const hit = cfg.slots.find((s) => mins >= hhmmToMinutes(s.from) && mins <= hhmmToMinutes(s.to));
  return hit ? hit.key : "custom";
}

export function slotMeta(key, config) {
  const cfg = scheduleConfig({ schedule_config: config });
  return cfg.slots.find((s) => s.key === key) ||
         { key: "custom", label: "Custom time", emoji: "🕒", from: "", to: "" };
}

// ── Reading an order ─────────────────────────────────────────────────────────

export function isScheduled(order) {
  return !!(order && (order.scheduled_for || order.scheduledFor));
}

export function scheduledAt(order) {
  const raw = order && (order.scheduled_for || order.scheduledFor);
  return raw ? new Date(raw) : null;
}

/**
 * When the kitchen has to START for this to land on time.
 *
 * This is the number the prep queue actually runs on. An order for 7:00am with
 * 25 minutes of prep is not a 7:00am problem, it is a 6:35am problem.
 */
export function startBy(order, prepMinutes = 25) {
  const at = scheduledAt(order);
  return at ? new Date(at.getTime() - prepMinutes * MIN) : null;
}

/**
 * Should this order be in the kitchen's face right now?
 *
 * Scheduled orders stay out of the live queue until they are nearly due — that
 * is the entire point of accepting them early. `bufferMinutes` gives the kitchen
 * a little warning before the hard start time.
 */
export function isDueNow(order, prepMinutes = 25, now = new Date(), bufferMinutes = 10) {
  if (!isScheduled(order)) return true;              // ASAP orders are always due
  const start = startBy(order, prepMinutes);
  return now.getTime() >= start.getTime() - bufferMinutes * MIN;
}

/** Minutes until the kitchen must start. Negative means already late. */
export function minutesUntilStart(order, prepMinutes = 25, now = new Date()) {
  const start = startBy(order, prepMinutes);
  if (!start) return 0;
  return Math.round((start.getTime() - now.getTime()) / MIN);
}

/** Human phrasing for when this is wanted. */
export function formatWhen(order, now = new Date()) {
  const at = scheduledAt(order);
  if (!at) return "As soon as possible";
  return `${dayLabel(at, now)}, ${timeLabel(at)}`;
}

// ── Planning the day ─────────────────────────────────────────────────────────

/**
 * Group scheduled orders into days, and within a day into slots — because that
 * is how a kitchen plans. Nobody cooks one order at a time for a 7am rush; they
 * cook the whole breakfast batch.
 */
export function groupByDay(orders, config, now = new Date()) {
  const cfg  = scheduleConfig({ schedule_config: config });
  const days = new Map();

  (orders || [])
    .filter(isScheduled)
    .sort((a, b) => scheduledAt(a) - scheduledAt(b))
    .forEach((o) => {
      const at  = scheduledAt(o);
      const key = at.toDateString();
      if (!days.has(key)) {
        days.set(key, { date: at, label: dayLabel(at, now), slots: new Map(), count: 0, total: 0 });
      }
      const day  = days.get(key);
      const sKey = o.schedule_slot || o.scheduleSlot || slotForTime(at, cfg);
      if (!day.slots.has(sKey)) {
        day.slots.set(sKey, { ...slotMeta(sKey, cfg), orders: [], count: 0, total: 0, items: new Map() });
      }
      const slot = day.slots.get(sKey);
      slot.orders.push(o);
      slot.count += 1;
      day.count  += 1;

      const amount = (o.bill && o.bill.total) || o.total || 0;
      slot.total += amount;
      day.total  += amount;

      // Roll the batch up by dish — a 7am slot with eleven idlis is one job.
      (o.cart || []).forEach((line) => {
        const name = line.name || "Item";
        slot.items.set(name, (slot.items.get(name) || 0) + (line.qty || 1));
      });
    });

  return [...days.values()].map((d) => ({
    ...d,
    slots: [...d.slots.values()].map((s) => ({
      ...s,
      items: [...s.items.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty),
    })),
  }));
}

/** Scheduled orders that have come due and belong in the live queue now. */
export function dueOrders(orders, prepMinutes, now = new Date()) {
  return (orders || []).filter((o) => isScheduled(o) && isDueNow(o, prepMinutes, now));
}

/** Scheduled orders still waiting in the future. */
export function upcomingOrders(orders, prepMinutes, now = new Date()) {
  return (orders || []).filter((o) => isScheduled(o) && !isDueNow(o, prepMinutes, now));
}

// ── The customer's package ───────────────────────────────────────────────────

export const PACKAGE_STATUS = {
  trial    : { label: "Free trial", tone: "info"    },
  active   : { label: "Active",     tone: "success" },
  expired  : { label: "Expired",    tone: "warn"    },
  cancelled: { label: "Cancelled",  tone: "muted"   },
};

/** The date a package stops working, whichever of the two applies. */
export function packageEndsAt(pkg) {
  if (!pkg) return null;
  const raw = pkg.status === "trial"
    ? (pkg.trial_ends || pkg.trialEnds)
    : (pkg.period_end || pkg.periodEnd);
  return raw ? new Date(raw) : null;
}

/**
 * Whether this package grants scheduling right now.
 *
 * Deliberately re-checks the date rather than trusting `status`: a row can sit
 * at 'active' long after it lapsed if nothing has run an expiry pass, and the
 * gate should not depend on a background job having fired.
 */
export function isPackageActive(pkg, now = new Date()) {
  if (!pkg) return false;
  if (pkg.status !== "trial" && pkg.status !== "active") return false;
  const ends = packageEndsAt(pkg);
  if (!ends) return true;                       // open-ended, e.g. comped
  return ends.getTime() > now.getTime();
}

export function packageDaysLeft(pkg, now = new Date()) {
  const ends = packageEndsAt(pkg);
  if (!ends) return null;
  return Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / DAY));
}

/**
 * May this customer pick a delivery time?
 *
 * Returns a reason as well as a verdict, because every caller — the consumer
 * page and the kitchen's own order entry — needs to explain the "no".
 */
export function canSchedule(pkg, config, now = new Date()) {
  const cfg = scheduleConfig({ schedule_config: config });

  if (!cfg.enabled) {
    return { allowed: false, reason: "closed", message: "This kitchen isn't taking scheduled orders yet." };
  }
  if (cfg.freeWithoutPackage) {
    return { allowed: true, reason: "open" };
  }
  if (isPackageActive(pkg, now)) {
    const left = packageDaysLeft(pkg, now);
    return {
      allowed: true,
      reason : pkg.status === "trial" ? "trial" : "member",
      message: pkg.status === "trial" && left != null ? `Free trial · ${left} days left` : null,
    };
  }
  return {
    allowed: false,
    reason : pkg ? "lapsed" : "none",
    message: pkg
      ? "Your scheduling package has ended. Renew to pick delivery times again."
      : "Scheduling is part of the monthly package. Start a free trial to choose your delivery time.",
  };
}

/** A fresh trial package for someone who has just opted in. */
export function newTrialPackage({ mobile, name, businessId, config, now = new Date() }) {
  const cfg = scheduleConfig({ schedule_config: config });
  return {
    business_id: businessId || null,
    mobile     : String(mobile || "").replace(/\D/g, "").slice(-10),
    name       : name || null,
    plan       : "schedule",
    status     : "trial",
    price_month: cfg.packagePrice,
    started_at : new Date(now).toISOString(),
    trial_ends : new Date(now.getTime() + (cfg.trialDays || 14) * DAY).toISOString(),
    period_end : null,
    orders_used: 0,
  };
}

/** Move a package onto a paid month. Extends from whichever end is later. */
export function renewPackage(pkg, { months = 1, now = new Date() } = {}) {
  const from = Math.max(
    packageEndsAt(pkg) ? packageEndsAt(pkg).getTime() : 0,
    new Date(now).getTime()
  );
  return {
    ...pkg,
    status    : "active",
    period_end: new Date(from + months * 30 * DAY).toISOString(),
  };
}
