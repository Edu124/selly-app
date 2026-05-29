require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const Groq     = require("groq-sdk");

const { requireAuth }                   = require("./auth");
const { getUser, updateUserPlan, trackUsage, getMonthlyUsage } = require("./db");
const { PLANS }                         = require("./plans");
const {
  createRazorpaySubscription, verifyRazorpaySignature, handleRazorpayWebhook,
  createStripeCheckout, handleStripeWebhook,
} = require("./payments");

const app  = express();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const PORT = process.env.PORT || 3100;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));

// Raw body for Stripe webhook (must come before express.json)
app.use("/webhooks/stripe", express.raw({ type: "application/json" }));

// JSON for everything else
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "CodeForge API", version: "1.0.0" });
});

// ─────────────────────────────────────────────────────────────────────────────
// INFERENCE — OpenAI-compatible endpoint
// POST /v1/chat/completions
// ─────────────────────────────────────────────────────────────────────────────
app.post("/v1/chat/completions", requireAuth, async (req, res) => {
  try {
    // 1. Get user + plan
    const user = await getUser(req.userId, req.userEmail);
    const plan = PLANS[user.plan] || PLANS.free;

    // 2. Check plan has online access
    if (!plan.online || !plan.model) {
      return res.status(403).json({
        error: "Online models require a Pro or Max plan.",
        upgrade_url: process.env.APP_URL + "/upgrade",
      });
    }

    // 3. Check plan not expired
    if (user.plan_expires_at && new Date(user.plan_expires_at) < new Date()) {
      // Expired → downgrade to free
      await updateUserPlan(req.userId, "free");
      return res.status(403).json({
        error: "Your subscription has expired. Please renew.",
        upgrade_url: process.env.APP_URL + "/upgrade",
      });
    }

    // 4. Build messages (add CodeForge system prompt if not present)
    const messages = req.body.messages || [];
    const hasSystem = messages.length > 0 && messages[0].role === "system";
    const finalMessages = hasSystem ? messages : [
      {
        role: "system",
        content: "You are CodeForge, an expert AI coding assistant. Write clean, efficient, well-commented code. Specialise in Python, JavaScript, TypeScript, Dart, Django, Flutter, React, Node.js, Supabase, Razorpay, and WhatsApp API.",
      },
      ...messages,
    ];

    const stream = req.body.stream !== false; // default stream = true

    // 5. Call Groq
    const completion = await groq.chat.completions.create({
      model:       plan.model,
      messages:    finalMessages,
      temperature: req.body.temperature ?? 0.7,
      max_tokens:  req.body.max_tokens  ?? 2048,
      stream,
    });

    if (stream) {
      // ── Streaming response ──
      res.setHeader("Content-Type",  "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection",    "keep-alive");

      let totalInputTokens  = 0;
      let totalOutputTokens = 0;

      for await (const chunk of completion) {
        // Count tokens from usage if available
        if (chunk.x_groq?.usage) {
          totalInputTokens  = chunk.x_groq.usage.prompt_tokens     || 0;
          totalOutputTokens = chunk.x_groq.usage.completion_tokens || 0;
        }

        const data = JSON.stringify(chunk);
        res.write(`data: ${data}\n\n`);

        // Check if stream done
        if (chunk.choices?.[0]?.finish_reason) {
          break;
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();

      // Track usage async (don't await)
      trackUsage(req.userId, plan.model, totalInputTokens, totalOutputTokens).catch(console.error);

    } else {
      // ── Non-streaming response ──
      res.json(completion);

      const usage = completion.usage || {};
      trackUsage(req.userId, plan.model, usage.prompt_tokens, usage.completion_tokens).catch(console.error);
    }

  } catch (err) {
    console.error("Inference error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// USER INFO
// GET /api/user
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/user", requireAuth, async (req, res) => {
  try {
    const user  = await getUser(req.userId, req.userEmail);
    const usage = await getMonthlyUsage(req.userId);
    const plan  = PLANS[user.plan] || PLANS.free;

    // Check expiry
    const expired = user.plan_expires_at && new Date(user.plan_expires_at) < new Date();
    const effectivePlan = expired ? "free" : user.plan;

    res.json({
      user_id:    user.user_id,
      email:      user.email,
      plan:       effectivePlan,
      plan_name:  PLANS[effectivePlan]?.name || "Free",
      model:      PLANS[effectivePlan]?.model || null,
      online:     PLANS[effectivePlan]?.online || false,
      expires_at: user.plan_expires_at,
      expired,
      usage: {
        requests:     usage.requests,
        total_tokens: usage.total_tokens,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AVAILABLE PLANS
// GET /api/plans
// ─────────────────────────────────────────────────────────────────────────────
app.get("/api/plans", (req, res) => {
  res.json(
    Object.entries(PLANS).map(([key, p]) => ({
      key,
      name:        p.name,
      price_usd:   p.price_usd,
      description: p.description,
      online:      p.online,
    }))
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// RAZORPAY — Create subscription
// POST /api/subscribe/razorpay
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/subscribe/razorpay", requireAuth, async (req, res) => {
  const { plan } = req.body;
  if (!plan || !["pro", "max", "enterprise"].includes(plan)) {
    return res.status(400).json({ error: "Invalid plan. Choose pro, max, or enterprise." });
  }

  try {
    const user = await getUser(req.userId, req.userEmail);
    const sub  = await createRazorpaySubscription(req.userId, user.email, plan);
    res.json({
      subscription_id: sub.id,
      plan,
      amount:          PLANS[plan].price_usd * 83 * 100, // USD → INR paise (approx)
      currency:        "INR",
    });
  } catch (err) {
    console.error("Razorpay create subscription error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STRIPE — Create checkout session
// POST /api/subscribe/stripe
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/subscribe/stripe", requireAuth, async (req, res) => {
  const { plan } = req.body;
  if (!plan || !["pro", "max", "enterprise"].includes(plan)) {
    return res.status(400).json({ error: "Invalid plan." });
  }

  try {
    const user    = await getUser(req.userId, req.userEmail);
    const baseUrl = process.env.APP_URL || "https://codeforge.ai";
    const session = await createStripeCheckout(
      req.userId,
      user.email,
      plan,
      `${baseUrl}/success?plan=${plan}`,
      `${baseUrl}/pricing`
    );
    res.json({ checkout_url: session.url, session_id: session.id });
  } catch (err) {
    console.error("Stripe checkout error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RAZORPAY WEBHOOK
// POST /webhooks/razorpay
// ─────────────────────────────────────────────────────────────────────────────
app.post("/webhooks/razorpay", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  if (!signature || !verifyRazorpaySignature(req.body, signature)) {
    return res.status(400).json({ error: "Invalid signature" });
  }
  try {
    await handleRazorpayWebhook(req.body, req.body);
    res.json({ received: true });
  } catch (err) {
    console.error("Razorpay webhook error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STRIPE WEBHOOK
// POST /webhooks/stripe
// ─────────────────────────────────────────────────────────────────────────────
app.post("/webhooks/stripe", async (req, res) => {
  const signature = req.headers["stripe-signature"];
  try {
    await handleStripeWebhook(req.body, signature);
    res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err.message);
    res.status(400).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CANCEL SUBSCRIPTION
// POST /api/cancel
// ─────────────────────────────────────────────────────────────────────────────
app.post("/api/cancel", requireAuth, async (req, res) => {
  try {
    const user = await getUser(req.userId);
    if (user.razorpay_sub_id) {
      const { razorpay } = require("./payments");
      await razorpay.subscriptions.cancel(user.razorpay_sub_id, true);
    }
    if (user.stripe_sub_id) {
      const { stripe } = require("./payments");
      await stripe.subscriptions.cancel(user.stripe_sub_id);
    }
    await updateUserPlan(req.userId, "free", null, null, null);
    res.json({ success: true, message: "Subscription cancelled. You have been moved to the Free plan." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3-DAY EXPIRY NOTIFICATION CRON
// Runs once daily — finds users expiring in ≤3 days and sends email via Resend
// ─────────────────────────────────────────────────────────────────────────────
const { supabase: supabaseAdmin } = require("./db");

async function sendExpiryNotifications() {
  try {
    const now     = new Date();
    const in3days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const { data: users, error } = await supabaseAdmin
      .from("codeforge_users")
      .select("user_id, email, plan, plan_expires_at")
      .neq("plan", "free")
      .gte("plan_expires_at", now.toISOString())
      .lte("plan_expires_at", in3days.toISOString());

    if (error || !users?.length) return;

    // Log for now — wire up email (Resend / Gmail) when ready
    for (const user of users) {
      console.log(`[Cron] ⚠️  Expiring in 3 days: ${user.email} (${user.plan}) — expires ${user.plan_expires_at}`);
    }
  } catch (err) {
    console.error("[Cron] Expiry notification error:", err.message);
  }
}

// Run once at startup (catches any missed), then every 24h
sendExpiryNotifications();
setInterval(sendExpiryNotifications, 24 * 60 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   CodeForge API Server               ║
║   Port: ${PORT}                          ║
║   Groq model routing: ✓              ║
║   Razorpay + Stripe: ✓               ║
╚══════════════════════════════════════╝
  `);
});
