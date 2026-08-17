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
import {
  useFixtures, FX_ORDERS, FX_DELIVERY_ORDERS, FX_CAKE_ORDERS,
  FX_CUSTOMERS, FX_CATALOG, FX_SETTINGS,
} from "./devFixtures";

export const DEV_ORDERS_KEY = "@selly_dev_orders";
// The chosen business type, persisted so a reload doesn't send you back through
// the setup screen — and so the seed below knows which demo data to lay down.
export const DEV_INDUSTRY_KEY = "@selly_dev_industry";
// Trading state, read by the guest ordering page so it can refuse politely when
// the kitchen is shut.
export const DEV_STORE_CONFIG_KEY = "@selly_dev_store_config";

const isWeb = typeof window !== "undefined" && !!window.localStorage;

// Fired on the same tab after a write; the browser's own `storage` event only
// fires in *other* tabs, which is the case we care about but not the only one.
const SAME_TAB_EVENT = "selly-dev-orders-changed";

/** The persisted business type, or null before setup has run. */
export async function getDevIndustry() {
  try {
    return await AsyncStorage.getItem(DEV_INDUSTRY_KEY);
  } catch {
    return null;
  }
}

export async function setDevIndustry(industry) {
  try {
    if (industry) await AsyncStorage.setItem(DEV_INDUSTRY_KEY, String(industry));
    else          await AsyncStorage.removeItem(DEV_INDUSTRY_KEY);
  } catch { /* preview convenience only — never worth surfacing */ }
}

// Seed data has to match the business type. A cloud kitchen has no tables, so
// seeding it with café orders showed a table number on every order — orders that
// were never eaten in. Bakery gets cake orders for the same reason.
function seedFor(industry) {
  if (industry === "cloudkitchen") return [...FX_DELIVERY_ORDERS];
  if (industry === "bakery")       return [...FX_CAKE_ORDERS];
  return [...FX_ORDERS];
}

/** All orders, newest first. Seeds type-appropriate fixtures on first read. */
export async function getDevOrders() {
  try {
    const raw = await AsyncStorage.getItem(DEV_ORDERS_KEY);
    if (raw == null) {
      const s = seedFor(await getDevIndustry());
      await AsyncStorage.setItem(DEV_ORDERS_KEY, JSON.stringify(s));
      return sortNewest(s);
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return sortNewest(seedFor(await getDevIndustry()));
    return sortNewest(parsed);
  } catch {
    return sortNewest(FX_ORDERS);
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

/**
 * Wipe back to the fixtures for a business type. Called when the type changes,
 * because switching from a café to a cloud kitchen is a different scenario, not
 * the same orders relabelled.
 */
export async function resetDevOrders(industry) {
  await writeAll(seedFor(industry ?? (await getDevIndustry())));
}

/**
 * Call `cb` whenever the store changes — including writes from the guest page
 * in another tab, which is the whole point.
 * @returns an unsubscribe function.
 */
export function subscribeDevOrders(cb) {
  if (!isWeb) return () => {};
  const onStorage = (e) => {
    if (!e.key || e.key === DEV_ORDERS_KEY || e.key === DEV_STORE_CONFIG_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SAME_TAB_EVENT, cb);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SAME_TAB_EVENT, cb);
  };
}

// ── Catalog ───────────────────────────────────────────────────────────────────
// Persisted so the sold-out state survives a reload — an owner who marks the
// biryani off at 8pm expects it to still be off at 8:05.

export const DEV_CATALOG_KEY = "@selly_dev_catalog";

export async function getDevCatalog() {
  try {
    const raw = await AsyncStorage.getItem(DEV_CATALOG_KEY);
    if (raw == null) {
      await AsyncStorage.setItem(DEV_CATALOG_KEY, JSON.stringify(FX_CATALOG));
      return [...FX_CATALOG];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...FX_CATALOG];
  } catch {
    return [...FX_CATALOG];
  }
}

async function writeCatalog(list) {
  await AsyncStorage.setItem(DEV_CATALOG_KEY, JSON.stringify(list));
  if (isWeb) window.dispatchEvent(new Event(SAME_TAB_EVENT));
}

export async function patchDevProduct(id, changes) {
  const list = await getDevCatalog();
  const next = list.map(p => (String(p.id) === String(id) ? { ...p, ...changes } : p));
  await writeCatalog(next);
  return next.find(p => String(p.id) === String(id)) || null;
}

export async function addDevProduct(product) {
  const list = await getDevCatalog();
  const row  = { ...product, id: String(Date.now()), createdAt: Date.now() };
  await writeCatalog([...list, row]);
  return row;
}

export async function deleteDevProduct(id) {
  const list = await getDevCatalog();
  await writeCatalog(list.filter(p => String(p.id) !== String(id)));
  return { ok: true };
}

// ── Customers ─────────────────────────────────────────────────────────────────

export async function getDevCustomers() {
  return [...FX_CUSTOMERS];
}

// ── Outbox ────────────────────────────────────────────────────────────────────
// Every WhatsApp message the app would have sent. The Railway send path isn't
// reachable from here, so rather than swallow the message this records it — which
// also gives the owner a trail of what the customer was actually told.

export const DEV_OUTBOX_KEY = "@selly_dev_outbox";

export async function getDevOutbox() {
  try {
    const raw = await AsyncStorage.getItem(DEV_OUTBOX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addDevOutbox(entry) {
  const list = await getDevOutbox();
  const row  = { id: String(Date.now()) + Math.random().toString(36).slice(2, 6), sentAt: Date.now(), ...entry };
  const next = [...list, row].slice(-200);   // keep the log from growing forever
  await AsyncStorage.setItem(DEV_OUTBOX_KEY, JSON.stringify(next));
  if (isWeb) window.dispatchEvent(new Event(SAME_TAB_EVENT));
  return row;
}

// ── Business settings ─────────────────────────────────────────────────────────
// Merged over the fixtures so a partial save (which is how every settings screen
// writes) doesn't wipe the rest of the row.

export const DEV_SETTINGS_KEY = "@selly_dev_settings";

export async function getDevSettings() {
  try {
    const raw = await AsyncStorage.getItem(DEV_SETTINGS_KEY);
    return { ...FX_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return { ...FX_SETTINGS };
  }
}

export async function setDevSettings(patch) {
  const current = await getDevSettings();
  const next    = { ...current, ...patch };
  await AsyncStorage.setItem(DEV_SETTINGS_KEY, JSON.stringify(next));
  if (isWeb) window.dispatchEvent(new Event(SAME_TAB_EVENT));
  return { ok: true };
}

// ── Store config (trading state) ──────────────────────────────────────────────
// Kept alongside the orders so the guest page can read both from one origin.

export async function getDevStoreConfig() {
  try {
    const raw = await AsyncStorage.getItem(DEV_STORE_CONFIG_KEY);
    return raw == null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function setDevStoreConfig(config) {
  await AsyncStorage.setItem(DEV_STORE_CONFIG_KEY, JSON.stringify(config));
  if (isWeb) window.dispatchEvent(new Event(SAME_TAB_EVENT));
  return { ok: true };
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
