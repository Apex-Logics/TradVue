-- ================================================================
-- Migration 022: portfolio_*.user_id INTEGER → UUID
--
-- Residual after Q6 merge (PR #22 / e411e73): DRIP compounding is
-- correct, but GET/POST /api/portfolio/holdings still 500 for every
-- Supabase-auth user. Same class as watchlists PR #18 / migration 021.
--
-- Staging log:
--   [Portfolio] GET holdings error: invalid input syntax for type integer:
--   "e11316bf-..."
--
-- Root cause
-- ----------
-- requireAuth sets req.user.id to the Supabase Auth UUID (auth.users.id).
-- All portfolio_* user_id columns were INTEGER referencing legacy
-- public.users(id). Auth routes only write user_profiles (UUID) — they
-- never create legacy users rows. Journal/cloud sync already uses
-- user_data.user_id UUID and works. Watchlists already UUID (021).
-- /api/portfolio/* is therefore broken for every current auth user.
--
-- Scope
-- -----
-- ALL portfolio_* tables that have user_id:
--   portfolio_holdings, portfolio_transactions, portfolio_sold,
--   portfolio_settings, portfolio_dividend_overrides,
--   portfolio_dividend_log, portfolio_watchlist
-- Do not migrate dashboard_*, alert_*, or other INTEGER user_id tables.
--
-- Live data
-- ---------
-- Prod counts (2026-09-06): holdings / dividend_log / sold /
-- transactions = 0 rows each. Staging portfolio_* tables still INTEGER.
-- Integer keys cannot be mapped to a Supabase Auth UUID. This migration
-- DELETES remaining integer rows before the type change (same as 021).
--
-- RLS
-- ---
-- Existing portfolio_* policies compare user_id to public.current_user_id()
-- (INTEGER from a custom JWT userId claim). Those policies must be dropped
-- before ALTER TYPE, then recreated against auth.uid() (UUID).
-- Backend /api/portfolio uses the service role (RLS bypassed); the new
-- policies keep client/anon access consistent with watchlists / user_data.
--
-- Apply
-- -----
-- Do NOT apply this to live projects from the agent. Axle applies the
-- preview project after merge, then the primary project after verify.
--
-- Rollback: database/rollbacks/022_portfolio_user_id_uuid_rollback.sql
-- ================================================================

-- 1) Drop INTEGER RLS policies. ALTER TYPE fails if a policy still
--    references the old type.
DO $$
DECLARE
  tbl text;
  pol text;
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

-- 2) Drop UNIQUE / PK / FK constraints that include user_id
--    (typically portfolio_*_user_id_fkey → public.users(id),
--     UNIQUE(user_id, symbol[, ...]), portfolio_settings_pkey).
--    Then drop leftover indexes on user_id.
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

    FOR r IN
      SELECT i.relname AS index_name
      FROM pg_index x
      JOIN pg_class t ON t.oid = x.indrelid
      JOIN pg_class i ON i.oid = x.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = tbl
        AND NOT x.indisprimary
        AND EXISTS (
          SELECT 1
          FROM unnest(x.indkey) AS colnum
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = colnum
          WHERE a.attname = 'user_id'
        )
    LOOP
      EXECUTE format('DROP INDEX IF EXISTS public.%I', r.index_name);
    END LOOP;
  END LOOP;
END $$;

-- Named leftovers (safe if already dropped above).
DROP INDEX IF EXISTS idx_ph_user;
DROP INDEX IF EXISTS idx_pt_user;
DROP INDEX IF EXISTS idx_pdo_user;
DROP INDEX IF EXISTS idx_ps_user;
DROP INDEX IF EXISTS idx_pwl_user;
DROP INDEX IF EXISTS idx_dividend_log_user;
DROP INDEX IF EXISTS idx_dividend_log_symbol;
DROP INDEX IF EXISTS portfolio_holdings_user_id_symbol_key;
DROP INDEX IF EXISTS portfolio_dividend_overrides_user_id_symbol_year_month_key;
DROP INDEX IF EXISTS portfolio_dividend_log_user_id_symbol_payment_date_key;
DROP INDEX IF EXISTS portfolio_watchlist_user_id_symbol_key;

-- 3) Clear legacy integer rows, then convert each column.
--    Prod 2026-09-06: holdings/dividend_log/sold/transactions = 0 rows.
--    Integer keys cannot be cast to a meaningful Auth UUID.
--    Child rows first so holdings CASCADE is not required.
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
        AND data_type = 'integer'
    ) THEN
      EXECUTE format('DELETE FROM public.%I', tbl);
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN user_id TYPE UUID USING NULL',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- 4) Recreate UNIQUE / PK / indexes.
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

-- 5) Recreate RLS against Supabase Auth UUID (auth.uid()).
--    Service role used by the API still bypasses RLS.
--    dividend_log insert keeps the 018 service_role OR for backfill clients.
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
      'CREATE POLICY %I ON public.%I FOR SELECT USING (user_id = auth.uid())',
      tbl || ': select own', tbl
    );
    IF tbl = 'portfolio_dividend_log' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (user_id = auth.uid() OR auth.role() = %L)',
        tbl || ': insert own', tbl, 'service_role'
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (user_id = auth.uid())',
        tbl || ': insert own', tbl
      );
    END IF;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())',
      tbl || ': update own', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (user_id = auth.uid())',
      tbl || ': delete own', tbl
    );

    EXECUTE format(
      'COMMENT ON COLUMN public.%I.user_id IS %L',
      tbl,
      'Supabase Auth UUID (auth.users.id / user_profiles.id). '
      || 'Converted from INTEGER (legacy public.users.id) in migration 022. '
      || 'No FK to public.users.'
    );
  END LOOP;
END $$;

-- =============================================================================
