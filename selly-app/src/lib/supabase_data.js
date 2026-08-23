// ── Supabase Direct Data Layer ────────────────────────────────────────────────
// App talks to Supabase directly (no Railway API calls needed)
// RLS automatically filters data by auth.uid() = business_id
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";

// ── Helpers ───────────────────────────────────────────────────────────────────

// _uid() — used by write operations (verified server-side, always fresh)
async function _uid() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");
  return user.id;
}

// _bid() — used by read operations: loads the cached session (fast, no network
// call) and guarantees the Supabase client has a JWT before we send any query.
// Without this, cold-start timing can cause the session to not be attached yet.
async function _bid() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Session not ready — please reopen the app");
  return session.user.id;
}

function _toProduct(row) {
  const imageUrls = row.image_urls && row.image_urls.length > 0
    ? row.image_urls
    : (row.image_url ? [row.image_url] : []);
  return {
    id           : row.id,
    name         : row.name,
    price        : Number(row.price),
    category     : row.category      || "general",
    subCategory  : row.sub_category  || "",
    isPremium    : row.is_premium     || false,
    extraFields  : row.extra_fields   || {},
    colors       : row.colors        || [],
    sizes        : row.sizes         || [],
    hasSizes     : row.has_sizes     || false,
    material     : row.material      || "",
    description  : row.description   || "",
    imageUrl     : imageUrls[0]      || "",    // primary image (backward compat)
    imageUrls    : imageUrls,                  // all images
    instaPostUrl : row.insta_post_url || "",
    rating       : row.rating != null ? Number(row.rating) : null,
    inStock      : row.in_stock,
    tags         : row.tags          || [],
    productNumber: row.product_number || "",
    stockCount   : row.stock_count != null ? Number(row.stock_count) : -1,
    videoUrl     : row.video_url     || "",
    createdAt    : row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function _toOrder(row) {
  return {
    id             : row.id,
    customerId     : row.customer_id,
    name           : row.name           || "",
    cart           : row.cart           || [],
    address        : row.address        || "",
    mobile         : row.mobile         || "",
    bill           : row.bill           || {},
    payLink        : row.pay_link       || null,
    paymentMode    : row.payment_mode   || "cod",
    status         : row.status         || "pending_payment",
    statusDates    : row.status_dates   || {},
    trackingNumber : row.tracking_number || null,
    trackingUrl    : row.tracking_url   || null,
    source         : row.source         || "whatsapp",
    // Added for the food build. Snake_case is kept here deliberately: these
    // names match the DB columns and the demo data, and the bot writes them.
    table_no       : row.table_no       ?? null,
    order_kind     : row.order_kind     || "standard",   // standard | cake
    channel        : row.channel        || "whatsapp",   // whatsapp | instagram | qr | walkin
    extra          : row.extra          || {},           // cake specs live here
    // Scheduling. Null means ASAP, which is every order placed for right now —
    // must be carried through or the Scheduled screen sees nothing at all.
    scheduled_for  : row.scheduled_for  || null,
    schedule_slot  : row.schedule_slot  || null,
    createdAt      : row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt      : row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
  };
}

function _toCustomer(row) {
  return {
    id               : row.id,
    name             : row.name             || "",
    firstName        : row.first_name       || "",
    lastName         : row.last_name        || "",
    mobile           : row.mobile           || null,
    source           : row.source           || "whatsapp",
    referralCode     : row.referral_code    || "",
    referralCount    : row.referral_count   || 0,
    referralEarnings : row.referral_earnings || 0,
    totalOrders      : row.total_orders     || 0,
    totalSpend       : Number(row.total_spend) || 0,
    firstSeenAt      : row.first_seen_at,
    lastActiveAt     : row.last_active_at,
    orderIds         : row.order_ids        || [],
    tags             : row.tags             || [],
    // Denormalised occasion for the customer-list birthday badge; `occasions`
    // remains the source of truth.
    occasionMonth    : row.occasion_month   ?? null,
    occasionDay      : row.occasion_day     ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchCatalog() {
  const bid = await _bid();
  const { data, error } = await supabase
    .from("catalog")
    .select("*")
    .eq("business_id", bid)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return { products: (data || []).map(_toProduct) };
}

export async function addProduct(product) {
  const uid = await _uid();
  const row = {
    id             : Date.now().toString(),
    business_id    : uid,
    name           : product.name          || "",
    price          : Number(product.price) || 0,
    category       : product.category      || "general",
    sub_category   : product.subCategory   || null,
    is_premium     : product.isPremium     || false,
    extra_fields   : product.extraFields   || {},
    colors         : product.colors        || [],
    sizes          : product.sizes         || [],
    has_sizes      : (product.sizes || []).length > 0,
    material       : product.material      || "",
    description    : product.description   || "",
    image_url      : (product.imageUrls || [])[0] || product.imageUrl || "",
    image_urls     : product.imageUrls     || (product.imageUrl ? [product.imageUrl] : []),
    insta_post_url : product.instaPostUrl  || "",
    rating         : product.rating        || null,
    in_stock       : product.inStock !== false,
    tags           : product.tags          || [],
    product_number : product.productNumber || "",
    stock_count    : product.stockCount != null && product.stockCount >= 0 ? product.stockCount : -1,
    video_url      : product.videoUrl      || "",
  };
  const { data, error } = await supabase
    .from("catalog")
    .insert(row)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, product: _toProduct(data) };
}

export async function updateProduct(id, changes) {
  const updates = {};
  if (changes.name        !== undefined) updates.name          = changes.name;
  if (changes.price       !== undefined) updates.price         = changes.price;
  if (changes.category    !== undefined) updates.category      = changes.category;
  if (changes.subCategory !== undefined) updates.sub_category  = changes.subCategory;
  if (changes.isPremium   !== undefined) updates.is_premium    = changes.isPremium;
  if (changes.extraFields !== undefined) updates.extra_fields  = changes.extraFields;
  if (changes.colors      !== undefined) updates.colors        = changes.colors;
  if (changes.sizes       !== undefined) { updates.sizes = changes.sizes; updates.has_sizes = changes.sizes.length > 0; }
  if (changes.material    !== undefined) updates.material      = changes.material;
  if (changes.description !== undefined) updates.description   = changes.description;
  if (changes.imageUrls   !== undefined) {
    updates.image_urls = changes.imageUrls;
    updates.image_url  = changes.imageUrls[0] || "";
  } else if (changes.imageUrl !== undefined) {
    updates.image_url = changes.imageUrl;
  }
  if (changes.inStock        !== undefined) updates.in_stock       = changes.inStock;
  if (changes.tags           !== undefined) updates.tags           = changes.tags;
  if (changes.productNumber  !== undefined) updates.product_number = changes.productNumber;
  if (changes.stockCount     !== undefined) updates.stock_count    = changes.stockCount >= 0 ? changes.stockCount : -1;
  if (changes.videoUrl       !== undefined) updates.video_url      = changes.videoUrl || "";

  const { data, error } = await supabase
    .from("catalog")
    .update(updates)
    .eq("id", String(id))
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, product: _toProduct(data) };
}

export async function toggleStock(id, inStock) {
  const { data, error } = await supabase
    .from("catalog")
    .update({ in_stock: inStock })
    .eq("id", String(id))
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, product: _toProduct(data) };
}

export async function deleteProduct(id) {
  const { error } = await supabase
    .from("catalog")
    .delete()
    .eq("id", String(id));
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ── Image Upload ──────────────────────────────────────────────────────────────
// Uploads a local image URI to Supabase Storage bucket "catalog-images"
// index = 0..4 for multi-image support (0 = primary/hero image)
// Returns the public URL of the uploaded image
export async function uploadProductImage(localUri, productId, index = 0) {
  const bid = await _bid();

  // Normalise extension — expo sometimes gives .jpeg, sometimes .jpg
  const rawExt = (localUri.split(".").pop() || "jpg").split("?")[0].toLowerCase();
  const ext    = rawExt === "jpeg" ? "jpg" : rawExt;
  const mime   = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  const path   = `${bid}/${productId}_${index}.${ext}`;

  // Use expo-file-system to read as base64 — most reliable on Android/iOS
  const FileSystem = require("expo-file-system");
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Decode base64 → Uint8Array for Supabase upload
  const binary     = atob(base64);
  const bytes      = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const { error } = await supabase.storage
    .from("catalog-images")
    .upload(path, bytes.buffer, { upsert: true, contentType: mime });
  if (error) throw new Error(error.message);

  const { data: { publicUrl } } = supabase.storage
    .from("catalog-images")
    .getPublicUrl(path);
  return publicUrl;
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────────────────────────────────────

// ── Status buckets ────────────────────────────────────────────────────────────
// The three food business types advance orders along different status paths, so
// the dashboard counts by stage rather than by literal status. Money reaching
// the till is what counts as complete.
const IN_PROGRESS = ["preparing", "baking", "ready", "served", "packed", "shipped", "out_for_delivery"];
const COMPLETED   = ["paid", "delivered"];

// Builds the dashboard stats object. `shape` picks which casing the rows use:
// raw Supabase rows are snake_case, already-mapped orders are camelCase.
function _statsFrom(rows, count, shape) {
  const created = r => (shape === "snake" ? r.created_at : r.createdAt);
  const today   = new Date().toDateString();
  const earning = r => r.status !== "pending_payment" && r.status !== "cancelled";

  return {
    total     : count || 0,
    pending   : rows.filter(r => r.status === "pending_payment").length,
    confirmed : rows.filter(r => r.status === "confirmed").length,
    inProgress: rows.filter(r => IN_PROGRESS.includes(r.status)).length,
    completed : rows.filter(r => COMPLETED.includes(r.status)).length,
    todayRevenue: rows
      .filter(r => new Date(created(r)).toDateString() === today && r.status !== "pending_payment")
      .reduce((s, r) => s + (r.bill?.total || 0), 0),
    totalRevenue: rows
      .filter(earning)
      .reduce((s, r) => s + (r.bill?.total || 0), 0),
  };
}

export async function fetchOrders({ status, page = 1, limit = 20 } = {}) {
  const bid = await _bid();

  // ── Paginated orders (for list display) ──────────────────────────────────
  let query = supabase
    .from("orders")
    .select("*", { count: "exact" })
    .eq("business_id", bid)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const orders = (data || []).map(_toOrder);

  // ── Full stats query — fetches all orders to count per-status correctly ──
  // (only run when NOT filtering by status, to avoid skewing counts)
  let stats;
  if (!status) {
    const { data: allData } = await supabase
      .from("orders")
      .select("status, bill, created_at")
      .eq("business_id", bid);
    stats = _statsFrom(allData || [], count, "snake");
  } else {
    // When filtering by status, stats are approximate from the current page
    stats = _statsFrom(orders, count, "camel");
  }

  return { orders, total: count || 0, page, stats };
}

export async function updateOrderStatus(orderId, status, extra = {}) {
  const updates = { status, updated_at: new Date().toISOString() };
  if (extra.trackingNumber) updates.tracking_number = extra.trackingNumber;
  if (extra.trackingUrl)    updates.tracking_url    = extra.trackingUrl;

  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", String(orderId))
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, order: _toOrder(data) };
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchCustomers() {
  const bid = await _bid();
  const { data, error, count } = await supabase
    .from("bot_customers")
    .select("*", { count: "exact" })
    .eq("business_id", bid)
    .order("last_active_at", { ascending: false });
  if (error) throw new Error(error.message);
  const customers = (data || []).map(_toCustomer);
  const stats = {
    total   : count || 0,
    vip     : customers.filter(c => c.tags.includes("vip")).length,
    frequent: customers.filter(c => c.tags.includes("frequent")).length,
  };
  return { customers, total: count || 0, stats };
}

export async function fetchCustomer(id) {
  const bid = await _bid();
  const { data, error } = await supabase
    .from("bot_customers")
    .select("*")
    .eq("id", id)
    .eq("business_id", bid)
    .single();
  if (error) throw new Error(error.message);
  return { customer: _toCustomer(data) };
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD — intentionally NOT exported from here.
// api.js exports fetchDashboard that routes through Railway (supabaseAdmin)
// so dashboard stats match what the Orders screen shows.
// ─────────────────────────────────────────────────────────────────────────────

// Internal helper used by api.js's fetchDashboard
export async function _fetchDashboardDirect() {
  const [ordersData, customersData] = await Promise.all([
    fetchOrders({ limit: 5 }),
    fetchCustomers(),
  ]);
  return {
    stats    : ordersData.stats     || {},
    recent   : ordersData.orders    || [],
    customers: customersData.customers || [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function updateCustomerTags(customerId, tags) {
  const { error } = await supabase
    .from("bot_customers")
    .update({ tags })
    .eq("id", customerId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/**
 * Store a recurring occasion (birthday / anniversary) against a customer.
 * Month + day only — the year is never known and the date recurs.
 * `occasions` holds the full record; this is the denormalised copy the customer
 * list reads so it can show a badge without a join.
 */
export async function updateCustomerOccasion(customerId, month, day) {
  const { error } = await supabase
    .from("bot_customers")
    .update({ occasion_month: month ?? null, occasion_day: day ?? null })
    .eq("id", customerId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteCustomer(customerId) {
  const { error } = await supabase
    .from("bot_customers")
    .delete()
    .eq("id", customerId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchBusinessSettings() {
  const uid = await _uid();
  const { data, error } = await supabase
    .from("business_settings")
    .select("*")
    .eq("business_id", uid)
    .single();
  if (error && error.code !== "PGRST116") throw new Error(error.message); // PGRST116 = not found
  return { settings: data ? { ...data, business_id: uid } : { business_id: uid } };
}

export async function saveBusinessSettings(payload) {
  const uid = await _uid();
  const { error } = await supabase
    .from("business_settings")
    .upsert({ ...payload, business_id: uid, updated_at: new Date().toISOString() }, { onConflict: "business_id" });
  if (error) throw new Error(error.message);
  return { ok: true };
}

// ── Customer packages ─────────────────────────────────────────────────────────
// The customer's monthly subscription to THIS kitchen — what grants them the
// right to choose a delivery time. Distinct from the kitchen's own Selly
// subscription, which is billed the other way round and lives behind
// fetchSubscription(). Requires migration 003.

export async function fetchCustomerPackages() {
  const bid = await _bid();

  // Lapsed rows are expired on read rather than by a cron: a kitchen that opens
  // the app after a week away should see the truth without a scheduled job
  // having run. Failure here is not fatal — the UI re-checks dates anyway.
  try {
    await supabase.rpc("expire_customer_packages", { p_business: bid });
  } catch (e) {
    console.warn("[packages] expiry pass skipped:", e.message);
  }

  const { data, error } = await supabase
    .from("customer_packages")
    .select("*")
    .eq("business_id", bid)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchCustomerPackage(mobile) {
  const bid = await _bid();
  const key = String(mobile || "").replace(/\D/g, "").slice(-10);
  if (!key) return null;

  const { data, error } = await supabase
    .from("customer_packages")
    .select("*")
    .eq("business_id", bid)
    .eq("mobile", key)
    .in("status", ["trial", "active"])
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function saveCustomerPackage(pkg) {
  const bid = await _bid();
  const row = { ...pkg, business_id: bid, mobile: String(pkg.mobile || "").replace(/\D/g, "").slice(-10) };

  // The partial unique index only covers live rows, so an upsert on
  // (business_id, mobile) would not see a cancelled row — which is what we want.
  const { data, error } = await supabase
    .from("customer_packages")
    .upsert(row, { onConflict: "business_id,mobile" })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function setOrderSchedule(orderId, { scheduledFor, slot }) {
  const bid = await _bid();
  const { data, error } = await supabase
    .from("orders")
    .update({ scheduled_for: scheduledFor, schedule_slot: slot })
    .eq("id", orderId)
    .eq("business_id", bid)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ── What this kitchen pays Selly ──────────────────────────────────────────────
// Rs 1,000 onboarding once, Rs 20 per completed order. The amount owed is
// computed from the orders table (see lib/billing.js) — this only reads the
// terms and what has already been paid. Requires migration 004.

export async function fetchBusinessBilling() {
  const bid = await _bid();

  const { data, error } = await supabase
    .from("business_billing")
    .select("*")
    .eq("business_id", bid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}

export async function fetchBillingPayments() {
  const bid = await _bid();
  const { data, error } = await supabase
    .from("billing_payments")
    .select("*")
    .eq("business_id", bid)
    .order("paid_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

// ── Creating an order by hand ─────────────────────────────────────────────────
// Phase 1 has no customer-facing page, so this is how EVERY order gets in: the
// kitchen takes it on the phone or on WhatsApp and types it here. Without it the
// app has nothing to manage, so this is the load-bearing write in the product.

export async function createOrder(input) {
  const bid = await _bid();

  const cart  = input.cart || [];
  const items = cart.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 1), 0);
  const delivery = Number(input.deliveryCharge || 0);
  const discount = Number(input.discount || 0);

  const row = {
    // Timestamp id, matching what the rest of the app and the bot already write.
    id           : String(Date.now()),
    business_id  : bid,
    name         : input.name || "Guest",
    mobile       : String(input.mobile || "").replace(/\D/g, "").slice(-10),
    cart,
    bill         : {
      subtotal: items,
      discount,
      delivery,
      total   : Math.max(0, items - discount + delivery),
    },
    address      : input.address || "",
    payment_mode : input.paymentMode || "cod",
    // A kitchen typing in an order it already agreed on the phone is not waiting
    // for a payment decision — it starts confirmed, not pending.
    status       : input.status || "confirmed",
    source       : "manual",
    channel      : "manual",
    order_kind   : input.scheduledFor ? "scheduled" : "standard",
    scheduled_for: input.scheduledFor || null,
    schedule_slot: input.scheduleSlot || null,
    extra        : input.note ? { note: input.note } : {},
    created_at   : new Date().toISOString(),
    updated_at   : new Date().toISOString(),
  };

  const { data, error } = await supabase.from("orders").insert(row).select().maybeSingle();
  if (error) throw new Error(error.message);
  return _toOrder(data || row);
}
