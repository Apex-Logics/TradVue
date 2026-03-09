-- ================================================================
-- TradVue Database Schema
-- PostgreSQL 15+
-- Run: psql -U postgres -d tradvue -f schema.sql
-- ================================================================

-- Create database (run separately as superuser if needed)
-- CREATE DATABASE tradvue;
-- \c tradvue

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────
-- Users & Auth
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    subscription_tier VARCHAR(20) DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    verified        BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(512) UNIQUE NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────
-- Market Instruments
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS instruments (
    id          SERIAL PRIMARY KEY,
    symbol      VARCHAR(30) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    type        VARCHAR(20) NOT NULL CHECK (type IN ('forex', 'crypto', 'stock', 'commodity', 'index')),
    exchange    VARCHAR(50),
    currency    VARCHAR(10) DEFAULT 'USD',
    active      BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default instruments
INSERT INTO instruments (symbol, name, type, exchange, currency) VALUES
    ('EUR/USD', 'Euro / US Dollar',           'forex',     'FOREX',   'USD'),
    ('GBP/USD', 'British Pound / US Dollar',  'forex',     'FOREX',   'USD'),
    ('USD/JPY', 'US Dollar / Japanese Yen',   'forex',     'FOREX',   'JPY'),
    ('AUD/USD', 'Australian Dollar / US Dollar','forex',   'FOREX',   'USD'),
    ('USD/CAD', 'US Dollar / Canadian Dollar','forex',     'FOREX',   'CAD'),
    ('USD/CHF', 'US Dollar / Swiss Franc',    'forex',     'FOREX',   'CHF'),
    ('BTC/USD', 'Bitcoin / US Dollar',        'crypto',    'BINANCE', 'USD'),
    ('ETH/USD', 'Ethereum / US Dollar',       'crypto',    'BINANCE', 'USD'),
    ('SOL/USD', 'Solana / US Dollar',         'crypto',    'BINANCE', 'USD'),
    ('BNB/USD', 'BNB / US Dollar',            'crypto',    'BINANCE', 'USD'),
    ('AAPL',    'Apple Inc.',                 'stock',     'NASDAQ',  'USD'),
    ('GOOGL',   'Alphabet Inc.',              'stock',     'NASDAQ',  'USD'),
    ('TSLA',    'Tesla Inc.',                 'stock',     'NASDAQ',  'USD'),
    ('MSFT',    'Microsoft Corporation',      'stock',     'NASDAQ',  'USD'),
    ('NVDA',    'NVIDIA Corporation',         'stock',     'NASDAQ',  'USD'),
    ('AMZN',    'Amazon.com Inc.',            'stock',     'NASDAQ',  'USD'),
    ('GOLD',    'Gold Spot',                  'commodity', 'COMEX',   'USD'),
    ('SILVER',  'Silver Spot',                'commodity', 'COMEX',   'USD'),
    ('OIL',     'Crude Oil WTI',              'commodity', 'NYMEX',   'USD'),
    ('SPX',     'S&P 500 Index',              'index',     'NYSE',    'USD')
ON CONFLICT (symbol) DO NOTHING;

-- ────────────────────────────────────────────
-- Price Data (time-series — consider TimescaleDB in prod)
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS price_data (
    id              BIGSERIAL PRIMARY KEY,
    instrument_id   INTEGER REFERENCES instruments(id) ON DELETE CASCADE,
    price           DECIMAL(20, 8) NOT NULL,
    open            DECIMAL(20, 8),
    high            DECIMAL(20, 8),
    low             DECIMAL(20, 8),
    close           DECIMAL(20, 8),
    volume          DECIMAL(20, 8),
    resolution      VARCHAR(5) DEFAULT '1',  -- '1','5','15','30','60','D','W'
    timestamp       TIMESTAMPTZ NOT NULL,
    source          VARCHAR(50) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Partition by month in production for performance. For now, just index.
CREATE INDEX IF NOT EXISTS idx_price_data_instrument_ts ON price_data (instrument_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_price_data_ts ON price_data (timestamp DESC);

-- ────────────────────────────────────────────
-- News Articles
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS news_articles (
    id              BIGSERIAL PRIMARY KEY,
    external_id     VARCHAR(512) UNIQUE,        -- Source's own ID / URL (dedup key)
    title           VARCHAR(600) NOT NULL,
    summary         TEXT,
    content         TEXT,
    url             VARCHAR(1000),
    source          VARCHAR(100) NOT NULL,
    category        VARCHAR(50),
    image_url       VARCHAR(1000),
    impact_score    DECIMAL(4, 2) DEFAULT 0,    -- 0-10 (AI/keyword scored)
    sentiment_score DECIMAL(4, 3) DEFAULT 0,    -- -1.0 to 1.0
    sentiment_label VARCHAR(20),                -- 'bullish', 'bearish', 'neutral'
    tags            TEXT[],                     -- Array of tag strings
    symbols         VARCHAR(30)[],              -- Related instrument symbols
    published_at    TIMESTAMPTZ NOT NULL,
    fetched_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_published_at ON news_articles (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_impact ON news_articles (impact_score DESC);
CREATE INDEX IF NOT EXISTS idx_news_symbols ON news_articles USING GIN (symbols);
CREATE INDEX IF NOT EXISTS idx_news_tags ON news_articles USING GIN (tags);

-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_news_fts ON news_articles
    USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,'')));

-- ────────────────────────────────────────────
-- Economic Calendar Events
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_events (
    id              BIGSERIAL PRIMARY KEY,
    external_id     VARCHAR(512) UNIQUE,
    title           VARCHAR(300) NOT NULL,
    currency        VARCHAR(10) NOT NULL,
    impact          SMALLINT NOT NULL CHECK (impact BETWEEN 1 AND 3),  -- 1=low,2=med,3=high
    impact_label    VARCHAR(10),
    event_time      TIMESTAMPTZ NOT NULL,
    actual          VARCHAR(50),
    forecast        VARCHAR(50),
    previous        VARCHAR(50),
    description     TEXT,
    source          VARCHAR(100),
    url             VARCHAR(1000),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_time ON calendar_events (event_time);
CREATE INDEX IF NOT EXISTS idx_calendar_currency ON calendar_events (currency);
CREATE INDEX IF NOT EXISTS idx_calendar_impact ON calendar_events (impact);

-- ────────────────────────────────────────────
-- User Watchlists
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS watchlists (
    id                      SERIAL PRIMARY KEY,
    user_id                 INTEGER REFERENCES users(id) ON DELETE CASCADE,
    instrument_id           INTEGER REFERENCES instruments(id) ON DELETE CASCADE,
    alert_threshold_up      DECIMAL(10, 4),   -- Price alert above this
    alert_threshold_down    DECIMAL(10, 4),   -- Price alert below this
    notes                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, instrument_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlists_user ON watchlists (user_id);

-- ────────────────────────────────────────────
-- Alert Notifications Log
-- ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alert_notifications (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    watchlist_id    INTEGER REFERENCES watchlists(id) ON DELETE SET NULL,
    alert_type      VARCHAR(30) NOT NULL,   -- 'price_up', 'price_down', 'news', 'calendar'
    message         TEXT NOT NULL,
    delivered       BOOLEAN DEFAULT FALSE,
    delivery_method VARCHAR(20),            -- 'email', 'push', 'in_app'
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON alert_notifications (user_id, delivered);

-- ────────────────────────────────────────────
-- Updated-at trigger (auto-update updated_at)
-- ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER calendar_updated_at BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
