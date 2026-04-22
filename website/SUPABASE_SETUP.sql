-- ── Run this in your Supabase SQL Editor ──────────────────────────────────
-- Go to: supabase.com → your project → SQL Editor → New Query → paste & run

-- 1. Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT,
  plan         TEXT    NOT NULL DEFAULT 'trial',   -- trial | pro | team
  license_key  TEXT    UNIQUE,
  downloads    INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Auto-create profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_license TEXT;
BEGIN
  -- Generate a random license key: TRIAL-XXXX-XXXX-XXXX
  new_license := 'TRIAL-'
    || upper(substring(md5(random()::text) from 1 for 4)) || '-'
    || upper(substring(md5(random()::text) from 1 for 4)) || '-'
    || upper(substring(md5(random()::text) from 1 for 4));

  INSERT INTO public.profiles (id, full_name, plan, license_key)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    'trial',
    new_license
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Row Level Security — users can only read their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 5. (Optional) Admin: upgrade a user to Pro
-- UPDATE public.profiles
-- SET plan = 'pro',
--     license_key = 'PRO-' || upper(substring(md5(random()::text) from 1 for 4)) || '-XXXX-XXXX'
-- WHERE id = '<user-uuid-here>';
