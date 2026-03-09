-- ────────────────────────────────────────────────────────────────
-- Migration 002: Market Alerts System
-- TradVue - Real-Time Alert Infrastructure
-- ────────────────────────────────────────────────────────────────

-- Market-moving alerts table
-- Stores parsed alerts from RSS/news feeds with urgency scoring
CREATE TABLE IF NOT EXISTS market_alerts (
    id              BIGSERIAL PRIMARY KEY,
    external_id     VARCHAR(512) UNIQUE,          -- Dedup key (source URL or GUID)
    title           VARCHAR(600) NOT NULL,
    summary         TEXT,
    url             VARCHAR(1000),
    source          VARCHAR(100) NOT NULL,
    category        VARCHAR(30) NOT NULL,          -- POLITICAL, FED, ECONOMIC, EARNINGS, BREAKING
    urgency         VARCHAR(10) NOT NULL           -- HIGH, MEDIUM, LOW
                    CHECK (urgency IN ('HIGH', 'MEDIUM', 'LOW')),
    urgency_score   DECIMAL(5, 2) DEFAULT 0,       -- Raw score (higher = more urgent)
    keywords_hit    TEXT[],                        -- Which trigger keywords matched
    symbols         VARCHAR(30)[],                 -- Related ticker symbols
    tags            TEXT[],
    sentiment       VARCHAR(10),                   -- bullish, bearish, neutral
    sentiment_score DECIMAL(4, 3) DEFAULT 0,
    is_read         BOOLEAN DEFAULT FALSE,
    is_dismissed    BOOLEAN DEFAULT FALSE,
    published_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fetched_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_alerts_created_at   ON market_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_alerts_urgency       ON market_alerts (urgency, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_alerts_category      ON market_alerts (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_alerts_external_id   ON market_alerts (external_id);

-- User alert subscriptions
-- Stores per-user preferences for which alert categories/urgencies they want
CREATE TABLE IF NOT EXISTS alert_subscriptions (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    categories      TEXT[] NOT NULL DEFAULT ARRAY['POLITICAL','FED','ECONOMIC','EARNINGS','BREAKING'],
    urgencies       TEXT[] NOT NULL DEFAULT ARRAY['HIGH','MEDIUM'],
    sound_enabled   BOOLEAN DEFAULT TRUE,
    email_enabled   BOOLEAN DEFAULT FALSE,
    push_enabled    BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_user ON alert_subscriptions (user_id);

-- Trigger to auto-update updated_at on alert_subscriptions
CREATE TRIGGER set_updated_at_alert_subscriptions
    BEFORE UPDATE ON alert_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
