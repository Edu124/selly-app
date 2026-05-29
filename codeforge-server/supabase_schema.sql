-- Run this in Supabase SQL Editor (one time setup)

-- ── Users & Subscriptions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS codeforge_users (
  user_id           TEXT PRIMARY KEY,           -- Clerk user ID
  email             TEXT,
  plan              TEXT NOT NULL DEFAULT 'free', -- free | pro | max | enterprise
  plan_expires_at   TIMESTAMPTZ,
  razorpay_sub_id   TEXT,
  stripe_sub_id     TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Usage Tracking ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS codeforge_usage (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  model         TEXT,
  input_tokens  INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens  INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_user_date
  ON codeforge_usage (user_id, created_at DESC);

-- ── Disable RLS (service role key bypasses it anyway) ─────────────────────────
ALTER TABLE codeforge_users  DISABLE ROW LEVEL SECURITY;
ALTER TABLE codeforge_usage  DISABLE ROW LEVEL SECURITY;
