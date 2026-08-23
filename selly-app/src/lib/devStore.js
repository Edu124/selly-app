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
  FX_SCHEDULED_ORDERS, FX_PACKAGES, FX_RATINGS,
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
  // Cloud kitchens get the scheduled orders too — a delivery kitchen with no
  // pre-booked breakfast has nothing to show on the Scheduled screen, and the
  // whole point of that screen is the batch it can see coming.
  if (industry === "cloudkitchen") return [...FX_DELIVERY_ORDERS, ...FX_SCHEDULED_ORDERS];
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
// The ordering page appends whoever orders, because sendMessageToCustomer resolves
// a bot_customers id — not a phone number. Without the customer being saved, an
// order placed from the web can never be notified, which is exactly what the real
// bot does when it creates a customer on first contact.

export const DEV_CUSTOMERS_KEY = "@selly_dev_customers";

export async function getDevCustomers() {
  try {
    const raw   = await AsyncStorage.getItem(DEV_CUSTOMERS_KEY);
    const added = raw ? JSON.parse(raw) : [];
    const extra = Array.isArray(added) ? added : [];
    // Web arrivals first — they're the ones the owner is dealing with right now.
    return [...extra, ...FX_CUSTOMERS];
  } catch {
    return [...FX_CUSTOMERS];
  }
}

// ── Complaints ────────────────────────────────────────────────────────────────
// Raised from the WhatsApp thread, handled on the app's Complaints screen. The
// record shape matches what /api/returns returns, so the screen needs no special
// casing and this can be swapped for the real endpoint later.
//
// Food complaints are not returns. Nobody sends a biryani back — the outcomes
// that matter are a refund, a credit, or remaking it.

export const DEV_COMPLAINTS_KEY = "@selly_dev_complaints";

export async function getDevComplaints() {
  try {
    const raw = await AsyncStorage.getItem(DEV_COMPLAINTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr)
      ? [...arr].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      : [];
  } catch {
    return [];
  }
}

export async function addDevComplaint(entry) {
  const list = await getDevComplaints();
  const row  = {
    id        : String(Date.now()) + Math.random().toString(36).slice(2, 5),
    status    : "pending",
    created_at: new Date().toISOString(),
    owner_note: "",
    resolution: null,
    ...entry,
  };
  await AsyncStorage.setItem(DEV_COMPLAINTS_KEY, JSON.stringify([...list, row]));
  if (isWeb) window.dispatchEvent(new Event(SAME_TAB_EVENT));
  return row;
}

