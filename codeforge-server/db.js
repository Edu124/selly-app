const { createClient } = require("@supabase/supabase-js");

// Lazy init — prevents crash at startup if env vars not set yet
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.");
    _supabase = createClient(url, key);
  }
  return _supabase;
}
// Keep `supabase` as a getter-compatible alias for the cron in server.js
const supabase = new Proxy({}, { get: (_, prop) => getSupabase()[prop] });

// ── Get or create user record ─────────────────────────────────────────────────
async function getUser(userId, email = null) {
  const { data, error } = await supabase
    .from("codeforge_users")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code === "PGRST116") {
    // User doesn't exist → create with free plan
    const { data: newUser, error: insertError } = await supabase
      .from("codeforge_users")
      .insert({ user_id: userId, email, plan: "free" })
      .select()
      .single();
    if (insertError) throw insertError;
    return newUser;
  }

  if (error) throw error;
  return data;
}

// ── Update user plan ──────────────────────────────────────────────────────────
async function updateUserPlan(userId, plan, expiresAt = null, subId = null, provider = null) {
  const update = {
    plan,
    plan_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };
  if (subId && provider === "razorpay") update.razorpay_sub_id = subId;
  if (subId && provider === "stripe")   update.stripe_sub_id   = subId;

  const { error } = await supabase
    .from("codeforge_users")
    .update(update)
    .eq("user_id", userId);
  if (error) throw error;
}

// ── Track API usage ───────────────────────────────────────────────────────────
async function trackUsage(userId, model, inputTokens, outputTokens) {
  const { error } = await supabase
    .from("codeforge_usage")
    .insert({
      user_id:       userId,
      model,
      input_tokens:  inputTokens  || 0,
      output_tokens: outputTokens || 0,
      total_tokens:  (inputTokens || 0) + (outputTokens || 0),
    });
  if (error) console.error("Usage tracking error:", error.message);
}

// ── Get monthly usage for a user ──────────────────────────────────────────────
async function getMonthlyUsage(userId) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("codeforge_usage")
    .select("total_tokens, input_tokens, output_tokens")
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  if (error) return { requests: 0, total_tokens: 0 };

  return {
    requests:     data.length,
    total_tokens: data.reduce((sum, r) => sum + (r.total_tokens || 0), 0),
  };
}

// ── Find user by Razorpay subscription ID ─────────────────────────────────────
async function getUserByRazorpaySubId(subId) {
  const { data, error } = await supabase
    .from("codeforge_users")
    .select("*")
    .eq("razorpay_sub_id", subId)
    .single();
  if (error) return null;
  return data;
}

// ── Find user by Stripe subscription ID ──────────────────────────────────────
async function getUserByStripeSubId(subId) {
  const { data, error } = await supabase
    .from("codeforge_users")
    .select("*")
    .eq("stripe_sub_id", subId)
    .single();
  if (error) return null;
  return data;
}

module.exports = {
  supabase,
  getUser,
  updateUserPlan,
  trackUsage,
  getMonthlyUsage,
  getUserByRazorpaySubId,
  getUserByStripeSubId,
};
