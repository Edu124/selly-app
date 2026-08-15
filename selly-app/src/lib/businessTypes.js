// ── Business Types ────────────────────────────────────────────────────────────
// Selly is food-only. Three business types, each with a tailored screen set:
//
//   cafe          Cafe / Restaurant   → tables, per-table QR ordering, Fun Zone
//   bakery        Bakery / Cake shop  → custom cake orders, birthday reminders
//   cloudkitchen  Cloud kitchen       → delivery-only prep queue, no tables
//
// This module is deliberately free of screen imports so it can be pulled into
// any screen without an import cycle through the navigator. AppNavigator owns
// the route-name → component mapping.
//
// The chosen type persists in business_settings.industry (the column keeps its
// old name; the values are new).
// ─────────────────────────────────────────────────────────────────────────────

export const BUSINESS_TYPES = {
  cafe: {
    id      : "cafe",
    icon    : "☕",
    title   : "Cafe / Restaurant",
    subtitle: "Dine-in orders from the table QR, bills on WhatsApp",
    examples: ["Cafe / Coffee shop", "Restaurant", "Food court counter", "Dessert parlour"],
    color   : "#7c5cff",
    bg      : "rgba(124,92,255,0.10)",

    // Drawer labels. Route names are always Orders / Catalog / Customers —
    // only the visible label changes per type.
    orders   : { label: "Orders",    icon: "receipt"    },
    catalog  : { label: "Menu",      icon: "restaurant" },
    customers: { label: "Customers", icon: "people"     },

    // Extra drawer items, in the order they should appear after Customers.
    extraNav: ["Tables", "FunZone"],

    // Status advance path. The bot creates orders at pending_payment/confirmed;
    // the app only ever moves them forward along this list.
    statusFlow: ["confirmed", "preparing", "served", "paid"],
    // Statuses that still owe the business money (drives the Payments screen).
    unpaid    : ["pending_payment", "confirmed", "preparing", "served"],
    settled   : ["paid"],

    hasTables   : true,
    hasFunZone  : true,
    hasOccasions: false,
    hasPrepQueue: false,
    hasDelivery : false,

    itemWord  : "dish",
    orderWord : "order",
    unitWord  : "Table",
  },

  bakery: {
    id      : "bakery",
    icon    : "🍰",
    title   : "Bakery / Cake shop",
    subtitle: "Custom cake orders step by step, birthdays that come back",
    examples: ["Cake shop", "Bakery", "Patisserie", "Home baker"],
    color   : "#ff6b9d",
    bg      : "rgba(255,107,157,0.10)",

    orders   : { label: "Cake Orders", icon: "gift"     },
    catalog  : { label: "Cake Menu",   icon: "pricetag" },
    customers: { label: "Customers",   icon: "people"   },

    extraNav: ["Occasions"],

    statusFlow: ["confirmed", "baking", "ready", "delivered"],
    unpaid    : ["pending_payment", "confirmed", "baking", "ready"],
    settled   : ["delivered"],

    hasTables   : false,
    hasFunZone  : false,
    hasOccasions: true,
    hasPrepQueue: false,
    hasDelivery : true,

    itemWord  : "cake",
    orderWord : "order",
    unitWord  : "Slot",
  },

  cloudkitchen: {
    id      : "cloudkitchen",
    icon    : "🍳",
    title   : "Cloud kitchen",
    subtitle: "Delivery-only. Prep queue, no tables, no dine-in",
    examples: ["Cloud kitchen", "Delivery-only brand", "Tiffin service", "Ghost kitchen"],
    color   : "#2dd4bf",
    bg      : "rgba(45,212,191,0.10)",

    orders   : { label: "Orders",    icon: "receipt"    },
    catalog  : { label: "Menu",      icon: "restaurant" },
    customers: { label: "Customers", icon: "people"     },

    extraNav: ["PrepQueue"],

    statusFlow: ["confirmed", "preparing", "out_for_delivery", "delivered"],
    unpaid    : ["pending_payment", "confirmed", "preparing", "out_for_delivery"],
    settled   : ["delivered"],

    hasTables   : false,
    hasFunZone  : false,
    hasOccasions: false,
    hasPrepQueue: true,
    hasDelivery : true,

    itemWord  : "dish",
    orderWord : "order",
    unitWord  : "Order",
  },
};

export const BUSINESS_TYPE_LIST  = Object.values(BUSINESS_TYPES);
export const DEFAULT_BUSINESS_TYPE = "cafe";

// ── Legacy value mapping ──────────────────────────────────────────────────────
// business_settings.industry holds whatever the account picked historically:
// the old food ids, or one of the removed sectors. Food ids map forward; the
// removed sectors return null so the account is sent back through setup rather
// than being silently dropped into a layout nobody chose.
const LEGACY_MAP = {
  restaurant: "cafe",
  cafe      : "cafe",
  foodcourt : "cafe",
  food_court: "cafe",

  cakes     : "bakery",
  cake      : "bakery",
  bakery    : "bakery",
  icecream  : "bakery",
  ice_cream : "bakery",

  cloudkitchen : "cloudkitchen",
  cloud_kitchen: "cloudkitchen",
};

/**
 * Normalise a stored industry value to a live business type.
 * @returns {string|null} a key of BUSINESS_TYPES, or null when the value is
 *   unknown/removed (education, tourism, kirana, product, …) and the user
 *   should re-run business-type setup.
 */
export function normalizeBusinessType(value) {
  if (!value) return null;
  const key = String(value).trim().toLowerCase();
  if (BUSINESS_TYPES[key]) return key;
  return LEGACY_MAP[key] || null;
}

/** Config for a type, always returning something renderable. */
export function typeConfig(value) {
  return BUSINESS_TYPES[normalizeBusinessType(value) || DEFAULT_BUSINESS_TYPE];
}

/** The next status after `current` for this business type, or null at the end. */
export function nextStatus(value, current) {
  const flow = typeConfig(value).statusFlow;
  const i    = flow.indexOf(current);
  // Orders the bot created sit at pending_payment, which is before the flow
  // starts — the first advance moves them to confirmed.
  if (i === -1) return current === "pending_payment" ? flow[0] : null;
  return flow[i + 1] || null;
}

/** Human label for a status, per type where the wording differs. */
export const STATUS_LABELS = {
  pending_payment : "Payment pending",
  confirmed       : "Confirmed",
  preparing       : "Preparing",
  served          : "Served",
  paid            : "Paid",
  baking          : "Baking",
  ready           : "Ready",
  packed          : "Packed",
  shipped         : "Shipped",
  out_for_delivery: "Out for delivery",
  delivered       : "Delivered",
  cancelled       : "Cancelled",
};

/** Button copy for advancing an order, e.g. "Start preparing". */
export const ADVANCE_LABELS = {
  confirmed       : "Confirm order",
  preparing       : "Start preparing",
  served          : "Mark served",
  paid            : "Mark paid",
  baking          : "Start baking",
  ready           : "Mark ready",
  out_for_delivery: "Send out for delivery",
  delivered       : "Mark delivered",
};
