// ── Selly API Client ───────────────────────────────────────────────────────────
// Talks to the instagram-bot Express backend on Railway
// Attaches business_id to every request so the server knows which tenant
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
// saveBusinessSettings routes through the server (supabaseAdmin) — no direct import needed

const DEFAULT_URL = "https://instagram-bot-production-04ae.up.railway.app";
const KEY_URL     = "@selly_server_url";
const KEY_BID     = "@selly_business_id";

// ── Base URL ──────────────────────────────────────────────────────────────────
export async function getBaseUrl() {
  try {
    const saved = await AsyncStorage.getItem(KEY_URL);
    if (!saved || saved.includes("localhost") || saved.includes("127.0.0.1")) {
      await AsyncStorage.setItem(KEY_URL, DEFAULT_URL);
      return DEFAULT_URL;
    }
    return saved;
  } catch {
    return DEFAULT_URL;
  }
}

// ── Business ID ───────────────────────────────────────────────────────────────
export async function getBusinessId() {
  try {
    return (await AsyncStorage.getItem(KEY_BID)) || "default";
  } catch {
    return "default";
  }
}

// ── Axios instance with business_id injected ──────────────────────────────────
async function client() {
  const [base, bid] = await Promise.all([getBaseUrl(), getBusinessId()]);
  return axios.create({
    baseURL : base,
    timeout : 60000,                   // 60s — handles Railway cold start (can take up to 45–50s)
    headers : {
      "Content-Type"  : "application/json",
      "X-Business-ID" : bid,          // header for server middleware
    },
    params  : { bid },                 // also as query param for GET requests
  });
}

// ── Dashboard — via Railway server (same data source as Enrollments/Orders) ──
// Using the server ensures dashboard stats are computed from the same
// supabaseAdmin query, so stats always match what appears in the list screens.
export async function fetchDashboard() {
  try {
    const c = await client();
    // Fetch stats + recent 5 orders + customers in parallel
    const [ordersRes, customersRes] = await Promise.all([
      c.get("/api/orders", { params: { page: 1, limit: 5 } }),
      c.get("/api/customers", { params: { page: 1, limit: 200 } }),
    ]);
    return {
      stats    : ordersRes.data.stats     || {},
      recent   : ordersRes.data.orders    || [],
      customers: customersRes.data.customers || [],
    };
  } catch (e) {
    // Fallback to direct Supabase if server is unreachable
    const { _fetchDashboardDirect } = await import("./supabase_data");
    return _fetchDashboardDirect();
  }
}

// ── Orders — via Railway server (uses supabaseAdmin, bypasses RLS) ───────────
// This ensures orders created by the bot (with any business_id) are visible
// as long as the phone number was registered with the correct business_id.
export async function fetchOrders({ status, page = 1, limit = 20 } = {}) {
  try {
    const c = await client();
    const params = { page, limit };
    if (status) params.status = status;
    const r = await c.get("/api/orders", { params });
    return r.data;
  } catch (e) {
    // Fallback to direct Supabase if server is unavailable
    const { fetchOrders: _fetch } = await import("./supabase_data");
    return _fetch({ status, page, limit });
  }
}

export async function updateOrderStatus(orderId, status, extra = {}) {
  const c = await client();
  const r = await c.post(`/api/orders/${orderId}/status`, { status, ...extra });
  return r.data;
}

// ── Catalog — Supabase direct ─────────────────────────────────────────────────
export { fetchCatalog, addProduct, updateProduct, toggleStock, deleteProduct, uploadProductImage } from "./supabase_data";

export async function fetchInstaPost(url) {
  const c = await client();
  const r = await c.post("/api/insta/fetch", { url });
  return r.data;
}

// ── Customers — Supabase direct ───────────────────────────────────────────────
export { fetchCustomers, fetchCustomer, updateCustomerTags, updateCustomerBatch, deleteCustomer } from "./supabase_data";

// ── Batches (education class/batch grouping) ─────────────────────────────────
export async function fetchBatches() {
  const c = await client();
  const r = await c.get("/api/batches");
  return r.data; // { batches: ["Class 9", "Class 10", ...] }
}

export async function assignBatch(customerId, batch) {
  const c = await client();
  const r = await c.patch(`/api/customers/${customerId}/batch`, { batch });
  return r.data;
}

// ── Promotions ────────────────────────────────────────────────────────────────
export async function sendFlashSale(payload) {
  const c = await client();
  const r = await c.post("/api/promote/flash", payload);
  return r.data;
}

