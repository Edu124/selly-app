// ── Dev Fixtures ──────────────────────────────────────────────────────────────
// AuthContext has a DEV_PREVIEW_BYPASS that skips Supabase login so the UI can
// be browsed locally. The catch: with no session, every _uid()/_bid() call in
// supabase_data.js throws "Not logged in", so every screen renders an error or
// an empty list — which makes the new café / bakery / discovery screens
// impossible to develop against, and impossible to demo on a laptop.
//
// These fixtures fill that gap. Each data module checks `useFixtures()` first
// and falls through to Supabase otherwise, so this file has zero effect on a
// real signed-in session or on any production build.
//
// The data mirrors the client-approved demos (Crumb & Co. cafe, Crumb & Cream
// cake shop, Koregaon Park discovery) so the app and the demos tell one story.
// ─────────────────────────────────────────────────────────────────────────────

// Mirrors AuthContext's own flag. Kept as a separate constant rather than
// imported so this module has no dependency on the auth graph.
const DEV_PREVIEW_BYPASS = true;
const FIXTURE_BUSINESS_ID = "dev-preview-business";

/** True only in a dev build running the login bypass. */
export function useFixtures() {
  return typeof __DEV__ !== "undefined" && __DEV__ && DEV_PREVIEW_BYPASS;
}

const hoursAgo = h => Date.now() - h * 3600_000;
const minsAgo  = m => Date.now() - m * 60_000;

// ── Café ──────────────────────────────────────────────────────────────────────

export const FX_CAFE_CONFIG = {
  tableCount : 8,
  upiVpa     : "crumbco@upi",
  prepMinutes: 8,
  menuSlug   : "crumbco",
  waNumber   : "+91 98765 43210",
};

export const FX_TABLES = [
  { id: "t1", business_id: FIXTURE_BUSINESS_ID, table_no: 1, label: null,        seats: 2, state: "free"    },
  { id: "t2", business_id: FIXTURE_BUSINESS_ID, table_no: 2, label: null,        seats: 4, state: "seated"  },
  { id: "t3", business_id: FIXTURE_BUSINESS_ID, table_no: 3, label: null,        seats: 4, state: "ordered" },
  { id: "t4", business_id: FIXTURE_BUSINESS_ID, table_no: 4, label: null,        seats: 2, state: "free"    },
  { id: "t5", business_id: FIXTURE_BUSINESS_ID, table_no: 5, label: null,        seats: 6, state: "served"  },
  { id: "t6", business_id: FIXTURE_BUSINESS_ID, table_no: 6, label: null,        seats: 4, state: "free"    },
  { id: "t7", business_id: FIXTURE_BUSINESS_ID, table_no: 7, label: "Window",    seats: 4, state: "bill"    },
  { id: "t8", business_id: FIXTURE_BUSINESS_ID, table_no: 8, label: "Terrace",   seats: 6, state: "free"    },
];

// Shaped exactly like _toOrder() output so screens need no special-casing.
export const FX_ORDERS = [
  {
    id: "1755001001", customerId: "c1", name: "Aarav", mobile: "+91 98220 11223",
    cart: [
      { name: "Cappuccino",        size: "Regular", qty: 2, price: 180 },
      { name: "Chocolate Brownie", size: null,      qty: 1, price: 180 },
    ],
    bill: { subtotal: 540, discount: 0, delivery: 0, total: 540 },
    address: "", payLink: null, paymentMode: "upi", status: "served",
    statusDates: {}, trackingNumber: null, trackingUrl: null,
    source: "whatsapp", channel: "qr", table_no: 7, order_kind: "standard",
    extra: {}, createdAt: minsAgo(38), updatedAt: minsAgo(4),
  },
  {
    id: "1755001002", customerId: "c2", name: "Table 3", mobile: "+91 98220 44556",
    cart: [
      { name: "Filter Coffee",    size: "Regular", qty: 2, price: 120 },
      { name: "Butter Croissant", size: null,      qty: 2, price: 150 },
    ],
    bill: { subtotal: 540, discount: 0, delivery: 0, total: 540 },
    address: "", payLink: null, paymentMode: "cod", status: "confirmed",
    statusDates: {}, trackingNumber: null, trackingUrl: null,
    source: "whatsapp", channel: "qr", table_no: 3, order_kind: "standard",
    extra: {}, createdAt: minsAgo(9), updatedAt: minsAgo(9),
  },
  {
    id: "1755001003", customerId: "c3", name: "Ishita", mobile: "+91 98220 77889",
    cart: [
      { name: "Avocado Toast", size: null,      qty: 1, price: 320 },
      { name: "Cold Brew",     size: "Regular", qty: 1, price: 220 },
    ],
    bill: { subtotal: 540, discount: 0, delivery: 0, total: 540 },
    address: "", payLink: null, paymentMode: "upi", status: "preparing",
    statusDates: {}, trackingNumber: null, trackingUrl: null,
    source: "whatsapp", channel: "qr", table_no: 5, order_kind: "standard",
    extra: {}, createdAt: minsAgo(16), updatedAt: minsAgo(11),
  },
  {
    id: "1755001004", customerId: "c4", name: "Rohan", mobile: "+91 98220 22110",
    cart: [{ name: "Pancake Stack", size: null, qty: 2, price: 290 }],
    bill: { subtotal: 580, discount: 0, delivery: 0, total: 580 },
    address: "", payLink: null, paymentMode: "upi", status: "paid",
    statusDates: {}, trackingNumber: null, trackingUrl: null,
    source: "whatsapp", channel: "qr", table_no: 2, order_kind: "standard",
    extra: {}, createdAt: hoursAgo(3), updatedAt: hoursAgo(2),
  },
];

