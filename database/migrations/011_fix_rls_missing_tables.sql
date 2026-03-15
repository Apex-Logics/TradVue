-- ================================================================
-- Migration 011: Fix RLS on Missing/Broken Tables
-- TradVue — CRITICAL SECURITY FIX (Pre-Payment Audit)
--
-- Issues addressed:
--   1. market_alerts       — RLS not enabled (global data, but should
--                            restrict writes to service_role only)
--   2. alert_subscriptions — RLS not enabled (user-scoped, big leak)
--   3. activity_log        — RLS enabled but policy USING (true) allows
--                            any authenticated user to read ALL logs
--   4. sent_emails         — Same as activity_log: USING (true) leaks
--                            all email records to any logged-in user
--   5. feedback            — INSERT policy exists, no SELECT restriction
--                            (any user can read all user feedback)
--   6. user_profiles.tier  — UPDATE RLS allows users to change their
--                            own tier via Supabase REST API directly,
--                            bypassing backend validation (payment bypass)
--
-- Prerequisites:
--   Migration 010 must have been run first (current_user_id() function
--   must exist and JWT must be configured in Supabase dashboard).
--
-- Idempotent: DROP POLICY IF EXISTS before every CREATE POLICY.
-- Safe to re-run.
-- ================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 1: market_alerts
-- Global market data — public read, service_role writes only.
-- No user_id column; RLS was never enabled on this table.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.market_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_alerts: public read"    ON public.market_alerts;
DROP POLICY IF EXISTS "market_alerts: service write"  ON public.market_alerts;
DROP POLICY IF EXISTS "market_alerts: service update" ON public.market_alerts;
DROP POLICY IF EXISTS "market_alerts: service delete" ON public.market_alerts;

-- Anyone (authenticated or anon) may read market alerts
CREATE POLICY "market_alerts: public read"
  ON public.market_alerts FOR SELECT
  USING (true);

-- Only backend/service can create alerts
CREATE POLICY "market_alerts: service write"
  ON public.market_alerts FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Only backend/service can update alerts (e.g., mark is_read/is_dismissed)
-- Note: individual user read-state should be stored in a separate user table,
-- not in market_alerts itself. Keeping service_role-only for now.
CREATE POLICY "market_alerts: service update"
  ON public.market_alerts FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "market_alerts: service delete"
  ON public.market_alerts FOR DELETE
  USING (auth.role() = 'service_role');


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 2: alert_subscriptions
-- Per-user preferences — user_id is INTEGER (FK to public.users(id)).
-- Uses current_user_id() helper from migration 010.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.alert_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alert_subscriptions: select own"  ON public.alert_subscriptions;
DROP POLICY IF EXISTS "alert_subscriptions: insert own"  ON public.alert_subscriptions;
DROP POLICY IF EXISTS "alert_subscriptions: update own"  ON public.alert_subscriptions;
DROP POLICY IF EXISTS "alert_subscriptions: delete own"  ON public.alert_subscriptions;

CREATE POLICY "alert_subscriptions: select own"
  ON public.alert_subscriptions FOR SELECT
  USING (user_id = public.current_user_id());

CREATE POLICY "alert_subscriptions: insert own"
  ON public.alert_subscriptions FOR INSERT
  WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "alert_subscriptions: update own"
  ON public.alert_subscriptions FOR UPDATE
  USING (user_id = public.current_user_id())
  WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "alert_subscriptions: delete own"
  ON public.alert_subscriptions FOR DELETE
  USING (user_id = public.current_user_id());


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 3: activity_log — Fix overly permissive policy
--
-- Previous policy: "Service role full access" with USING (true)
-- This allowed ANY authenticated user to SELECT all activity log rows.
--
-- Fix: service_role gets full access; authenticated users can INSERT
-- their own activity (for client-side events) and SELECT their own rows.
-- ════════════════════════════════════════════════════════════════════════════

-- activity_log already has RLS enabled (from migration 012), but the
-- existing "Service role full access" policy uses USING (true) — wrong.
-- Drop and replace with correct policies.

DROP POLICY IF EXISTS "Service role full access"              ON public.activity_log;
DROP POLICY IF EXISTS "activity_log: service full access"     ON public.activity_log;
DROP POLICY IF EXISTS "activity_log: select own"              ON public.activity_log;
DROP POLICY IF EXISTS "activity_log: insert own"              ON public.activity_log;

-- Service role can do everything (backend writes audit events)
CREATE POLICY "activity_log: service full access"
  ON public.activity_log
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Authenticated users can read their own log entries
CREATE POLICY "activity_log: select own"
  ON public.activity_log FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (user_id IS NOT NULL AND user_id::text = auth.uid()::text)
  );