export async function sendNewArrival(payload) {
  const c = await client();
  const r = await c.post("/api/promote/newarrival", payload);
  return r.data;
}

export async function sendAbandonedCart() {
  const c = await client();
  const r = await c.post("/api/promote/abandoned", {});
  return r.data;
}

export async function sendFestivalCampaign(festivalName, discount, businessName) {
  const c = await client();
  const r = await c.post("/api/promote/festival", { festivalName, discount, businessName });
  return r.data;
}

// ── Loyalty ───────────────────────────────────────────────────────────────────
export async function fetchLoyaltyLeaderboard() {
  const c = await client();
  const r = await c.get("/api/loyalty/leaderboard");
  return r.data;
}

// ── Festivals ─────────────────────────────────────────────────────────────────
export async function fetchUpcomingFestivals(days = 14) {
  const c = await client();
  const r = await c.get(`/api/festivals/upcoming?days=${days}`);
  return r.data;
}

export async function fetchFestivalAlerts() {
  const c = await client();
  const r = await c.get("/api/festivals/alerts");
  return r.data;
}

// ── Status ────────────────────────────────────────────────────────────────────
export async function logStatus(caption, productId, productName, imageUrl) {
  const c = await client();
  const r = await c.post("/api/status/log", { caption, productId, productName, imageUrl });
  return r.data;
}

// ── Billing ───────────────────────────────────────────────────────────────────
export async function fetchSubscription() {
  const c = await client();
  const r = await c.get("/api/billing/subscription");
  return r.data;
}

export async function fetchBillingSummary() {
  const c = await client();
  const r = await c.get("/api/billing/summary");
  return r.data;
}

export async function fetchCommissions() {
  const c = await client();
  const r = await c.get("/api/billing/commissions");
  return r.data;
}

export async function recordPayment(payload) {
  const c = await client();
  const r = await c.post("/api/billing/payment", payload);
  return r.data;
}

// ── Wishlist ──────────────────────────────────────────────────────────────────
export async function fetchWishlist(customerId) {
  const c = await client();
  const r = await c.get(`/api/wishlist/${customerId}`);
  return r.data;
}

// ── Photo Inquiries ───────────────────────────────────────────────────────────
export async function fetchInquiries(pendingOnly = false) {
  const c = await client();
  const r = await c.get(`/api/inquiries${pendingOnly ? "?pending=true" : ""}`);
  return r.data;
}

export async function replyToInquiry(inquiryId, reply, productId = null) {
  const c = await client();
  const r = await c.post(`/api/inquiries/${inquiryId}/reply`, { reply, productId });
  return r.data;
}

// ── OTP ───────────────────────────────────────────────────────────────────────
export async function fetchOrderOTPs(orderId) {
  const c = await client();
  const r = await c.get(`/api/orders/${orderId}/otp`);
  return r.data;
}

// ── Tracking ──────────────────────────────────────────────────────────────────
export async function fetchTracking(awb, carrier = "shiprocket", orderId = null) {
  const c = await client();
  const params = { carrier };
  if (orderId) params.orderId = orderId;
  const r = await c.get(`/api/tracking/${awb}`, { params });
  return r.data;
}

// ── Segment Broadcast ─────────────────────────────────────────────────────────
export async function sendSegmentBroadcast(payload) {
  const c = await client();
  const r = await c.post("/api/promote/segment", payload);
  return r.data;
}

// ── Video Blast ───────────────────────────────────────────────────────────────
export async function sendVideoBlast(payload) {
  const c = await client();
  const r = await c.post("/api/promote/video", payload);
  return r.data;
}

// ── Image Blast ───────────────────────────────────────────────────────────────
export async function sendImageBlast(payload) {
  const c = await client();
  const r = await c.post("/api/promote/image", payload);
  return r.data;
}

// ── PDF / Notes Blast ─────────────────────────────────────────────────────────
export async function sendPdfBlast(payload) {
  const c = await client();
  const r = await c.post("/api/promote/pdf", payload);
  return r.data;
}

// ── Upload media file (base64) to backend → get hosted URL ───────────────────
export async function uploadMedia(payload) {
  const c = await client();
  const r = await c.post("/api/promote/upload", payload);
  return r.data;
}

// ── Import existing contacts (students / customers) ───────────────────────────
export async function importContacts(contacts) {
  const c = await client();
  const r = await c.post("/api/customers/import", { contacts });
  return r.data;
}