// ── Cloud kitchen ─────────────────────────────────────────────────────────────
// Delivery orders: an address, no table, and channel "web". A cloud kitchen has
// no tables, so seeding it with the café orders above would show table numbers
// for orders that were never eaten in. Menu matches public/order.html so the
// owner screens and the ordering page tell one story.

export const FX_DELIVERY_ORDERS = [
  {
    id: "1755003001", customerId: "d1", name: "Priya Nair", mobile: "+919820011223",
    cart: [
      { name: "Butter Chicken",       productNumber: "m1", size: null, qty: 1, price: 320 },
      { name: "Butter Naan",          productNumber: "b1", size: null, qty: 3, price: 45  },
    ],
    bill: { subtotal: 455, discount: 0, delivery: 49, total: 504 },
    address: "Flat 402, Sunrise Apartments, Baner Road, near D-Mart",
    payLink: null, paymentMode: "cod", status: "preparing",
    statusDates: {}, trackingNumber: null, trackingUrl: null,
    source: "web", channel: "web", table_no: null, order_kind: "standard",
    extra: { note: "less spicy please" },
    createdAt: minsAgo(12), updatedAt: minsAgo(6),
  },
  {
    id: "1755003002", customerId: "d2", name: "Arjun Mehta", mobile: "+919820044556",
    cart: [
      { name: "Chicken Biryani",      productNumber: "m4", size: null, qty: 2, price: 280 },
      { name: "Jeera Rice",           productNumber: "b3", size: null, qty: 1, price: 120 },
    ],
    bill: { subtotal: 680, discount: 0, delivery: 0, total: 680 },
    address: "3rd floor, Nucleus Mall office block, Camp",
    payLink: null, paymentMode: "upi", status: "confirmed",
    statusDates: {}, trackingNumber: null, trackingUrl: null,
    source: "web", channel: "web", table_no: null, order_kind: "standard",
    extra: {},
    createdAt: minsAgo(4), updatedAt: minsAgo(4),
  },
  {
    id: "1755003003", customerId: "d3", name: "Fatima Shaikh", mobile: "+919820077889",
    cart: [
      { name: "Veg Thali",            productNumber: "t1", size: null, qty: 2, price: 180 },
    ],
    bill: { subtotal: 360, discount: 0, delivery: 49, total: 409 },
    address: "Shop 7, Kalyani Nagar market lane",
    payLink: null, paymentMode: "cod", status: "out_for_delivery",
    statusDates: {}, trackingNumber: null, trackingUrl: null,
    source: "whatsapp", channel: "whatsapp", table_no: null, order_kind: "standard",
    extra: {},
    createdAt: minsAgo(38), updatedAt: minsAgo(3),
  },
  {
    id: "1755003004", customerId: "d4", name: "Rohit Kulkarni", mobile: "+919820022110",
    cart: [
      { name: "Paneer Butter Masala", productNumber: "m2", size: null, qty: 1, price: 260 },
      { name: "Tandoori Roti",        productNumber: "b2", size: null, qty: 4, price: 25  },
    ],
    bill: { subtotal: 360, discount: 0, delivery: 49, total: 409 },
    address: "B-12, Sai Residency, Wakad",
    payLink: null, paymentMode: "upi", status: "delivered",
    statusDates: {}, trackingNumber: null, trackingUrl: null,
    source: "web", channel: "web", table_no: null, order_kind: "standard",
    extra: {},
    createdAt: hoursAgo(2), updatedAt: hoursAgo(1),
  },
];

