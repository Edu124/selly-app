// ── Store status ──────────────────────────────────────────────────────────────
// Whether the kitchen is taking orders right now, and the trading hours that
// decide it when the owner hasn't overridden them.
//
// Two things can close a store:
//   • acceptingOrders: false — the manual kill switch. Beats everything. Used
//     when the kitchen is slammed, out of gas, or short-staffed.
//   • hours — the normal weekly schedule.
//
// The manual switch wins deliberately: a rush at 8pm on a Friday is exactly when
// an owner needs to stop the tap, and hours won't help them.
//
// Persisted in business_settings.store_config (migration 002). Delivery fees are
// NOT here — they already live in the delivery_charge / free_above columns.
// ─────────────────────────────────────────────────────────────────────────────

import { fetchBusinessSettings, saveBusinessSettings } from "./api";
import { useFixtures, getDevStoreConfig, setDevStoreConfig } from "./devStore";

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DEFAULT_STORE_CONFIG = {
  acceptingOrders  : true,
  closedMessage    : "",
  // Index 0 = Sunday. null means closed that day.
  hours            : Array.from({ length: 7 }, () => ({ open: "10:00", close: "23:00" })),
  deliveryRadiusKm : 5,
  defaultPrepMinutes: 30,
};

/** Merge a stored blob over the defaults so a partial write can't break callers. */
export function normalizeStoreConfig(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  const hours = Array.isArray(c.hours) && c.hours.length === 7
    ? c.hours
    : DEFAULT_STORE_CONFIG.hours;
  return {
    acceptingOrders   : c.acceptingOrders !== false,      // default open
    closedMessage     : c.closedMessage || "",
    hours,
    deliveryRadiusKm  : Number(c.deliveryRadiusKm ?? DEFAULT_STORE_CONFIG.deliveryRadiusKm),
    defaultPrepMinutes: Number(c.defaultPrepMinutes ?? DEFAULT_STORE_CONFIG.defaultPrepMinutes),
  };
}

function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Is the store within its trading hours right now?
 * Handles past-midnight closing (open 18:00, close 02:00) — common for
 * late-night delivery kitchens, and the case a naive open<=now<=close gets wrong.
 */
export function isWithinHours(config, at = new Date()) {
  const c = normalizeStoreConfig(config);
  const now = at.getHours() * 60 + at.getMinutes();

  const todaySlot = c.hours[at.getDay()];
  if (todaySlot) {
    const open  = toMinutes(todaySlot.open);
    const close = toMinutes(todaySlot.close);
    if (open != null && close != null) {
      if (close > open) { if (now >= open && now < close) return true; }
      else if (now >= open)          return true;   // before midnight
    }
  }

  // Still inside yesterday's session, if it ran past midnight.
  const yIdx  = (at.getDay() + 6) % 7;
  const ySlot = c.hours[yIdx];
  if (ySlot) {
    const open  = toMinutes(ySlot.open);
    const close = toMinutes(ySlot.close);
    if (open != null && close != null && close <= open && now < close) return true;
  }

  return false;
}

/**
 * The single answer the rest of the app should ask for.
 * @returns {{open: boolean, reason: "manual"|"hours"|null, config: object}}
 */
export function storeOpenState(config, at = new Date()) {
  const c = normalizeStoreConfig(config);
  if (!c.acceptingOrders)        return { open: false, reason: "manual", config: c };
  if (!isWithinHours(c, at))     return { open: false, reason: "hours",  config: c };
  return { open: true, reason: null, config: c };
}

/** Human summary of today's hours, e.g. "10:00 – 23:00" or "Closed today". */
export function todayHoursText(config, at = new Date()) {
  const c = normalizeStoreConfig(config);
  const slot = c.hours[at.getDay()];
  if (!slot || !slot.open || !slot.close) return "Closed today";
  return `${slot.open} – ${slot.close}`;
}

// ── Persistence ───────────────────────────────────────────────────────────────

export async function loadStoreConfig() {
  if (useFixtures()) {
    const stored = await getDevStoreConfig();
    return {
      config  : normalizeStoreConfig(stored),
      // Delivery fee and UPI come from real columns; give the preview sane values.
      settings: { delivery_charge: 49, free_above: 599, upi_id: "crumbco@upi" },
    };
  }
  const { settings } = await fetchBusinessSettings();
  return {
    config  : normalizeStoreConfig(settings?.store_config),
    settings: settings || {},
  };
}

export async function saveStoreConfig(config) {
  const next = normalizeStoreConfig(config);
  if (useFixtures()) return setDevStoreConfig(next);
  await saveBusinessSettings({ store_config: next });
  return { ok: true };
}

/** Flip the manual switch without touching anything else in the blob. */
export async function setAcceptingOrders(config, accepting, closedMessage) {
  const next = {
    ...normalizeStoreConfig(config),
    acceptingOrders: !!accepting,
    ...(closedMessage !== undefined ? { closedMessage } : {}),
  };
  await saveStoreConfig(next);
  return next;
}
