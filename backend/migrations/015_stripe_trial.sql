-- ============================================================
-- Migration 015: Stripe Customer ID + Trial System
--
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor).
-- DO NOT run via the backend — apply manually.
--
-- Changes:
--   1. Add stripe_customer_id to user_profiles
--   2. Add trial_ends_at to user_profiles
--   3. Update handle_new_user() trigger to set trial_ends_at on signup
--   4. Add index for stripe_customer_id lookups (webhook fast-path)
-- ============================================================

-- ── Add stripe_customer_id ────────────────────────────────────────────────────
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Index for fast webhook lookups: getUserByStripeCustomer()
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id
  ON user_profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ── Add trial_ends_at ─────────────────────────────────────────────────────────
-- NULL means no trial configured (existing users — treated as expired trial).
-- Set to NOW() + 21 days for all new signups via the trigger below.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Index for trial expiry queries (backend middleware lookups)
CREATE INDEX IF NOT EXISTS idx_user_profiles_trial_ends_at
  ON user_profiles (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;

-- ── Update handle_new_user() to set trial_ends_at ─────────────────────────────
-- Replaces the function created in migration 010.
-- Sets trial_ends_at = NOW() + 21 days (3-week trial) on signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    id,
    name,
    tier,
    preferences,
    trial_ends_at,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    'free',
    '{}',
    NOW() + INTERVAL '21 days',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET trial_ends_at = COALESCE(user_profiles.trial_ends_at, NOW() + INTERVAL '21 days');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Backfill trial_ends_at for existing users ─────────────────────────────────
-- Existing free-tier users who signed up within the last 21 days get a trial.
-- Users older than 21 days are treated as post-trial (trial_ends_at in the past).
UPDATE user_profiles
SET trial_ends_at = created_at + INTERVAL '21 days'
WHERE trial_ends_at IS NULL;

-- ── Tier protection: prevent direct tier updates via RLS clients ──────────────
-- The tier column should ONLY be updated by the service role (Stripe webhooks).
-- Authenticated users cannot update their own tier via the anon/authenticated role.
-- (The trigger-based protection from prior migration remains; this is belt+suspenders.)

-- Revoke UPDATE on tier column from the authenticated role
-- Note: This uses column-level privileges (requires Postgres 9.0+, supported in Supabase)
REVOKE UPDATE (tier) ON user_profiles FROM authenticated;

-- ── Verify ────────────────────────────────────────────────────────────────────
-- After running, verify with:
--   SELECT id, tier, trial_ends_at, stripe_customer_id FROM user_profiles LIMIT 5;