// ── Bakery ────────────────────────────────────────────────────────────────────

export const FX_CAKE_CONFIG = {
  flavours: {
    "Chocolate Truffle": 600,
    "Red Velvet"       : 700,
    "Butterscotch"     : 550,
    "Fresh Pineapple"  : 500,
  },
  weights          : ["0.5 kg", "1 kg", "1.5 kg", "2 kg"],
  slots            : ["Today 6 PM", "Tomorrow 11 AM", "Tomorrow 6 PM", "Saturday 5 PM"],
  egglessSurcharge : 50,
  advance          : 200,
  deliveryFee      : 49,
  repeatDiscountPct: 10,
};

export const FX_CAKE_ORDERS = [
  {
    id: "1755002021", customerId: "c5", name: "Meera", mobile: "+91 98220 33447",
    cart: [{ name: "Red Velvet · 1 kg · Eggless", qty: 1, price: 750 }],
    bill: { subtotal: 750, discount: 0, delivery: 0, total: 750 },
    address: "", payLink: null, paymentMode: "upi", status: "baking",
    statusDates: {}, trackingNumber: null, trackingUrl: null,
    source: "whatsapp", channel: "whatsapp", table_no: null, order_kind: "cake",
    extra: {
      flavour: "Red Velvet", kg: 1, eggless: true,
      cakeMsg: "Happy Anniversary Meera & Arjun",
      due: "Today 5 PM", advancePaid: true, deliveryOpted: false,
    },
    createdAt: hoursAgo(20), updatedAt: hoursAgo(2),
  },
  {
    id: "1755002022", customerId: "c6", name: "Rohan", mobile: "+91 98220 55661",
    cart: [{ name: "Butterscotch · 0.5 kg · With egg", qty: 1, price: 275 }],
    bill: { subtotal: 275, discount: 0, delivery: 0, total: 275 },
    address: "", payLink: null, paymentMode: "upi", status: "confirmed",
    statusDates: {}, trackingNumber: null, trackingUrl: null,
    source: "instagram", channel: "instagram", table_no: null, order_kind: "cake",
    extra: {
      flavour: "Butterscotch", kg: 0.5, eggless: false,
      cakeMsg: "Congrats Graduate!",
      due: "Tomorrow 11 AM", advancePaid: true, deliveryOpted: false,
    },
    createdAt: hoursAgo(6), updatedAt: hoursAgo(6),
  },
  {
    id: "1755002023", customerId: "c7", name: "Priya", mobile: "+91 98220 66772",
    cart: [{ name: "Chocolate Truffle · 1 kg · Eggless", qty: 1, price: 650 }],
    bill: { subtotal: 650, discount: 0, delivery: 0, total: 650 },
    address: "", payLink: null, paymentMode: "upi", status: "ready",
    statusDates: {}, trackingNumber: null, trackingUrl: null,
    source: "whatsapp", channel: "whatsapp", table_no: null, order_kind: "cake",
    extra: {
      flavour: "Chocolate Truffle", kg: 1, eggless: true,
      cakeMsg: "Happy Birthday Aarav!",
      due: "Tomorrow 6 PM", advancePaid: true, deliveryOpted: false,
    },
    createdAt: hoursAgo(28), updatedAt: minsAgo(25),
  },
];

export const FX_OCCASIONS = (() => {
  const soon = new Date(Date.now() + 5 * 86_400_000);
  const later = new Date(Date.now() + 40 * 86_400_000);
  return [
    {
      id: "o1", business_id: FIXTURE_BUSINESS_ID, customer_id: "c7",
      person_name: "Aarav", occasion: "birthday",
      month: soon.getMonth() + 1, day: soon.getDate(),
      last_cake: { flavour: "Chocolate Truffle", kg: 1, eggless: true, cakeMsg: "Happy Birthday Aarav!" },
      last_reminded_on: null, opted_out: false, source_order_id: "1755002023",
    },
    {
      id: "o2", business_id: FIXTURE_BUSINESS_ID, customer_id: "c5",
      person_name: "Meera & Arjun", occasion: "anniversary",
      month: later.getMonth() + 1, day: later.getDate(),
      last_cake: { flavour: "Red Velvet", kg: 1, eggless: true, cakeMsg: "Happy Anniversary Meera & Arjun" },
      last_reminded_on: null, opted_out: false, source_order_id: "1755002021",
    },
  ];
})();