// ── Send custom WhatsApp message to a customer/student ────────────────────────
export async function sendMessageToCustomer(customerId, message) {
  const c = await client();
  const r = await c.post(`/api/customers/${customerId}/message`, { message });
  return r.data;
}

// ── Business Settings ─────────────────────────────────────────────────────────
// fetchBusinessSettings reads directly from Supabase (fast, RLS-aware).
// saveBusinessSettings writes to Supabase AND immediately busts the Railway
// server's in-memory settings cache so the bot picks up the new values right away
// (otherwise the server cache would hold stale data for up to 3 minutes).
export { fetchBusinessSettings } from "./supabase_data";

export async function saveBusinessSettings(payload) {
  // Route through the server which uses supabaseAdmin (bypasses RLS) and
  // automatically busts its own in-memory settings cache in the same request.
  const c = await client();
  const r = await c.post("/api/settings", payload);
  if (r.data?.error) throw new Error(r.data.error);
  return { ok: true };
}

// ── Query Inbox ───────────────────────────────────────────────────────────────
export async function fetchQueries(status = null) {
  const c = await client();
  const r = await c.get("/api/queries", { params: status ? { status } : {} });
  return r.data;
}

export async function replyToQuery(queryId, reply) {
  const c = await client();
  const r = await c.post(`/api/queries/${queryId}/reply`, { reply });
  return r.data;
}

// ── Class Schedules ───────────────────────────────────────────────────────────
export async function fetchSchedules() {
  const c = await client();
  const r = await c.get("/api/schedule");
  return r.data;
}

export async function createSchedule(payload) {
  const c = await client();
  const r = await c.post("/api/schedule", payload);
  return r.data;
}

export async function deleteSchedule(id) {
  const c = await client();
  const r = await c.delete(`/api/schedule/${id}`);
  return r.data;
}

// ── Returns / Refunds ─────────────────────────────────────────────────────────
export async function fetchReturns(status = null) {
  const c = await client();
  const r = await c.get("/api/returns", { params: status ? { status } : {} });
  return r.data;
}

export async function updateReturn(returnId, status, ownerNote = "") {
  const c = await client();
  const r = await c.patch(`/api/returns/${returnId}`, { status, owner_note: ownerNote });
  return r.data;
}

// ── Reviews ───────────────────────────────────────────────────────────────────
export async function fetchReviews() {
  const c = await client();
  const r = await c.get("/api/reviews");
  return r.data;
}

// ── Low Stock ─────────────────────────────────────────────────────────────────
export async function fetchLowStock(threshold = 5) {
  const c = await client();
  const r = await c.get("/api/catalog/low-stock", { params: { threshold } });
  return r.data;
}

// ── Admin (codeforeai.app@gmail.com only) ─────────────────────────────────────
const ADMIN_TOKEN = "selly_admin_2024"; // must match ADMIN_SECRET on Railway

async function adminClient() {
  const [base] = await Promise.all([getBaseUrl()]);
  const { default: axios } = await import("axios");
  return axios.create({
    baseURL : base,
    timeout : 60000,                   // 60s — handles Railway cold start (can take up to 45–50s)
    headers : {
      "Content-Type"  : "application/json",
      "x-admin-token" : ADMIN_TOKEN,
    },
  });
}

export async function fetchAdminClients() {
  const c = await adminClient();
  const r = await c.get("/api/admin/clients");
  return r.data;
}

export async function adminActivate(businessId) {
  const c = await adminClient();
  const r = await c.post(`/api/admin/clients/${businessId}/activate`);
  return r.data;
}

export async function adminExtend(businessId) {
  const c = await adminClient();
  const r = await c.post(`/api/admin/clients/${businessId}/extend`);
  return r.data;
}

export async function adminExpire(businessId) {
  const c = await adminClient();
  const r = await c.post(`/api/admin/clients/${businessId}/expire`);
  return r.data;
}

export async function adminRegisterNumber({ businessId, phoneNumberId, phoneNumber, token }) {
  const c = await adminClient();
  const r = await c.post("/api/admin/numbers/register", { businessId, phoneNumberId, phoneNumber, token });
  return r.data;
}

export async function fetchAdminNumbers() {
  const c = await adminClient();
  const r = await c.get("/api/admin/numbers");
  return r.data;
}