-- Authenticated users can insert their own events (client-side activity)
CREATE POLICY "activity_log: insert own"
  ON public.activity_log FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IS NULL  -- anonymous events (pre-login)
    OR user_id::text = auth.uid()::text
  );


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 4: sent_emails — Fix overly permissive policy
--
-- Contains admin email campaign history including body content.
-- Should be service_role ONLY — no user access whatsoever.
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Service role full access"           ON public.sent_emails;
DROP POLICY IF EXISTS "sent_emails: service only select"   ON public.sent_emails;
DROP POLICY IF EXISTS "sent_emails: service only insert"   ON public.sent_emails;
DROP POLICY IF EXISTS "sent_emails: service only update"   ON public.sent_emails;
DROP POLICY IF EXISTS "sent_emails: service only delete"   ON public.sent_emails;

CREATE POLICY "sent_emails: service only select"
  ON public.sent_emails FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "sent_emails: service only insert"
  ON public.sent_emails FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "sent_emails: service only update"
  ON public.sent_emails FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "sent_emails: service only delete"
  ON public.sent_emails FOR DELETE
  USING (auth.role() = 'service_role');


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 5: feedback — Add missing SELECT restriction
--
-- Migration 011 added INSERT policy (anyone can submit) but no SELECT
-- restriction, meaning any authenticated user can read ALL feedback.
-- Fix: service_role only for SELECT/UPDATE/DELETE.
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anyone can submit feedback"         ON public.feedback;
DROP POLICY IF EXISTS "feedback: insert any"               ON public.feedback;
DROP POLICY IF EXISTS "feedback: service select"           ON public.feedback;
DROP POLICY IF EXISTS "feedback: service update"           ON public.feedback;
DROP POLICY IF EXISTS "feedback: service delete"           ON public.feedback;

-- Re-create INSERT (anyone can submit, with or without auth)
CREATE POLICY "feedback: insert any"
  ON public.feedback FOR INSERT
  WITH CHECK (true);

-- Only service_role (admin backend) can read feedback
CREATE POLICY "feedback: service select"
  ON public.feedback FOR SELECT
  USING (auth.role() = 'service_role');

-- Only service_role can update status
CREATE POLICY "feedback: service update"
  ON public.feedback FOR UPDATE
  USING (auth.role() = 'service_role');

-- Only service_role can delete
CREATE POLICY "feedback: service delete"
  ON public.feedback FOR DELETE
  USING (auth.role() = 'service_role');


-- ════════════════════════════════════════════════════════════════════════════
-- SECTION 6: user_profiles.tier — Prevent direct tier escalation
--
-- The existing UPDATE policy (auth.uid() = id) lets users change any
-- column of their own profile row via the Supabase REST API, including
-- the `tier` field. This is a payment bypass vulnerability:
--   PATCH /rest/v1/user_profiles?id=eq.<uid>
--   {"tier": "pro"}
-- would upgrade the user to pro without payment.
--
-- Fix strategy:
--   A. Revoke column-level UPDATE privilege for tier from all non-superuser roles
--   B. Add a BEFORE UPDATE trigger that blocks tier changes from non-service-role
--
-- Both layers are applied for defense-in-depth.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Layer A: Column-level privilege revoke ────────────────────────────────────
-- Removes the ability for anon/authenticated roles to UPDATE the tier column.
-- service_role is a superuser in Supabase and bypasses column privileges.

REVOKE UPDATE (tier) ON public.user_profiles FROM anon;
REVOKE UPDATE (tier) ON public.user_profiles FROM authenticated;

-- ── Layer B: Trigger guard (defense-in-depth) ─────────────────────────────────
-- Belt-and-suspenders: block tier changes from non-service-role sessions
-- even if column privileges are somehow reset or the policy is misconfigured.

CREATE OR REPLACE FUNCTION public.prevent_tier_update_by_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Allow tier changes only by service_role (Stripe webhook, admin API)
  IF OLD.tier IS DISTINCT FROM NEW.tier THEN
    IF auth.role() != 'service_role' THEN
      RAISE EXCEPTION
        'Unauthorized: tier field can only be updated by service_role. '
        'Tier changes must go through the payment API.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.prevent_tier_update_by_user() IS
  'Blocks direct tier field updates from non-service-role sessions. '
  'Only Stripe webhooks and admin APIs (service_role) may change tier.';

-- Drop and recreate trigger to ensure it's current
DROP TRIGGER IF EXISTS guard_tier_update ON public.user_profiles;

CREATE TRIGGER guard_tier_update
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_tier_update_by_user();


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- Run these after applying to confirm RLS is active on all tables.
-- ════════════════════════════════════════════════════════════════════════════
--
-- Check RLS status:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- Check policies:
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
--
-- Test tier protection (should raise exception):
-- UPDATE public.user_profiles SET tier = 'pro' WHERE id = auth.uid();
-- (run as authenticated role — should get "Unauthorized: tier field..." error)
--
-- ════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 011
-- ════════════════════════════════════════════════════════════════════════════