// ── Fun Zone ──────────────────────────────────────────────────────────────────
// Weights make the odds explicit and budgetable. The demo spun a uniform
// Math.random() over six equal segments, which is not something an owner can cost.

export const FX_FUN_ZONE = {
  enabled: true,
  games  : { wheel: true, memory: true, quiz: true, jukebox: true, talk: true },
  prizes : [
    { emoji: "🍪", label: "Free Cookie",        kind: "freeitem", value: 0,  weight: 30, win: true  },
    { emoji: "🎯", label: "10% Off Today",      kind: "percent",  value: 10, weight: 20, win: true  },
    { emoji: "☕", label: "Free Size Upgrade",  kind: "upgrade",  value: 0,  weight: 20, win: true  },
    { emoji: "😅", label: "Almost! Try again",  kind: "flat",     value: 0,  weight: 15, win: false },
    { emoji: "🍫", label: "Free Brownie",       kind: "freeitem", value: 0,  weight: 10, win: true  },
    { emoji: "💸", label: "₹50 Off Next Visit", kind: "flat",     value: 50, weight: 5,  win: true  },
  ],
  quiz: [
    { q: "What makes a cappuccino different from a latte?", opts: ["More milk foam", "More sugar", "Cold milk"], right: 0 },
    { q: "Which country grows the most coffee in the world?", opts: ["India", "Brazil", "Italy"], right: 1 },
    { q: "What's in our house cold brew?", opts: ["Instant coffee", "Espresso + ice", "Beans steeped 18 hours"], right: 2 },
  ],
  tracks: [
    { name: "Kesariya",    artist: "Arijit Singh" },
    { name: "Iraaday",     artist: "Anuv Jain" },
    { name: "Golden Hour", artist: "JVKE" },
    { name: "Tum Se Hi",   artist: "Mohit Chauhan" },
    { name: "Sunroof",     artist: "Nicky Youre" },
  ],
  talkCards: [
    "What's the best thing that happened to you this week?",
    "If you could have coffee with anyone in the world, who would it be?",
    "What's a small thing that always makes your day better?",
    "What did you want to be when you were ten?",
    "What's the last thing that made you laugh out loud?",
  ],
  memoryEmojis: ["☕", "🥐", "🍫", "🥑"],
  couponValidDays: 15,
};

export const FX_COUPONS = [
  {
    id: "cp1", business_id: FIXTURE_BUSINESS_ID, code: "CAFE47",
    prize_label: "Free Cookie", kind: "freeitem", value: 0,
    customer_id: "c1", table_no: 7, issued_via: "wheel", status: "issued",
    expires_at: new Date(Date.now() + 15 * 86_400_000).toISOString(),
    redeemed_at: null, order_id: null, created_at: new Date(minsAgo(22)).toISOString(),
  },
  {
    id: "cp2", business_id: FIXTURE_BUSINESS_ID, code: "CAFE12",
    prize_label: "₹50 Off Next Visit", kind: "flat", value: 50,
    customer_id: "c3", table_no: 5, issued_via: "quiz", status: "redeemed",
    expires_at: new Date(Date.now() + 12 * 86_400_000).toISOString(),
    redeemed_at: new Date(hoursAgo(1)).toISOString(), order_id: "1755001004",
    created_at: new Date(hoursAgo(4)).toISOString(),
  },
];

export const FX_JUKEBOX = [
  { id: "j1", business_id: FIXTURE_BUSINESS_ID, track: "Kesariya",    artist: "Arijit Singh", table_no: 5, status: "queued", created_at: new Date(minsAgo(6)).toISOString() },
  { id: "j2", business_id: FIXTURE_BUSINESS_ID, track: "Golden Hour", artist: "JVKE",         table_no: 7, status: "queued", created_at: new Date(minsAgo(3)).toISOString() },
];

// ── Discovery ─────────────────────────────────────────────────────────────────
// The eight curated Koregaon Park places from the discovery demo, with the
// lat/lng and maps_url the demo never had (its "Directions" was a styled span,
// not a link, and its phone numbers were not tel: links).