// ── Expo Push Token ───────────────────────────────────────────────────────────
// Registers the device's Expo push token with the server so the owner
// receives in-app push notifications for new orders, etc.
export async function registerPushToken(token) {
  try {
    const c = await client();
    await c.post("/api/owner/push-token", { token });
  } catch (_) { /* non-fatal */ }
}

// ── Accounting — Expenses ─────────────────────────────────────────────────────
export async function fetchExpenses({ category, limit = 100 } = {}) {
  const c = await client();
  const params = { limit };
  if (category) params.category = category;
  const r = await c.get("/api/accounting/expenses", { params });
  return r.data; // { expenses: [...] }
}

export async function addExpense({ amount, category, description, vendor, date }) {
  const c = await client();
  const r = await c.post("/api/accounting/expenses", { amount, category, description, vendor, date });
  return r.data;
}

export async function deleteExpense(id) {
  const c = await client();
  const r = await c.delete(`/api/accounting/expenses/${id}`);
  return r.data;
}

export async function fetchAccountingSummary(period = "30d") {
  const c = await client();
  const r = await c.get("/api/accounting/summary", { params: { period } });
  return r.data; // { summary: { revenue, expenses, gst_collected, gst_paid, by_category: [...] } }
}

// ── Payroll — Employees ───────────────────────────────────────────────────────
export async function fetchEmployees() {
  const c = await client();
  const r = await c.get("/api/payroll/employees");
  return r.data; // { employees: [...] }
}

export async function addEmployee({ name, role, salary, mobile }) {
  const c = await client();
  const r = await c.post("/api/payroll/employees", { name, role, salary, mobile });
  return r.data;
}

export async function updateEmployee(id, payload) {
  const c = await client();
  const r = await c.put(`/api/payroll/employees/${id}`, payload);
  return r.data;
}

export async function deleteEmployee(id) {
  const c = await client();
  const r = await c.delete(`/api/payroll/employees/${id}`);
  return r.data;
}

// ── Payroll — Attendance ──────────────────────────────────────────────────────
export async function fetchAttendance(date) {
  const c = await client();
  const r = await c.get("/api/payroll/attendance", { params: { date } });
  return r.data; // { records: [{ employee_id, status }] }
}

export async function markAttendance(employeeId, date, status) {
  const c = await client();
  const r = await c.post("/api/payroll/attendance", { employee_id: employeeId, date, status });
  return r.data;
}

// ── Payroll — Salary ──────────────────────────────────────────────────────────
export async function fetchPayrollReport(month) {
  const c = await client();
  const r = await c.get("/api/payroll/report", { params: { month } });
  return r.data; // { records: [...] }
}

export async function processPayroll(month) {
  const c = await client();
  const r = await c.post("/api/payroll/process", { month });
  return r.data;
}

// ── Bulk Catalog Import ───────────────────────────────────────────────────────
export async function parseBulkImport(text) {
  const c = await client();
  const r = await c.post("/api/catalog/parse-import", { text });
  return r.data; // { products: [{ name, price, description }] }
}

export async function bulkImportProducts(products) {
  const c = await client();
  const r = await c.post("/api/catalog/bulk-import", { products });
  return r.data; // { imported: N }
}

// ── Smart Pricing ─────────────────────────────────────────────────────────────
export async function getSmartPricing({ product, cost_price, market_info, industry }) {
  const c = await client();
  const r = await c.post("/api/ai/pricing", { product, cost_price, market_info, industry });
  return r.data; // { suggestion: "..." }
}

// ── AI Video Generation ───────────────────────────────────────────────────────
export async function generateVideo({ prompt, first_frame_image }) {
  const c = await client();
  const r = await c.post("/api/ai/video", { prompt, first_frame_image });
  return r.data; // { videoUrl: "..." }
}

// ── Instagram Publishing ──────────────────────────────────────────────────────
export async function postToInstagram({ mediaUrl, caption, mediaType = "IMAGE" }) {
  const c = await client();
  const r = await c.post("/api/instagram/post", { mediaUrl, caption, mediaType });
  return r.data; // { ok: true, postId: "..." }
}

// ── Settings ──────────────────────────────────────────────────────────────────
export async function saveServerUrl(url) {
  await AsyncStorage.setItem(KEY_URL, url);
}

export async function getServerUrl() {
  return (await AsyncStorage.getItem(KEY_URL)) || DEFAULT_URL;
}

export async function resetServerUrl() {
  await AsyncStorage.setItem(KEY_URL, DEFAULT_URL);
  return DEFAULT_URL;
}
