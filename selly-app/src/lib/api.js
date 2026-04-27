// ── Selly API Client ───────────────────────────────────────────────────────────
// Talks to the instagram-bot Express backend on Railway
// Attaches business_id to every request so the server knows which tenant
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEFAULT_URL = "https://instagram-bot-production-ef01.up.railway.app";
const KEY_URL     = "@selly_server_url";
const KEY_BID     = "@selly_business_id";

// ── Base URL ──────────────────────────────────────────────────────────────────
async function getBaseUrl() {
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
async function getBusinessId() {
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
    timeout : 20000,
    headers : {
      "Content-Type"  : "application/json",
      "X-Business-ID" : bid,          // header for server middleware
    },
    params  : { bid },                 // also as query param for GET requests
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export async function fetchDashboard() {
  const c = await client();
  const [ordersRes, customersRes] = await Promise.all([
    c.get("/api/orders?limit=5"),
    c.get("/api/customers"),
  ]);
  return {
    stats    : ordersRes.data.stats     || {},
    recent   : ordersRes.data.orders    || [],
    customers: customersRes.data.customers || [],
  };
}

// ── Orders ────────────────────────────────────────────────────────────────────
export async function fetchOrders({ status, page = 1 } = {}) {
  const c = await client();
  const params = { page, limit: 20 };
  if (status) params.status = status;
  const r = await c.get("/api/orders", { params });
  return r.data;
}

export async function updateOrderStatus(orderId, status, extra = {}) {
  const c = await client();
  const r = await c.post(`/api/orders/${orderId}/status`, { status, ...extra });
  return r.data;
}

// ── Catalog ───────────────────────────────────────────────────────────────────
export async function fetchCatalog() {
  const c = await client();
  const r = await c.get("/api/catalog");
  return r.data;
}

export async function addProduct(product) {
  const c = await client();
  const r = await c.post("/api/catalog/add", product);
  return r.data;
}

export async function updateProduct(id, changes) {
  const c = await client();
  const r = await c.put(`/api/catalog/${id}`, changes);
  return r.data;
}

export async function toggleStock(id, inStock) {
  const c = await client();
  const r = await c.post("/api/catalog/stock", { id, inStock });
  return r.data;
}

export async function deleteProduct(id) {
  const c = await client();
  const r = await c.delete(`/api/catalog/${id}`);
  return r.data;
}

export async function fetchInstaPost(url) {
  const c = await client();
  const r = await c.post("/api/insta/fetch", { url });
  return r.data;
}

// ── Customers ─────────────────────────────────────────────────────────────────
export async function fetchCustomers() {
  const c = await client();
  const r = await c.get("/api/customers");
  return r.data;
}

export async function fetchCustomer(id) {
  const c = await client();
  const r = await c.get(`/api/customers/${id}`);
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

// ── Business Settings ─────────────────────────────────────────────────────────
export async function fetchBusinessSettings() {
  const c = await client();
  const r = await c.get("/api/settings");
  return r.data;
}

export async function saveBusinessSettings(payload) {
  const c = await client();
  const r = await c.post("/api/settings", payload);
  return r.data;
}

// ── Admin (codeforeai.app@gmail.com only) ─────────────────────────────────────
const ADMIN_TOKEN = "selly_admin_2024"; // must match ADMIN_SECRET on Railway

async function adminClient() {
  const [base] = await Promise.all([getBaseUrl()]);
  const { default: axios } = await import("axios");
  return axios.create({
    baseURL : base,
    timeout : 20000,
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
