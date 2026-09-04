-- ================================================================
-- Rollback for Migration 021: watchlists.user_id UUID → INTEGER
--
-- Kept OUTSIDE database/migrations/ so a `*.sql` runner cannot undo
-- the forward migration immediately after applying it.
-- Apply this file manually/explicitly when you intend to roll back.
--
-- DESTRUCTIVE: UUID-keyed rows cannot map back to legacy users.id.
-- This rollback DELETES all watchlists rows, then restores INTEGER
-- user_id + the public.users(id) FK and INTEGER RLS policies.
--
-- Roll the application CODE back first (or atomically with this
-- file). New /api/watchlist code passes a UUID string; after this
-- rollback that will 500 again with the integer-cast error.
--
-- Does not touch portfolio_*, dashboard_*, or alert_notifications
-- (those INTEGER user_id columns were never migrated).
-- ================================================================

DROP POLICY IF EXISTS "watchlists: select own"  ON public.watchlists;
DROP POLICY IF EXISTS "watchlists: insert own"  ON public.watchlists;
DROP POLICY IF EXISTS "watchlists: update own"  ON public.watchlists;
DROP POLICY IF EXISTS "watchlists: delete own"  ON public.watchlists;

ALTER TABLE public.watchlists
  DROP CONSTRAINT IF EXISTS watchlists_user_id_instrument_id_key;

DROP INDEX IF EXISTS idx_watchlists_user;

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
      AND c.contype = 'f'
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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'watchlists'
      AND column_name = 'user_id'
      AND data_type = 'uuid'
  ) THEN
    DELETE FROM public.watchlists;

    ALTER TABLE public.watchlists
      ALTER COLUMN user_id TYPE INTEGER USING NULL;
  END IF;
END $$;

ALTER TABLE public.watchlists
  DROP CONSTRAINT IF EXISTS watchlists_user_id_instrument_id_key;

ALTER TABLE public.watchlists
  ADD CONSTRAINT watchlists_user_id_instrument_id_key UNIQUE (user_id, instrument_id);

CREATE INDEX IF NOT EXISTS idx_watchlists_user ON public.watchlists (user_id);

-- Restore legacy FK only if public.users exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    ALTER TABLE public.watchlists
      DROP CONSTRAINT IF EXISTS watchlists_user_id_fkey;

    ALTER TABLE public.watchlists
      ADD CONSTRAINT watchlists_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlists: select own"
  ON public.watchlists FOR SELECT
  USING (user_id = public.current_user_id());

CREATE POLICY "watchlists: insert own"
  ON public.watchlists FOR INSERT
  WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "watchlists: update own"
  ON public.watchlists FOR UPDATE
  USING (user_id = public.current_user_id())
  WITH CHECK (user_id = public.current_user_id());

CREATE POLICY "watchlists: delete own"
  ON public.watchlists FOR DELETE
  USING (user_id = public.current_user_id());

COMMENT ON COLUMN public.watchlists.user_id IS
  'Legacy INTEGER FK to public.users(id). Restored by rollback of migration 021.';

-- =============================================================================
