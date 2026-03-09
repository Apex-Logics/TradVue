-- ================================================================
-- Migration: 003 Portfolio Tables
-- Adds portfolio persistence tables for holdings, transactions,
-- dividend overrides, sold positions, and portfolio watchlist.
-- ================================================================

-- Portfolio holdings (one row per position)
CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  company_name VARCHAR(255),
  sector VARCHAR(100),
  shares DECIMAL(15,6) NOT NULL,
  avg_cost DECIMAL(15,4) NOT NULL,
  buy_date DATE,
  annual_dividend DECIMAL(15,6) DEFAULT 0,   -- per-share annual dividend (cached from API)
  div_override_annual DECIMAL(15,6),          -- user manual override for annual div/share
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_ph_user ON portfolio_holdings (user_id);

-- Transaction log per holding (multiple buy lots / partial sells)
CREATE TABLE IF NOT EXISTS portfolio_transactions (
  id SERIAL PRIMARY KEY,
  holding_id INTEGER REFERENCES portfolio_holdings(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('buy', 'sell')),
  shares DECIMAL(15,6) NOT NULL,
  price DECIMAL(15,4) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pt_holding ON portfolio_transactions (holding_id);
CREATE INDEX IF NOT EXISTS idx_pt_user ON portfolio_transactions (user_id);

-- Dividend overrides (per ticker/year/month)
CREATE TABLE IF NOT EXISTS portfolio_dividend_overrides (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,    -- 0-indexed (0=Jan, 11=Dec)
  amount DECIMAL(15,4) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol, year, month)
);

CREATE INDEX IF NOT EXISTS idx_pdo_user ON portfolio_dividend_overrides (user_id);

-- Sold positions
CREATE TABLE IF NOT EXISTS portfolio_sold (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  company_name VARCHAR(255),
  sector VARCHAR(100),
  shares DECIMAL(15,6) NOT NULL,
  avg_cost DECIMAL(15,4) NOT NULL,
  sale_price DECIMAL(15,4) NOT NULL,
  buy_date DATE,
  sell_date DATE NOT NULL,
  dividends_received DECIMAL(15,4) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ps_user ON portfolio_sold (user_id);

-- Portfolio watchlist (separate from trading watchlist)
CREATE TABLE IF NOT EXISTS portfolio_watchlist (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  symbol VARCHAR(20) NOT NULL,
  company_name VARCHAR(255),
  sector VARCHAR(100) DEFAULT 'Other',
  target_price DECIMAL(15,4),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

CREATE INDEX IF NOT EXISTS idx_pwl_user ON portfolio_watchlist (user_id);

-- Auto-update triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS portfolio_holdings_updated_at ON portfolio_holdings;
CREATE TRIGGER portfolio_holdings_updated_at BEFORE UPDATE ON portfolio_holdings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS portfolio_dividend_overrides_updated_at ON portfolio_dividend_overrides;
CREATE TRIGGER portfolio_dividend_overrides_updated_at BEFORE UPDATE ON portfolio_dividend_overrides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS portfolio_watchlist_updated_at ON portfolio_watchlist;
CREATE TRIGGER portfolio_watchlist_updated_at BEFORE UPDATE ON portfolio_watchlist
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
