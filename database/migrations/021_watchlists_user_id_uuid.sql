-- ================================================================
-- Migration 021: watchlists.user_id INTEGER → UUID
--
-- Residual after PR #17 (51d3ea5): purchase_price select is gone, but
-- GET/POST /api/watchlist still 500 for every Supabase-auth user.
--
-- Render log:
--   [Watchlist] GET error: Error: invalid input syntax for type integer:
--   "e11316bf-5ba9-49d6-ac8d-333842a845f8"
--
-- Root cause
-- ----------
-- requireAuth sets req.user.id to the Supabase Auth UUID (auth.users.id).
-- watchlists.user_id was INTEGER referencing legacy public.users(id).
-- Auth routes only write user_profiles (UUID) — they never create legacy
-- users rows. Journal/cloud sync already uses user_data.user_id UUID and
-- works. /api/watchlist is therefore broken for every current auth user
-- on both live Supabase projects.
--
-- Scope
-- -----
-- watchlists ONLY. Do not migrate portfolio_*, dashboard_*,
-- alert_notifications, or other INTEGER user_id tables in this PR.
--
-- Live data
-- ---------
-- The primary project has exactly 2 watchlists rows, both for the legacy
-- chartgenius.io QA user (users.id = 1). Those integer keys cannot
-- be mapped to a Supabase Auth UUID, and they are disposable QA rows.
-- This migration DELETES those rows before the type change.
-- The preview project watchlists table is empty; its users table is
-- empty; it has 20 seeded instruments (untouched).
--
-- RLS
-- ---
-- Existing watchlists policies compare user_id to public.current_user_id()
-- (INTEGER from a custom JWT userId claim). Those policies must be dropped
-- before ALTER TYPE, then recreated against auth.uid() (UUID).
-- Backend /api/watchlist uses the service role (RLS bypassed); the new
-- policies keep client/anon access consistent with user_data / webhooks.
--
-- Apply
-- -----
-- Do NOT apply this to live projects from the agent. Axle applies the
-- preview project after merge, then the primary project after verify.
--
-- Rollback: database/rollbacks/021_watchlists_user_id_uuid_rollback.sql
-- ================================================================

-- 1) Drop watchlists RLS policies that compare INTEGER user_id.
--    ALTER TYPE fails if a policy still references the old type.
DROP POLICY IF EXISTS "watchlists: select own"  ON public.watchlists;
DROP POLICY IF EXISTS "watchlists: insert own"  ON public.watchlists;
DROP POLICY IF EXISTS "watchlists: update own"  ON public.watchlists;
DROP POLICY IF EXISTS "watchlists: delete own"  ON public.watchlists;

-- 2) Drop UNIQUE(user_id, instrument_id) and any FK on user_id
--    (typically watchlists_user_id_fkey → public.users(id)).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'watchlists'
      AND c.contype IN ('u', 'f')
      AND EXISTS (
        SELECT 1
        FROM unnest(c.conkey) AS colnum
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = colnum
        WHERE a.attname = 'user_id'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.watchlists DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

DROP INDEX IF EXISTS idx_watchlists_user;
DROP INDEX IF EXISTS watchlists_user_id_instrument_id_key;

-- 3) Clear legacy integer rows, then convert the column.
--    Primary project: 2 rows for users.id = 1 (chartgenius.io QA) — disposable.
--    Preview project: 0 rows. Integer 1 cannot be cast to a meaningful Auth UUID.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'watchlists'
      AND column_name = 'user_id'
      AND data_type = 'integer'
  ) THEN
    DELETE FROM public.watchlists;

    ALTER TABLE public.watchlists
      ALTER COLUMN user_id TYPE UUID USING NULL;
  END IF;
END $$;

-- 4) Recreate unique(user_id, instrument_id) and the user lookup index.
ALTER TABLE public.watchlists
  DROP CONSTRAINT IF EXISTS watchlists_user_id_instrument_id_key;

ALTER TABLE public.watchlists
  ADD CONSTRAINT watchlists_user_id_instrument_id_key UNIQUE (user_id, instrument_id);

CREATE INDEX IF NOT EXISTS idx_watchlists_user ON public.watchlists (user_id);

-- 5) Recreate RLS against Supabase Auth UUID (auth.uid()).
--    Service role used by the API still bypasses RLS.
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlists: select own"
  ON public.watchlists FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "watchlists: insert own"
  ON public.watchlists FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "watchlists: update own"
  ON public.watchlists FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "watchlists: delete own"
  ON public.watchlists FOR DELETE
  USING (user_id = auth.uid());

COMMENT ON COLUMN public.watchlists.user_id IS
  'Supabase Auth UUID (auth.users.id / user_profiles.id). '
  'Converted from INTEGER (legacy public.users.id) in migration 021. '
  'No FK to public.users.';

-- =============================================================================
