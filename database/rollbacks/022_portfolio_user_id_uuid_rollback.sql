-- ================================================================
-- Rollback for Migration 022: portfolio_*.user_id UUID → INTEGER
--
-- Kept OUTSIDE database/migrations/ so a `*.sql` runner cannot undo
-- the forward migration immediately after applying it.
-- Apply this file manually/explicitly when you intend to roll back.
--
-- DESTRUCTIVE: UUID-keyed rows cannot map back to legacy users.id.
-- This rollback DELETES all portfolio_* rows, then restores INTEGER
-- user_id + the public.users(id) FK and INTEGER RLS policies.
--
-- Roll the application CODE back first (or atomically with this
-- file). New /api/portfolio code passes a UUID string; after this
-- rollback that will 500 again with the integer-cast error.
--
-- Does not touch watchlists, dashboard_*, or alert_notifications.
-- ================================================================

DO $$
DECLARE
  tbl text;
  pol text;
  r RECORD;
  tables text[] := ARRAY[
    'portfolio_holdings',
    'portfolio_transactions',
    'portfolio_sold',
    'portfolio_settings',
    'portfolio_dividend_overrides',
    'portfolio_dividend_log',
    'portfolio_watchlist'
  ];
  actions text[] := ARRAY['select own', 'insert own', 'update own', 'delete own'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    FOREACH pol IN ARRAY actions LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        tbl || ': ' || pol,
        tbl
      );
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE public.portfolio_holdings
  DROP CONSTRAINT IF EXISTS portfolio_holdings_user_id_symbol_key;
ALTER TABLE public.portfolio_dividend_overrides
  DROP CONSTRAINT IF EXISTS portfolio_dividend_overrides_user_id_symbol_year_month_key;
ALTER TABLE public.portfolio_dividend_log
  DROP CONSTRAINT IF EXISTS portfolio_dividend_log_user_id_symbol_payment_date_key;
ALTER TABLE public.portfolio_watchlist
  DROP CONSTRAINT IF EXISTS portfolio_watchlist_user_id_symbol_key;
ALTER TABLE public.portfolio_settings
  DROP CONSTRAINT IF EXISTS portfolio_settings_pkey;

DROP INDEX IF EXISTS idx_ph_user;
DROP INDEX IF EXISTS idx_pt_user;
DROP INDEX IF EXISTS idx_pdo_user;
DROP INDEX IF EXISTS idx_ps_user;
DROP INDEX IF EXISTS idx_pwl_user;
DROP INDEX IF EXISTS idx_dividend_log_user;
DROP INDEX IF EXISTS idx_dividend_log_symbol;

DO $$
DECLARE
  tbl text;
  r RECORD;
  tables text[] := ARRAY[
    'portfolio_holdings',
    'portfolio_transactions',
    'portfolio_sold',
    'portfolio_settings',
    'portfolio_dividend_overrides',
    'portfolio_dividend_log',
    'portfolio_watchlist'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    FOR r IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = tbl
        AND c.contype IN ('u', 'f', 'p')
        AND EXISTS (
          SELECT 1
          FROM unnest(c.conkey) AS colnum
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = colnum
          WHERE a.attname = 'user_id'
        )
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', tbl, r.conname);
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'portfolio_transactions',
    'portfolio_dividend_log',
    'portfolio_dividend_overrides',
    'portfolio_sold',
    'portfolio_watchlist',
    'portfolio_settings',
    'portfolio_holdings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = tbl
        AND column_name = 'user_id'
        AND data_type = 'uuid'
    ) THEN
      EXECUTE format('DELETE FROM public.%I', tbl);
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN user_id TYPE INTEGER USING NULL',
        tbl
      );
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.portfolio_holdings
  DROP CONSTRAINT IF EXISTS portfolio_holdings_user_id_symbol_key;
ALTER TABLE public.portfolio_holdings
  ADD CONSTRAINT portfolio_holdings_user_id_symbol_key UNIQUE (user_id, symbol);

