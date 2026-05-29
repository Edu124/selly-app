const Razorpay  = require("razorpay");
const Stripe    = require("stripe");
const crypto    = require("crypto");
const { updateUserPlan, getUserByRazorpaySubId, getUserByStripeSubId } = require("./db");
const { RAZORPAY_PLAN_IDS, STRIPE_PRICE_IDS } = require("./plans");

// Lazy init — only created when first used, not at startup
let _razorpay = null;
let _stripe   = null;

function getRazorpay() {
  if (!_razorpay) {
    if (!process.env.RAZORPAY_KEY_ID) throw new Error("RAZORPAY_KEY_ID not set");
    _razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  }
  return _razorpay;
}

function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not set");
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

// Proxy aliases so existing code (razorpay.subscriptions.cancel etc.) still works
const razorpay = new Proxy({}, { get: (_, prop) => getRazorpay()[prop] });
const stripe   = new Proxy({}, { get: (_, prop) => getStripe()[prop]   });

// ─────────────────────────────────────────────────────────────────────────────
// RAZORPAY
// ─────────────────────────────────────────────────────────────────────────────

// Create a Razorpay subscription for a user
async function createRazorpaySubscription(userId, email, planKey) {
  const planId = RAZORPAY_PLAN_IDS[planKey];
  if (!planId) throw new Error(`No Razorpay plan ID configured for plan: ${planKey}`);

  const sub = await razorpay.subscriptions.create({
    plan_id:        planId,
    customer_notify: 1,
    total_count:    12,   // 12 months (renews automatically)
    notes: { user_id: userId, plan: planKey },
  });

  return sub;
}

// Verify Razorpay webhook signature
function verifyRazorpaySignature(body, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(body))
    .digest("hex");
  return expected === signature;
}

// Handle Razorpay webhook events
async function handleRazorpayWebhook(event, body) {
  const entity    = event.payload?.subscription?.entity || {};
  const subId     = entity.id;
  const notes     = entity.notes || {};
  const userId    = notes.user_id;
  const planKey   = notes.plan;

  switch (event.event) {
    case "subscription.activated":
    case "subscription.charged": {
      // Payment successful → activate plan for 30 days
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      if (userId) {
        await updateUserPlan(userId, planKey, expiresAt.toISOString(), subId, "razorpay");
        console.log(`✅ Razorpay: Activated ${planKey} for user ${userId}`);
      }
      break;
    }
    case "subscription.cancelled":
    case "subscription.expired": {
      // Downgrade to free
      if (userId) {
        await updateUserPlan(userId, "free", null, null, null);
        console.log(`⬇️ Razorpay: Downgraded user ${userId} to free`);
      }
      break;
    }
    case "subscription.pending":
      // Payment pending — don't change plan yet
      break;
    default:
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STRIPE
// ─────────────────────────────────────────────────────────────────────────────

// Create a Stripe checkout session
async function createStripeCheckout(userId, email, planKey, successUrl, cancelUrl) {
  const priceId = STRIPE_PRICE_IDS[planKey];
  if (!priceId) throw new Error(`No Stripe price ID configured for plan: ${planKey}`);

  const session = await stripe.checkout.sessions.create({
    mode:               "subscription",
    payment_method_types: ["card"],
    customer_email:     email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url:        successUrl,
    cancel_url:         cancelUrl,
    metadata:           { user_id: userId, plan: planKey },
  });

  return session;
}

// Handle Stripe webhook events
async function handleStripeWebhook(rawBody, signature) {
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    throw new Error(`Stripe webhook signature failed: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session  = event.data.object;
      const userId   = session.metadata?.user_id;
      const planKey  = session.metadata?.plan;
      const subId    = session.subscription;
      if (userId && planKey) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await updateUserPlan(userId, planKey, expiresAt.toISOString(), subId, "stripe");
        console.log(`✅ Stripe: Activated ${planKey} for user ${userId}`);
      }
      break;
    }
    case "invoice.paid": {
      // Renewal — extend by 30 days
      const invoice = event.data.object;
      const subId   = invoice.subscription;
      const user    = await getUserByStripeSubId(subId);
      if (user) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await updateUserPlan(user.user_id, user.plan, expiresAt.toISOString(), subId, "stripe");
        console.log(`🔄 Stripe: Renewed ${user.plan} for user ${user.user_id}`);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub  = event.data.object;
      const user = await getUserByStripeSubId(sub.id);
      if (user) {
        await updateUserPlan(user.user_id, "free", null, null, null);
        console.log(`⬇️ Stripe: Downgraded user ${user.user_id} to free`);
      }
      break;
    }
    default:
      break;
  }

  return event;
}

module.exports = {
  razorpay,
  stripe,
  createRazorpaySubscription,
  verifyRazorpaySignature,
  handleRazorpayWebhook,
  createStripeCheckout,
  handleStripeWebhook,
};
