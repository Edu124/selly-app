// ── Selly Brand Colors ─────────────────────────────────────────────────────
// Deep-navy dashboard theme: near-black navy ground, elevated cards, violet
// primary, and a set of per-category accents used for tool icon tiles.
export const Colors = {
  // Backgrounds
  bg         : "#0a0a12",   // page ground — navy-black, not flat black
  bgCard     : "#14141f",   // cards / surfaces
  bgElevated : "#1a1a28",   // hovered / raised surfaces
  bgInput    : "#1c1c2b",
  bgModal    : "#141420",

  // Primary brand
  primary     : "#7c5cff",
  primaryLight: "#9d87ff",
  primaryDark : "#5b3fd6",
  primarySoft : "rgba(124,92,255,0.14)",   // tinted tile behind primary icons

  // Accents
  accent     : "#ff6b9d",   // pink – promotions / captions
  green      : "#22c55e",   // success / active
  teal       : "#2dd4bf",   // media / reels
  yellow     : "#f5a524",   // warning / trial / analytics
  red        : "#ef4444",   // error / expired
  blue       : "#3b82f6",   // info

  // Text
  textPrimary  : "#f2f2f7",
  textSecondary: "#9a9ab4",
  textMuted    : "#63637d",

  // Borders
  border     : "#242437",
  borderLight: "#2f2f45",

  // Gradients (used with expo-linear-gradient)
  gradHero   : ["#3b1d8f", "#6d3bd4", "#2a1b6b"],
  gradPrimary: ["#7c5cff", "#5b3fd6"],

  // Soft tinted tiles for tool icons — [background, icon colour]
  tile: {
    violet: ["rgba(124,92,255,0.15)", "#9d87ff"],
    pink  : ["rgba(255,107,157,0.15)", "#ff8fb8"],
    teal  : ["rgba(45,212,191,0.15)",  "#5eead4"],
    amber : ["rgba(245,165,36,0.15)",  "#fbbf5c"],
    blue  : ["rgba(59,130,246,0.15)",  "#7cb0ff"],
    green : ["rgba(34,197,94,0.15)",   "#4ade80"],
  },

  // Status pill colors
  // The bot only ever writes pending_payment / confirmed / cancelled; the rest
  // are advanced by the app, so café and bakery flows live alongside the older
  // shipping vocabulary rather than replacing it.
  status: {
    pending_payment : { bg: "#2d1f08", text: "#f5a524" },
    confirmed       : { bg: "#0f2d1a", text: "#22c55e" },
    // café: confirmed → preparing → served → paid
    preparing       : { bg: "#0e1f3a", text: "#3b82f6" },
    served          : { bg: "#0d2d1a", text: "#22c55e" },
    paid            : { bg: "#082d29", text: "#2dd4bf" },
    // bakery: confirmed → baking → ready → delivered
    baking          : { bg: "#2a1020", text: "#ff6b9d" },
    ready           : { bg: "#0f2d1a", text: "#4ade80" },
    // cloud kitchen / legacy shipping
    packed          : { bg: "#0e1f3a", text: "#3b82f6" },
    shipped         : { bg: "#1a0f3a", text: "#9d87ff" },
    out_for_delivery: { bg: "#2a1535", text: "#ff6b9d" },
    delivered       : { bg: "#0d2d1a", text: "#22c55e" },
    cancelled       : { bg: "#2d0f0f", text: "#ef4444" },
  },

  // Café floor-plan table states — [background, border, text]
  tableState: {
    free   : ["#14141f", "#242437", "#63637d"],
    seated : ["#0e1f3a", "#2b4a7d", "#7cb0ff"],
    ordered: ["#2d1f08", "#5c4210", "#fbbf5c"],
    served : ["#0d2d1a", "#1d5c34", "#4ade80"],
    bill   : ["#1f1035", "#4a2b7d", "#b79dff"],
  },

  // Promo source colors
  promo: {
    flash_sale     : { bg: "#2d1f08", text: "#f5a524" },
    new_arrival    : { bg: "#0f1f2d", text: "#3b82f6" },
    abandoned_cart : { bg: "#2a1535", text: "#ff6b9d" },
    referral       : { bg: "#0f2d1a", text: "#22c55e" },
  },
};