ALTER TABLE public.portfolio_dividend_overrides
  DROP CONSTRAINT IF EXISTS portfolio_dividend_overrides_user_id_symbol_year_month_key;
ALTER TABLE public.portfolio_dividend_overrides
  ADD CONSTRAINT portfolio_dividend_overrides_user_id_symbol_year_month_key
  UNIQUE (user_id, symbol, year, month);

ALTER TABLE public.portfolio_dividend_log
  DROP CONSTRAINT IF EXISTS portfolio_dividend_log_user_id_symbol_payment_date_key;
ALTER TABLE public.portfolio_dividend_log
  ADD CONSTRAINT portfolio_dividend_log_user_id_symbol_payment_date_key
  UNIQUE (user_id, symbol, payment_date);

ALTER TABLE public.portfolio_watchlist
  DROP CONSTRAINT IF EXISTS portfolio_watchlist_user_id_symbol_key;
ALTER TABLE public.portfolio_watchlist
  ADD CONSTRAINT portfolio_watchlist_user_id_symbol_key UNIQUE (user_id, symbol);

ALTER TABLE public.portfolio_settings
  DROP CONSTRAINT IF EXISTS portfolio_settings_pkey;
ALTER TABLE public.portfolio_settings
  ADD CONSTRAINT portfolio_settings_pkey PRIMARY KEY (user_id);

CREATE INDEX IF NOT EXISTS idx_ph_user ON public.portfolio_holdings (user_id);
CREATE INDEX IF NOT EXISTS idx_pt_user ON public.portfolio_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_pdo_user ON public.portfolio_dividend_overrides (user_id);
CREATE INDEX IF NOT EXISTS idx_ps_user ON public.portfolio_sold (user_id);
CREATE INDEX IF NOT EXISTS idx_pwl_user ON public.portfolio_watchlist (user_id);
CREATE INDEX IF NOT EXISTS idx_dividend_log_user ON public.portfolio_dividend_log (user_id);
CREATE INDEX IF NOT EXISTS idx_dividend_log_symbol ON public.portfolio_dividend_log (user_id, symbol);

-- Restore legacy FKs only if public.users exists.
DO $$
DECLARE
  tbl text;
  fkey text;
  tables text[] := ARRAY[
    'portfolio_holdings',
    'portfolio_transactions',
    'portfolio_sold',
    'portfolio_settings',
    'portfolio_dividend_overrides',
    'portfolio_dividend_log',
    'portfolio_watchlist'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    RETURN;
  END IF;

  FOREACH tbl IN ARRAY tables LOOP
    fkey := tbl || '_user_id_fkey';
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', tbl, fkey);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE',
      tbl, fkey
    );
  END LOOP;
END $$;

-- Restore INTEGER RLS (current_user_id()).
DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'portfolio_holdings',
    'portfolio_transactions',
    'portfolio_sold',
    'portfolio_settings',
    'portfolio_dividend_overrides',
    'portfolio_dividend_log',
    'portfolio_watchlist'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (user_id = public.current_user_id())',
      tbl || ': select own', tbl
    );
    IF tbl = 'portfolio_dividend_log' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (user_id = public.current_user_id() OR auth.role() = %L)',
        tbl || ': insert own', tbl, 'service_role'
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (user_id = public.current_user_id())',
        tbl || ': insert own', tbl
      );
    END IF;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (user_id = public.current_user_id()) WITH CHECK (user_id = public.current_user_id())',
      tbl || ': update own', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (user_id = public.current_user_id())',
      tbl || ': delete own', tbl
    );

    EXECUTE format(
      'COMMENT ON COLUMN public.%I.user_id IS %L',
      tbl,
      'Legacy INTEGER FK to public.users(id). Restored by rollback of migration 022.'
    );
  END LOOP;
END $$;

-- =============================================================================