export const FX_PLACES = [
  { id: "p1", business_id: null, name: "Sharma Udupi",    emoji: "🥘", cuisine: "South Indian", area: "Koregaon Park", city: "Pune", lat: 18.5362, lng: 73.8939, rating: 4.6, reviews: 1240, phone: "+91 98220 11223", dishes: ["dosa","idli","vada","coffee"],                signature: "Ghee Roast Dosa",            price: "₹120", why: "Reviewers keep coming back for the ghee roast — crisp, not oily", delivery: true,  active: true, shown_count: 0 },
  { id: "p2", business_id: null, name: "Anand Bhavan",    emoji: "🥞", cuisine: "South Indian", area: "Koregaon Park", city: "Pune", lat: 18.5391, lng: 73.8901, rating: 4.5, reviews: 2100, phone: "+91 98220 44556", dishes: ["dosa","idli","uttapam"],                     signature: "Mysore Masala Dosa",         price: "₹140", why: "Most-mentioned dish in reviews; go early, it gets full",          delivery: false, active: true, shown_count: 0 },
  { id: "p3", business_id: null, name: "Bhukkad Cafe",    emoji: "🍛", cuisine: "North Indian", area: "Koregaon Park", city: "Pune", lat: 18.5344, lng: 73.8955, rating: 4.4, reviews: 860,  phone: "+91 98220 77889", dishes: ["thali","paneer","dal","roti"],               signature: "Unlimited Punjabi Thali",    price: "₹260", why: "Unlimited and still generous — regulars come for the dal",        delivery: true,  active: true, shown_count: 0 },
  { id: "p4", business_id: null, name: "Punjabi Rasoi",   emoji: "🍲", cuisine: "North Indian", area: "Koregaon Park", city: "Pune", lat: 18.5408, lng: 73.8887, rating: 4.2, reviews: 610,  phone: "+91 98220 22110", dishes: ["thali","paneer","roti"],                     signature: "Veg Thali",                  price: "₹220", why: "Cheapest full meal nearby that people actually recommend",         delivery: true,  active: true, shown_count: 0 },
  { id: "p5", business_id: null, name: "Biryani House",   emoji: "🍚", cuisine: "Hyderabadi",   area: "Koregaon Park", city: "Pune", lat: 18.5301, lng: 73.9012, rating: 4.4, reviews: 3400, phone: "+91 98220 33447", dishes: ["biryani","kebab"],                           signature: "Hyderabadi Dum Biryani",     price: "₹320", why: "3,400 reviews and the biryani is still the thing people mention",  delivery: true,  active: true, shown_count: 0 },
  { id: "p6", business_id: null, name: "Wok & Roll",      emoji: "🍜", cuisine: "Chinese",      area: "Koregaon Park", city: "Pune", lat: 18.5324, lng: 73.8988, rating: 4.3, reviews: 540,  phone: "+91 98220 55661", dishes: ["noodles","momos","fried rice","manchurian"], signature: "Burnt Garlic Hakka Noodles", price: "₹210", why: "Reviewers single out the burnt garlic — not a generic Chinese menu", delivery: true,  active: true, shown_count: 0 },
  { id: "p7", business_id: null, name: "Pizza Junction",  emoji: "🍕", cuisine: "Italian",      area: "Koregaon Park", city: "Pune", lat: 18.5289, lng: 73.9001, rating: 4.1, reviews: 430,  phone: "+91 98220 66772", dishes: ["pizza","garlic bread"],                      signature: "Farmhouse Pizza",            price: "₹300", why: "Open late — the 11 PM option around here",                         delivery: true,  active: true, shown_count: 0 },
  { id: "p8", business_id: null, name: "The Coffee Nook", emoji: "☕", cuisine: "Cafe",         area: "Koregaon Park", city: "Pune", lat: 18.5371, lng: 73.8922, rating: 4.3, reviews: 720,  phone: "+91 98220 88993", dishes: ["coffee","sandwich","cake"],                  signature: "Pour-over Coffee",           price: "₹180", why: "The only place nearby that takes filter coffee seriously",          delivery: false, active: true, shown_count: 0 },
];

/** Aggregated demand, matching the shape of the discovery_demand() RPC. */
export const FX_DEMAND = [
  { dish: "biryani", n: 47 },
  { dish: "dosa",    n: 31 },
  { dish: "thali",   n: 22 },
  { dish: "noodles", n: 14 },
  { dish: "pizza",   n: 9  },
  { dish: "coffee",  n: 6  },
];

/** Matching discovery_waitlist_demand(). */
export const FX_WAITLIST_DEMAND = [
  { area: "Baner",       n: 14 },
  { area: "Kothrud",     n: 9  },
  { area: "Viman Nagar", n: 5  },
];

/** Areas the platform actually covers — drives the honest out-of-area refusal. */
export const FX_COVERED_AREAS = ["Koregaon Park"];
