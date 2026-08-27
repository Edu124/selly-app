// ── Selly data layer ──────────────────────────────────────────────────────────
//
// One entry point for every screen. Each function here either delegates to
// supabase_data.js or, in a dev build, to the in-memory fixture store.
//
// This used to be an HTTP client for the instagram-bot Express server on
// Railway. That server was never a second database -- it ran these same queries
// against this same Supabase project with a service key, bypassing RLS. So the
// move was a rerouting, not a migration: no data changed hands.
//
// Nothing here reaches outside Supabase any more. If you are adding a function,
// it belongs in supabase_data.js with a thin delegation here.
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
// Dev-only order store, shared with the guest ordering page at /customer.html.
// No-ops outside a dev build running the login bypass.
import {
  useFixtures, devFetchOrders, devFetchDashboard, patchDevOrder,
  getDevCatalog, patchDevProduct, addDevProduct, deleteDevProduct,
  getDevCustomers, addDevOutbox, getDevSettings, setDevSettings,
  getDevComplaints, patchDevComplaint,
} from "./devStore";
// saveBusinessSettings routes through the server (supabaseAdmin) — no direct import needed

const KEY_BID = "@selly_business_id";

// ── Business ID ───────────────────────────────────────────────────────────────
export async function getBusinessId() {
  try {
    return (await AsyncStorage.getItem(KEY_BID)) || "default";
  } catch {
    return "default";
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export async function fetchDashboard() {
  if (useFixtures()) return devFetchDashboard();
  const { _fetchDashboardDirect } = await import("./supabase_data");
  return _fetchDashboardDirect();
}

// ── Orders — straight to Supabase ────────────────────────────────────────────
// This used to call Railway first and fall back here only when that failed. The
// reason was the Instagram bot: it wrote orders under whatever business_id it
// had, and the server read them with supabaseAdmin, bypassing RLS.
//
// Nothing writes orders that way any more — place_public_order stamps the right
// business_id, so RLS finds them. Meanwhile the old order cost every load a
// round trip to a host that can take 45-50s to wake, on the two screens a
// kitchen opens most. The fallback made that invisible rather than harmless.
export async function fetchOrders({ status, page = 1, limit = 20 } = {}) {
  if (useFixtures()) return devFetchOrders({ status, page, limit });
  const { fetchOrders: _fetch } = await import("./supabase_data");
  return _fetch({ status, page, limit });
}

export async function updateOrderStatus(orderId, status, extra = {}) {
  if (useFixtures()) {
    const order = await patchDevOrder(orderId, { status, ...extra });
    return { ok: true, order };
  }
  // Straight to Supabase. This used to POST to Railway with no fallback, so
  // advancing an order failed with "can't reach our servers" the moment that
  // host stopped resolving -- and advancing an order is the single most-used
  // write in the product. fetchOrders had a fallback; this never did.
  const { updateOrderStatus: f } = await import("./supabase_data");
  const order = await f(orderId, status, extra);
  return { ok: true, order };
}

// ── Catalog — Supabase direct, with a dev-store branch ───────────────────────
// These were plain re-exports, but a re-export can't be intercepted, and the
// preview needs a working menu for the sold-out list to act on.
export { uploadProductImage } from "./supabase_data";

export async function fetchCatalog() {
  if (useFixtures()) return { products: await getDevCatalog() };
  const { fetchCatalog: f } = await import("./supabase_data");
  return f();
}

export async function toggleStock(id, inStock) {
  if (useFixtures()) return { ok: true, product: await patchDevProduct(id, { inStock }) };
  const { toggleStock: f } = await import("./supabase_data");
  return f(id, inStock);
}

export async function addProduct(product) {
  if (useFixtures()) return { ok: true, product: await addDevProduct(product) };
  const { addProduct: f } = await import("./supabase_data");
  return f(product);
}

export async function updateProduct(id, changes) {
  if (useFixtures()) return { ok: true, product: await patchDevProduct(id, changes) };
  const { updateProduct: f } = await import("./supabase_data");
  return f(id, changes);
}

export async function deleteProduct(id) {
  if (useFixtures()) return deleteDevProduct(id);
  const { deleteProduct: f } = await import("./supabase_data");
  return f(id);
}


// ── Customers — Supabase direct ───────────────────────────────────────────────
export { fetchCustomer, updateCustomerTags, deleteCustomer } from "./supabase_data";

export async function fetchCustomers() {
  if (useFixtures()) {
    const customers = await getDevCustomers();
    return {
      customers,
      total: customers.length,
      stats: {
        total   : customers.length,
        vip     : customers.filter(c => c.tags.includes("vip")).length,
        frequent: customers.filter(c => c.tags.includes("frequent")).length,
      },
    };
  }
  const { fetchCustomers: f } = await import("./supabase_data");
  return f();
}


// ── Billing ───────────────────────────────────────────────────────────────────
// The Railway billing endpoints served the old Rs 3,000/month + 5% commission
// model, including a trial countdown. Both are gone: billing is now Rs 1,000
// once plus Rs 20 per completed order, computed from the orders table in
// lib/billing.js. Terms and payments come from Supabase -- see
// fetchBusinessBilling below.


// ── OTP ───────────────────────────────────────────────────────────────────────
export async function fetchOrderOTPs(orderId) {
  const { fetchOrderOTPs: f } = await import("./supabase_data");
  return f(orderId);
}


// ── Import existing contacts ──────────────────────────────────────────────────
export async function importContacts(contacts) {
  const { importContacts: f } = await import("./supabase_data");
  return f(contacts);
}


// ── Business Settings ─────────────────────────────────────────────────────────
// fetchBusinessSettings reads directly from Supabase (fast, RLS-aware).
// saveBusinessSettings writes to Supabase. It used to also bust an in-memory
// settings cache on the Railway server; there is no such cache to bust now.
export async function fetchBusinessSettings() {
  if (useFixtures()) {
    const stored = await getDevSettings();
    return { settings: { business_id: "dev-preview-business", ...stored } };
  }
  const { fetchBusinessSettings: f } = await import("./supabase_data");
  return f();
}

export async function saveBusinessSettings(payload) {
  if (useFixtures()) return setDevSettings(payload);
  // Straight to Supabase, same reason as updateOrderStatus. The server route
  // existed to bust an in-memory cache on a host that is no longer part of this
  // product; going direct meant trading hours, prep time, scheduling rules and
  // the package price all silently failed to save.
  //
  // RLS is not a problem here: the row is keyed on business_id = auth.uid(),
  // which is exactly the row the owner is allowed to write.
  const { saveBusinessSettings: f } = await import("./supabase_data");
  return f(payload);
}


// The Admin panel lived here: six endpoints on the old server for activating
// and expiring client subscriptions, plus registering WhatsApp numbers. It
// managed trial/PRO tiers that no longer exist -- billing is Rs 1,000 once plus
// Rs 20 per completed order, computed from the orders table in lib/billing.js --
// and a WhatsApp integration this product no longer uses.
//
// saveServerUrl / getServerUrl / resetServerUrl went with it. There is no
// server address to configure when the only backend is Supabase.


// ── Customer packages ─────────────────────────────────────────────────────────
// The CUSTOMER's monthly package with this kitchen, which unlocks choosing a
// delivery time. Not the kitchen's own Selly subscription — that is
// fetchSubscription() above, billed in the opposite direction.
//
// There is no Railway endpoint for these yet, so this goes straight to Supabase
// once migration 003 has been run.

export async function fetchCustomerPackages() {
  if (useFixtures()) {
    const { getDevPackages } = await import("./devStore");
    return getDevPackages();
  }
  const { fetchCustomerPackages: _f } = await import("./supabase_data");
  return _f();
}

export async function fetchCustomerPackage(mobile) {
  if (useFixtures()) {
    const { getDevPackageFor } = await import("./devStore");
    return getDevPackageFor(mobile);
  }
  const { fetchCustomerPackage: _f } = await import("./supabase_data");
  return _f(mobile);
}

export async function saveCustomerPackage(pkg) {
  if (useFixtures()) {
    const { upsertDevPackage } = await import("./devStore");
    return upsertDevPackage(pkg);
  }
  const { saveCustomerPackage: _f } = await import("./supabase_data");
  return _f(pkg);
}

export async function cancelCustomerPackage(mobile) {
  if (useFixtures()) {
    const { cancelDevPackage } = await import("./devStore");
    return cancelDevPackage(mobile);
  }
  const { saveCustomerPackage: _f } = await import("./supabase_data");
  return _f({ mobile, status: "cancelled", cancelled_at: new Date().toISOString() });
}

// ── Selly's own charges to this kitchen ───────────────────────────────────────
// Rs 1,000 onboarding, Rs 20 per completed order. What is OWED is computed from
// orders in lib/billing.js; these two only fetch the agreed terms and the
// payments already made.

export async function fetchBusinessBilling() {
  if (useFixtures()) {
    // Preview: onboarding settled, standard terms.
    return {
      business_id: "dev-preview-business",
      onboarding_fee: 1000,
      onboarding_paid: true,
      onboarding_paid_at: new Date(Date.now() - 62 * 86400000).toISOString(),
      per_order_fee: 20,
      status: "active",
    };
  }
  const { fetchBusinessBilling: f } = await import("./supabase_data");
  return f();
}

export async function fetchBillingPayments() {
  if (useFixtures()) {
    return [
      { id: "p1", kind: "onboarding", amount: 1000, method: "upi",
        paid_at: new Date(Date.now() - 62 * 86400000).toISOString() },
      { id: "p2", kind: "orders", period: "July 2026", amount: 4260, orders_count: 213,
        method: "upi", paid_at: new Date(Date.now() - 22 * 86400000).toISOString() },
    ];
  }
  const { fetchBillingPayments: f } = await import("./supabase_data");
  return f();
}

// ── Creating an order by hand ─────────────────────────────────────────────────
// The kitchen takes an order on the phone and types it in. In phase 1 this is
// the only way an order enters the system at all.

export async function createOrder(input) {
  if (useFixtures()) {
    const { addDevOrder } = await import("./devStore");
    return addDevOrder(input);
  }
  const { createOrder: f } = await import("./supabase_data");
  return f(input);
}

// ── Customer contacts and message log ─────────────────────────────────────────
// The kitchen's own address book plus a record of what was said. Both are how a
// manually-entered order becomes a customer we can reach again.

export async function fetchCustomerContacts() {
  if (useFixtures()) {
    const { getDevContacts } = await import("./devStore");
    return getDevContacts();
  }
  const { fetchCustomerContacts: f } = await import("./supabase_data");
  return f();
}

export async function upsertCustomerContact(input) {
  if (useFixtures()) {
    const { upsertDevContact } = await import("./devStore");
    return upsertDevContact(input);
  }
  const { upsertCustomerContact: f } = await import("./supabase_data");
  return f(input);
}

export async function logMessage(entry) {
  if (useFixtures()) {
    const { addDevMessageLog } = await import("./devStore");
    return addDevMessageLog(entry);
  }
  const { logMessage: f } = await import("./supabase_data");
  return f(entry);
}

// ── Complaints and ratings ────────────────────────────────────────────────────
// Both live in Supabase now rather than behind the Railway /api/returns
// endpoint: answering an unhappy customer must not depend on a second service
// being reachable.

export async function fetchComplaints(status = null) {
  if (useFixtures()) {
    const all = await getDevComplaints();
    return status ? all.filter(r => r.status === status) : all;
  }
  const { fetchComplaints: f } = await import("./supabase_data");
  return f(status);
}

export async function createComplaint(input) {
  if (useFixtures()) {
    const { addDevComplaint } = await import("./devStore");
    return addDevComplaint({
      order_id: input.orderId, mobile: input.mobile, name: input.name,
      reason: input.reason, detail: input.detail, source: "kitchen",
    });
  }
  const { createComplaint: f } = await import("./supabase_data");
  return f(input);
}

export async function resolveComplaint(id, changes) {
  if (useFixtures()) {
    return patchDevComplaint(id, {
      status     : changes.status,
      resolution : changes.resolution || null,
      owner_note : changes.note || "",
      amount     : changes.amount ?? null,
      resolved_at: new Date().toISOString(),
    });
  }
  const { resolveComplaint: f } = await import("./supabase_data");
  return f(id, changes);
}

export async function fetchRatings() {
  if (useFixtures()) {
    const { getDevRatings } = await import("./devStore");
    return getDevRatings();
  }
  const { fetchRatings: f } = await import("./supabase_data");
  return f();
}

// ── Delivery partners and packet tokens ───────────────────────────────────────

export async function fetchDeliveryPartners() {
  if (useFixtures()) {
    const { getDevPartners } = await import("./devStore");
    return getDevPartners();
  }
  const { fetchDeliveryPartners: f } = await import("./supabase_data");
  return f();
}

export async function addDeliveryPartner(input) {
  if (useFixtures()) {
    const { addDevPartner } = await import("./devStore");
    return addDevPartner(input);
  }
  const { addDeliveryPartner: f } = await import("./supabase_data");
  return f(input);
}

export async function setPartnerActive(id, active) {
  if (useFixtures()) {
    const { patchDevPartner } = await import("./devStore");
    return patchDevPartner(id, { active });
  }
  const { setPartnerActive: f } = await import("./supabase_data");
  return f(id, active);
}

export async function assignDeliveryToken(orderId) {
  if (useFixtures()) {
    const { assignDevToken } = await import("./devStore");
    return assignDevToken(orderId);
  }
  const { assignDeliveryToken: f } = await import("./supabase_data");
  return f(orderId);
}

// ── Saved addresses ───────────────────────────────────────────────────────────

export async function fetchCustomerAddresses(mobile) {
  if (useFixtures()) {
    const { getDevAddresses } = await import("./devStore");
    return getDevAddresses(mobile);
  }
  const { fetchCustomerAddresses: f } = await import("./supabase_data");
  return f(mobile);
}

export async function saveCustomerAddress(mobile, entry) {
  if (useFixtures()) {
    const { saveDevAddress } = await import("./devStore");
    return saveDevAddress(mobile, entry);
  }
  const { saveCustomerAddress: f } = await import("./supabase_data");
  return f(mobile, entry);
}

// ── Marking an order paid ─────────────────────────────────────────────────────

export async function markOrderPaid(orderId, opts = {}) {
  if (useFixtures()) {
    const { patchDevOrder } = await import("./devStore");
    const order = await patchDevOrder(orderId, {
      paid_at    : opts.paid === false ? null : new Date().toISOString(),
      payment_ref: opts.paid === false ? null : (opts.ref || null),
    });
    return order;
  }
  const { markOrderPaid: f } = await import("./supabase_data");
  return f(orderId, opts);
}

// ── Accounting ────────────────────────────────────────────────────────────────
// Requires migration FIX_014.

export async function fetchExpenses(opts) {
  const { fetchExpenses: f } = await import("./supabase_data");
  return f(opts);
}

export async function addExpense(payload) {
  const { addExpense: f } = await import("./supabase_data");
  return f(payload);
}

export async function deleteExpense(id) {
  const { deleteExpense: f } = await import("./supabase_data");
  return f(id);
}

export async function fetchAccountingSummary(period = "30d") {
  const { fetchAccountingSummary: f } = await import("./supabase_data");
  return f(period);
}

// ── Payroll ───────────────────────────────────────────────────────────────────

export async function fetchEmployees() {
  const { fetchEmployees: f } = await import("./supabase_data");
  return f();
}

export async function addEmployee(payload) {
  const { addEmployee: f } = await import("./supabase_data");
  return f(payload);
}

export async function updateEmployee(id, payload) {
  const { updateEmployee: f } = await import("./supabase_data");
  return f(id, payload);
}

export async function deleteEmployee(id) {
  const { deleteEmployee: f } = await import("./supabase_data");
  return f(id);
}

export async function fetchAttendance(date) {
  const { fetchAttendance: f } = await import("./supabase_data");
  return f(date);
}

export async function markAttendance(employeeId, date, status) {
  const { markAttendance: f } = await import("./supabase_data");
  return f(employeeId, date, status);
}

export async function fetchPayrollReport(month) {
  const { fetchPayrollReport: f } = await import("./supabase_data");
  return f(month);
}

export async function processPayroll(month) {
  const { processPayroll: f } = await import("./supabase_data");
  return f(month);
}
