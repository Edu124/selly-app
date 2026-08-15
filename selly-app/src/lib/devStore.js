// ── Dev Order Store ───────────────────────────────────────────────────────────
// A local order store shared between the merchant app and the guest ordering
// page at /customer.html.
//
// WHY THIS EXISTS: the real loop is guest → WhatsApp → Meta → the Railway bot →
// the orders table → this app. The bot is not reachable from here, so without a
// stand-in there is no way to see an order arrive. This store replaces only the
// transport: the guest page writes an order in exactly the shape `_toOrder`
// produces, and the app reads it through the same fetchOrders() the real
// backend feeds. Every screen stays unmodified and unaware.
//
// On web, AsyncStorage is plain window.localStorage keyed verbatim — which is
// why a static HTML page served from the same origin (Metro serves public/ at
// the root) can write into it directly. Different ports are different origins,
// so the guest page has to live on 8081 with the app, not on its own port like
// the pitch demos.
//
// Guarded by useFixtures() — dev builds running the login bypass only.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFixtures, FX_ORDERS } from "./devFixtures";

export const DEV_ORDERS_KEY = "@selly_dev_orders";

const isWeb = typeof window !== "undefined" && !!window.localStorage;

// Fired on the same tab after a write; the browser's own `storage` event only
// fires in *other* tabs, which is the case we care about but not the only one.
const SAME_TAB_EVENT = "selly-dev-orders-changed";

// Café orders only. The cake fixtures are deliberately left out: they'd show up
// on a café owner's board as "Red Velvet · 1 kg · Eggless", which is confusing.
// Phase 5 seeds them alongside the rewritten cake screens.
function seed() {
  return [...FX_ORDERS];
}

/** All orders, newest first. Seeds fixtures on first read. */
export async function getDevOrders() {
  try {
    const raw = await AsyncStorage.getItem(DEV_ORDERS_KEY);
    if (raw == null) {
      const s = seed();
      await AsyncStorage.setItem(DEV_ORDERS_KEY, JSON.stringify(s));
      return sortNewest(s);
    }
    const parsed = JSON.parse(raw);
    return sortNewest(Array.isArray(parsed) ? parsed : seed());
  } catch {
    return sortNewest(seed());
  }
}

function sortNewest(list) {
  return [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

async function writeAll(list) {
  await AsyncStorage.setItem(DEV_ORDERS_KEY, JSON.stringify(list));
  if (isWeb) window.dispatchEvent(new Event(SAME_TAB_EVENT));
}

/** Patch one order in place (used by the status-advance path). */
export async function patchDevOrder(orderId, changes) {
  const list    = await getDevOrders();
  const updated = list.map(o =>
    String(o.id) === String(orderId)
      ? { ...o, ...changes, updatedAt: Date.now() }
      : o
  );
  await writeAll(updated);
  return updated.find(o => String(o.id) === String(orderId)) || null;
}

/** Wipe back to the seeded fixtures. */
export async function resetDevOrders() {
  await writeAll(seed());
}

/**
 * Call `cb` whenever the store changes — including writes from the guest page
 * in another tab, which is the whole point.
 * @returns an unsubscribe function.
 */
export function subscribeDevOrders(cb) {
  if (!isWeb) return () => {};
  const onStorage = (e) => { if (!e.key || e.key === DEV_ORDERS_KEY) cb(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SAME_TAB_EVENT, cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SAME_TAB_EVENT, cb);
  };
}

// ── Stats, matching the shape supabase_data._statsFrom produces ───────────────
const IN_PROGRESS = ["preparing", "baking", "ready", "served", "packed", "shipped", "out_for_delivery"];
const COMPLETED   = ["paid", "delivered"];

function statsFrom(rows) {
  const today = new Date().toDateString();
  return {
    total     : rows.length,
    pending   : rows.filter(r => r.status === "pending_payment").length,
    confirmed : rows.filter(r => r.status === "confirmed").length,
    inProgress: rows.filter(r => IN_PROGRESS.includes(r.status)).length,
    completed : rows.filter(r => COMPLETED.includes(r.status)).length,
    todayRevenue: rows
      .filter(r => new Date(r.createdAt).toDateString() === today && r.status !== "pending_payment")
      .reduce((s, r) => s + (r.bill?.total || 0), 0),
    totalRevenue: rows
      .filter(r => r.status !== "pending_payment" && r.status !== "cancelled")
      .reduce((s, r) => s + (r.bill?.total || 0), 0),
  };
}

/** Drop-in for fetchOrders() under the dev bypass. */
export async function devFetchOrders({ status, page = 1, limit = 20 } = {}) {
  const all      = await getDevOrders();
  const filtered = status ? all.filter(o => o.status === status) : all;
  const start    = (page - 1) * limit;
  return {
    orders: filtered.slice(start, start + limit),
    total : filtered.length,
    page,
    stats : statsFrom(all),
  };
}

/** Drop-in for fetchDashboard() under the dev bypass. */
export async function devFetchDashboard() {
  const all = await getDevOrders();
  return {
    stats    : statsFrom(all),
    // HomeScreen derives its panels from `recent`, so give it the full window
    // rather than the 5 rows the real endpoint returns.
    recent   : all.slice(0, 50),
    customers: [],
  };
}

export { useFixtures };
