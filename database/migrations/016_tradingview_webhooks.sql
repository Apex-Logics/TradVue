-- ================================================================
-- Migration 016: TradingView Webhook Auto-Journal
--
-- Creates tables for webhook token management and event logging.
-- Enables TradingView strategy alerts to auto-populate the trade journal.
-- ================================================================

-- ─── Webhook Tokens ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_tokens (
    id              SERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token           TEXT NOT NULL UNIQUE,       -- 32-char random hex
    label           TEXT DEFAULT 'TradingView',
    source          TEXT NOT NULL DEFAULT 'tradingview',
    is_active       BOOLEAN DEFAULT TRUE,
    last_used_at    TIMESTAMPTZ,
    trade_count     INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Webhook Events ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_events (
    id              SERIAL PRIMARY KEY,
    token_id        INTEGER NOT NULL REFERENCES webhook_tokens(id),
    user_id         UUID NOT NULL,
    source_ip       TEXT NOT NULL,
    raw_payload     JSONB NOT NULL,
    parsed_ticker   TEXT,
    parsed_action   TEXT,           -- 'buy' or 'sell'
    parsed_price    NUMERIC,
    parsed_quantity NUMERIC,
    trade_id        INTEGER,        -- linked trade id if matched
    status          TEXT DEFAULT 'received'
                        CHECK (status IN ('received', 'matched', 'error', 'ignored')),
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_webhook_tokens_token   ON webhook_tokens (token);
CREATE INDEX IF NOT EXISTS idx_webhook_tokens_user_id ON webhook_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_token   ON webhook_events (token_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_user_id ON webhook_events (user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status  ON webhook_events (status);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE webhook_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- webhook_tokens: users see and manage their own tokens only
DROP POLICY IF EXISTS webhook_tokens_select_own ON webhook_tokens;
CREATE POLICY webhook_tokens_select_own
    ON webhook_tokens FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS webhook_tokens_insert_own ON webhook_tokens;
CREATE POLICY webhook_tokens_insert_own
    ON webhook_tokens FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS webhook_tokens_update_own ON webhook_tokens;
CREATE POLICY webhook_tokens_update_own
    ON webhook_tokens FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS webhook_tokens_delete_own ON webhook_tokens;
CREATE POLICY webhook_tokens_delete_own
    ON webhook_tokens FOR DELETE
    USING (auth.uid() = user_id);

-- webhook_events: users see their own events only
DROP POLICY IF EXISTS webhook_events_select_own ON webhook_events;
CREATE POLICY webhook_events_select_own
    ON webhook_events FOR SELECT
    USING (auth.uid() = user_id);

-- Service role has full access (for the webhook receiver endpoint)
DROP POLICY IF EXISTS webhook_tokens_service_role ON webhook_tokens;
CREATE POLICY webhook_tokens_service_role
    ON webhook_tokens FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS webhook_events_service_role ON webhook_events;
CREATE POLICY webhook_events_service_role
    ON webhook_events FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_webhook_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_webhook_tokens_updated_at ON webhook_tokens;
CREATE TRIGGER trg_webhook_tokens_updated_at
    BEFORE UPDATE ON webhook_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_tokens_updated_at();

-- =============================================================================
