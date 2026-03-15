-- ================================================================
-- Migration 011 v2: Fix RLS — ONLY tables that exist in Supabase
-- Safe to re-run (idempotent)
-- ================================================================


-- ═══ SECTION 1: activity_log — Fix overly permissive policy ═══

DROP POLICY IF EXISTS "Service role full access"              ON public.activity_log;
DROP POLICY IF EXISTS "activity_log: service full access"     ON public.activity_log;
DROP POLICY IF EXISTS "activity_log: select own"              ON public.activity_log;
DROP POLICY IF EXISTS "activity_log: insert own"              ON public.activity_log;

CREATE POLICY "activity_log: service full access"
  ON public.activity_log
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "activity_log: select own"
  ON public.activity_log FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (user_id IS NOT NULL AND user_id::text = auth.uid()::text)
  );

CREATE POLICY "activity_log: insert own"
  ON public.activity_log FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR user_id IS NULL
    OR user_id::text = auth.uid()::text
  );


-- ═══ SECTION 2: sent_emails — Service role only ═══

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


-- ═══ SECTION 3: feedback — Add missing SELECT restriction ═══

DROP POLICY IF EXISTS "Anyone can submit feedback"         ON public.feedback;
DROP POLICY IF EXISTS "feedback: insert any"               ON public.feedback;
DROP POLICY IF EXISTS "feedback: service select"           ON public.feedback;
DROP POLICY IF EXISTS "feedback: service update"           ON public.feedback;
DROP POLICY IF EXISTS "feedback: service delete"           ON public.feedback;

CREATE POLICY "feedback: insert any"
  ON public.feedback FOR INSERT
  WITH CHECK (true);

CREATE POLICY "feedback: service select"
  ON public.feedback FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "feedback: service update"
  ON public.feedback FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "feedback: service delete"
  ON public.feedback FOR DELETE
  USING (auth.role() = 'service_role');


-- ═══ SECTION 4: user_profiles.tier — Prevent self-upgrade ═══

REVOKE UPDATE (tier) ON public.user_profiles FROM anon;
REVOKE UPDATE (tier) ON public.user_profiles FROM authenticated;

CREATE OR REPLACE FUNCTION public.prevent_tier_update_by_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.tier IS DISTINCT FROM NEW.tier THEN
    IF auth.role() != 'service_role' THEN
      RAISE EXCEPTION
        'Unauthorized: tier can only be changed via payment API.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_tier_update ON public.user_profiles;

CREATE TRIGGER guard_tier_update
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_tier_update_by_user();


-- ════════════════════════════════════════════════════════════════
-- DONE. Expected result: "Success. No rows returned."
-- ════════════════════════════════════════════════════════════════
