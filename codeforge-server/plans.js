// ── Plan definitions ──────────────────────────────────────────────────────────
// Central place to manage what each plan gets

const PLANS = {
  free: {
    name:        "Free",
    price_usd:   0,
    model:       null,                        // local model only, no API
    online:      false,
    description: "Local 1.5B model, fully offline",
  },
  pro: {
    name:        "Pro",
    price_usd:   10,
    model:       "deepseek-r1-distill-llama-70b", // fast reasoning, great for code
    online:      true,
    description: "Groq-powered Deepseek R1 — great for most coding tasks",
  },
  max: {
    name:        "Max",
    price_usd:   16,
    model:       "llama-3.3-70b-versatile",   // best open model for coding
    online:      true,
    description: "Groq-powered Llama 3.3 70B — GPT-4 level coding",
  },
  enterprise: {
    name:        "Enterprise",
    price_usd:   49,
    model:       "llama-3.3-70b-versatile",   // dedicated instance
    online:      true,
    description: "Dedicated server, team seats, priority support",
  },
};

// Razorpay plan IDs (set these after creating plans in Razorpay dashboard)
const RAZORPAY_PLAN_IDS = {
  pro:        process.env.RAZORPAY_PLAN_PRO        || "",
  max:        process.env.RAZORPAY_PLAN_MAX        || "",
  enterprise: process.env.RAZORPAY_PLAN_ENTERPRISE || "",
};

// Stripe price IDs (set these after creating products in Stripe dashboard)
const STRIPE_PRICE_IDS = {
  pro:        process.env.STRIPE_PRICE_PRO        || "",
  max:        process.env.STRIPE_PRICE_MAX        || "",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || "",
};

module.exports = { PLANS, RAZORPAY_PLAN_IDS, STRIPE_PRICE_IDS };
