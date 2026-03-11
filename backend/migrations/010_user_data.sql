-- ============================================================
-- Migration 010: User Data Storage
-- 
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor).
-- DO NOT run via the backend — apply manually.
--
-- This creates:
--   1. user_profiles  — extends auth.users with name, tier, preferences
--   2. user_data      — JSON blob storage per user per data type
--   3. RLS policies   — users can only read/write their own rows
-- ============================================================

-- ── User Profiles ─────────────────────────────────────────────────────────────
-- Extends Supabase's built-in auth.users table.
-- One row per user, created on signup.

CREATE TABLE IF NOT EXISTS user_profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT,
  tier        TEXT        DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  preferences JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by tier (useful for analytics/billing)
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON user_profiles(tier);

-- ── User Data Storage ─────────────────────────────────────────────────────────
-- Stores JSON blobs per user per data type.
-- Supports: journal, portfolio, settings, watchlist
-- One row per (user_id, data_type) — UPSERT pattern.

CREATE TABLE IF NOT EXISTS user_data (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data_type   TEXT        NOT NULL CHECK (data_type IN ('journal', 'portfolio', 'settings', 'watchlist')),
  data        JSONB       NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, data_type)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON user_data(user_id);
-- Composite index for the common (user_id, data_type) query pattern
CREATE INDEX IF NOT EXISTS idx_user_data_user_type ON user_data(user_id, data_type);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Users can ONLY access rows where auth.uid() matches their ID.
-- This is enforced at the database level — even if app code has a bug,
-- data won't leak between users.

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_data      ENABLE ROW LEVEL SECURITY;

-- user_profiles policies
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- user_data policies
CREATE POLICY "Users can read own data"
  ON user_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own data"
  ON user_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own data"
  ON user_data FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own data"
  ON user_data FOR DELETE
  USING (auth.uid() = user_id);

-- ── Auto-update updated_at trigger ───────────────────────────────────────────
-- Automatically updates the updated_at column on any UPDATE.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_user_data_updated_at
  BEFORE UPDATE ON user_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ── Auto-create profile on signup ─────────────────────────────────────────────
-- Optionally create a profile row when a new auth user is created.
-- This ensures user_profiles always has a row even before the user logs in.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name, tier, preferences, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    'free',
    '{}',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger fires when a new user signs up via Supabase Auth
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