export async function patchDevComplaint(id, changes) {
  const list = await getDevComplaints();
  const next = list.map(c => (String(c.id) === String(id) ? { ...c, ...changes } : c));
  await AsyncStorage.setItem(DEV_COMPLAINTS_KEY, JSON.stringify(next));
  if (isWeb) window.dispatchEvent(new Event(SAME_TAB_EVENT));
  return next.find(c => String(c.id) === String(id)) || null;
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

/**
 * Clear everything that accumulates around the orders — the sold-out list, sent
 * messages, web customers and the guest's chat session. Used by the preview reset
 * so a demo starts from a known state instead of a mix of runs.
 */
export async function clearDevSideData() {
  await AsyncStorage.multiRemove([
    DEV_CATALOG_KEY, DEV_OUTBOX_KEY, DEV_CUSTOMERS_KEY, DEV_COMPLAINTS_KEY, "@selly_web_session",
  ]);
  if (isWeb) window.dispatchEvent(new Event(SAME_TAB_EVENT));
  return { ok: true };
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

// ── Customer packages ─────────────────────────────────────────────────────────
// The CUSTOMER's monthly subscription to this kitchen, which is what buys them
// the right to choose a delivery time.
//
// Not to be confused with the kitchen's own subscription to Selly — that is
// billed to the kitchen, lives behind fetchSubscription(), and is shown on the
// Billing screen. Same word, opposite direction of payment.

export const DEV_PACKAGES_KEY = "@selly_dev_packages";

const tenDigits = (v) => String(v || "").replace(/\D/g, "").slice(-10);

export async function getDevPackages() {
  try {
    const raw = await AsyncStorage.getItem(DEV_PACKAGES_KEY);
    if (raw == null) {
      const seed = [...FX_PACKAGES];
      await AsyncStorage.setItem(DEV_PACKAGES_KEY, JSON.stringify(seed));
      return seed;
    }
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/** The live package for a mobile number, if any. Cancelled rows never match. */
export async function getDevPackageFor(mobile) {
  const key  = tenDigits(mobile);
  if (!key) return null;
  const list = await getDevPackages();
  return list.find(p => tenDigits(p.mobile) === key &&
                        (p.status === "trial" || p.status === "active")) || null;
}

export async function upsertDevPackage(pkg) {
  const key  = tenDigits(pkg.mobile);
  const list = await getDevPackages();
  const at   = list.findIndex(p => tenDigits(p.mobile) === key &&
                                   (p.status === "trial" || p.status === "active"));
  const row  = { id: String(Date.now()), created_at: new Date().toISOString(), ...pkg, mobile: key };

  const next = at === -1 ? [...list, row] : list.map((p, i) => (i === at ? { ...p, ...pkg } : p));
  await AsyncStorage.setItem(DEV_PACKAGES_KEY, JSON.stringify(next));
  if (isWeb) window.dispatchEvent(new Event(SAME_TAB_EVENT));
  return at === -1 ? row : next[at];
}

export async function cancelDevPackage(mobile) {
  const key  = tenDigits(mobile);
  const list = await getDevPackages();
  const next = list.map(p => (tenDigits(p.mobile) === key && (p.status === "trial" || p.status === "active")
    ? { ...p, status: "cancelled", cancelled_at: new Date().toISOString() }
    : p));
  await AsyncStorage.setItem(DEV_PACKAGES_KEY, JSON.stringify(next));
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

// ── Creating an order by hand (preview) ───────────────────────────────────────
// Mirrors supabase_data.createOrder so the New Order screen behaves identically
// with and without a backend.

export async function addDevOrder(input) {
  const cart     = input.cart || [];
  const items    = cart.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 1), 0);
  const delivery = Number(input.deliveryCharge || 0);
  const discount = Number(input.discount || 0);

  const order = {
    id         : String(Date.now()),
    customerId : null,
    name       : input.name || "Guest",
    mobile     : String(input.mobile || "").replace(/\D/g, "").slice(-10),
    cart,
    bill       : {
      subtotal: items,
      discount,
      delivery,
      total   : Math.max(0, items - discount + delivery),
    },
    address     : input.address || "",
    payLink     : null,
    paymentMode : input.paymentMode || "cod",
    status      : input.status || "confirmed",
    statusDates : {},
    trackingNumber: null, trackingUrl: null,
    source      : "manual",
    channel     : "manual",
    table_no    : null,
    order_kind  : input.scheduledFor ? "scheduled" : "standard",
    scheduled_for: input.scheduledFor || null,
    schedule_slot: input.scheduleSlot || null,
    extra       : input.note ? { note: input.note } : {},
    createdAt   : Date.now(),
    updatedAt   : Date.now(),
  };

  const list = await getDevOrders();
  await AsyncStorage.setItem(DEV_ORDERS_KEY, JSON.stringify([...list, order]));
  if (isWeb) window.dispatchEvent(new Event(SAME_TAB_EVENT));
  return order;
}

// ── Customer contacts and message log (preview) ───────────────────────────────

export const DEV_CONTACTS_KEY = "@selly_dev_contacts";
export const DEV_MSGLOG_KEY   = "@selly_dev_msglog";

const _ten = (v) => String(v || "").replace(/\D/g, "").slice(-10);

export async function getDevContacts() {
  try {
    const raw = await AsyncStorage.getItem(DEV_CONTACTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function upsertDevContact({ mobile, name, preferredChannel }) {
  const key = _ten(mobile);
  if (key.length !== 10) return null;

  const list = await getDevContacts();
  const at   = list.findIndex(c => _ten(c.mobile) === key);
  const patch = { mobile: key };
  if (name)             patch.name = name;
  if (preferredChannel) patch.preferred_channel = preferredChannel;

  const next = at === -1
    ? [...list, { id: String(Date.now()), preferred_channel: "whatsapp",
                  first_seen_at: new Date().toISOString(), orders_count: 0, ...patch }]
    : list.map((c, i) => (i === at ? { ...c, ...patch } : c));

  await AsyncStorage.setItem(DEV_CONTACTS_KEY, JSON.stringify(next));
  if (isWeb) window.dispatchEvent(new Event(SAME_TAB_EVENT));
  return next.find(c => _ten(c.mobile) === key);
}

export async function addDevMessageLog(entry) {
  try {
    const raw = await AsyncStorage.getItem(DEV_MSGLOG_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const row = { id: String(Date.now()), created_at: new Date().toISOString(), ...entry };
    await AsyncStorage.setItem(DEV_MSGLOG_KEY, JSON.stringify([...(Array.isArray(arr) ? arr : []), row]));
    return row;
  } catch {
    return null;
  }
}

// ── Ratings (preview) ─────────────────────────────────────────────────────────
// Seeded so the kitchen's ratings screen has a spread to show — including the
// low ones, which are the whole reason the screen exists.

export const DEV_RATINGS_KEY = "@selly_dev_ratings";

export async function getDevRatings() {
  try {
    const raw = await AsyncStorage.getItem(DEV_RATINGS_KEY);
    if (raw == null) {
      const seed = [...FX_RATINGS];
      await AsyncStorage.setItem(DEV_RATINGS_KEY, JSON.stringify(seed));
      return seed;
    }
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function addDevRating(entry) {
  const list = await getDevRatings();
  const row  = { id: String(Date.now()), created_at: new Date().toISOString(), ...entry };
  await AsyncStorage.setItem(DEV_RATINGS_KEY, JSON.stringify([...list, row]));
  if (isWeb) window.dispatchEvent(new Event(SAME_TAB_EVENT));
  return row;
}

// ── Delivery partners and tokens (preview) ────────────────────────────────────

export const DEV_PARTNERS_KEY = "@selly_dev_partners";

export async function getDevPartners() {
  try {
    const raw = await AsyncStorage.getItem(DEV_PARTNERS_KEY);
    if (raw == null) {
      const seed = [{
        id: "dp1", name: "Baner Riders", phone: "9822004455",
        access_code: "11111111-2222-3333-4444-555555555555",
        active: true, created_at: new Date().toISOString(), last_used_at: null,
      }];
      await AsyncStorage.setItem(DEV_PARTNERS_KEY, JSON.stringify(seed));
      return seed;
    }
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function addDevPartner({ name, phone }) {
  const list = await getDevPartners();
  // Good enough for a preview; the real code comes from gen_random_uuid().
  const rand = () => Math.random().toString(16).slice(2, 10);
  const row = {
    id: String(Date.now()), name, phone: phone || null,
    access_code: `${rand()}-${rand().slice(0,4)}-${rand().slice(0,4)}-${rand().slice(0,4)}-${rand()}${rand().slice(0,4)}`,
    active: true, created_at: new Date().toISOString(), last_used_at: null,
  };
  await AsyncStorage.setItem(DEV_PARTNERS_KEY, JSON.stringify([...list, row]));
  if (isWeb) window.dispatchEvent(new Event(SAME_TAB_EVENT));
  return row;
}

export async function patchDevPartner(id, changes) {
  const list = await getDevPartners();
  const next = list.map(p => (String(p.id) === String(id) ? { ...p, ...changes } : p));
  await AsyncStorage.setItem(DEV_PARTNERS_KEY, JSON.stringify(next));
  if (isWeb) window.dispatchEvent(new Event(SAME_TAB_EVENT));
  return next.find(p => String(p.id) === String(id));
}

/** Mirrors assign_delivery_token: smallest free number, no OTP for members. */
export async function assignDevToken(orderId) {
  const orders = await getDevOrders();
  const order  = orders.find(o => String(o.id) === String(orderId));
  if (!order) throw new Error("no such order");
  if (order.token && !order.delivered_at) {
    return { token: order.token, otp: order.delivery_otp || null };
  }

  const taken = new Set(orders.filter(o => o.token && !o.delivered_at).map(o => o.token));
  let token = null;
  for (let n = 1; n <= 99; n++) {
    const t = String(n).padStart(2, "0");
    if (!taken.has(t)) { token = t; break; }
  }
  if (!token) throw new Error("all 99 tokens are in use");

  const pkg = await getDevPackageFor(order.mobile);
  const otp = pkg ? null : String(Math.floor(Math.random() * 10000)).padStart(4, "0");

  await patchDevOrder(orderId, { token, delivery_otp: otp });
  return { token, otp };
}

// ── Saved addresses (preview) ─────────────────────────────────────────────────
// Mirrors supabase_data so the picker behaves identically with no backend.

export async function getDevAddresses(mobile) {
  const key  = _ten(mobile);
  const list = await getDevContacts();
  const c    = list.find(x => _ten(x.mobile) === key);
  return {
    name     : (c && c.name) || "",
    addresses: (c && Array.isArray(c.addresses)) ? c.addresses : [],
  };
}

export async function saveDevAddress(mobile, { label, address, name }) {
  const key  = _ten(mobile);
  const addr = String(address || "").trim();
  if (key.length !== 10 || !addr) return null;

  const current = await getDevAddresses(key);
  const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const tag  = label || "Other";

  // Dropped if it is the same place, OR if it reuses a named label. Somebody
  // who moves house has one Home, not two chips both saying Home with different
  // addresses on them. "Other" is exempt -- a customer legitimately has several
  // of those, and collapsing them would lose the one they meant.
  const kept = (current.addresses || []).filter(a =>
    !same(a.address || "", addr) && !(tag !== "Other" && a.label === tag));

  const next = [{ label: tag, address: addr, usedAt: new Date().toISOString() },
                ...kept].slice(0, 6);

  await upsertDevContact({ mobile: key, name });
  const list = await getDevContacts();
  const out  = list.map(c => (_ten(c.mobile) === key ? { ...c, addresses: next } : c));
  await AsyncStorage.setItem(DEV_CONTACTS_KEY, JSON.stringify(out));
  if (isWeb) window.dispatchEvent(new Event(SAME_TAB_EVENT));
  return next;
}
