// ── Selly Brand Colors ─────────────────────────────────────────────────────
export const Colors = {
  // Backgrounds
  bg         : "#0a0a0f",
  bgCard     : "#13131a",
  bgInput    : "#1c1c26",
  bgModal    : "#16161f",

  // Primary brand
  primary    : "#6c47ff",
  primaryLight: "#8b6bff",
  primaryDark : "#5035cc",

  // Accents
  accent     : "#ff6b9d",   // pink – promotions
  green      : "#22c55e",   // success / active
  yellow     : "#f59e0b",   // warning / trial
  red        : "#ef4444",   // error / expired
  blue       : "#3b82f6",   // info

  // Text
  textPrimary  : "#f0f0f8",
  textSecondary: "#8888aa",
  textMuted    : "#55556a",

  // Borders
  border     : "#25253a",
  borderLight: "#30304a",

  // Status pill colors
  status: {
    pending_payment : { bg: "#2d1f08", text: "#f59e0b" },
    confirmed       : { bg: "#0f2d1a", text: "#22c55e" },
    packed          : { bg: "#0e1f3a", text: "#3b82f6" },
    shipped         : { bg: "#1a0f3a", text: "#8b6bff" },
    out_for_delivery: { bg: "#2a1535", text: "#ff6b9d" },
    delivered       : { bg: "#0d2d1a", text: "#22c55e" },
    cancelled       : { bg: "#2d0f0f", text: "#ef4444" },
  },

  // Promo source colors
  promo: {
    flash_sale     : { bg: "#2d1f08", text: "#f59e0b" },
    new_arrival    : { bg: "#0f1f2d", text: "#3b82f6" },
    abandoned_cart : { bg: "#2a1535", text: "#ff6b9d" },
    referral       : { bg: "#0f2d1a", text: "#22c55e" },
  },
};
