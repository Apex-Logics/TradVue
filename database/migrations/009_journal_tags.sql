-- ================================================================
-- Migration 009: Journal Tags & Categories
-- 
-- Adds trade tags system with preset + custom tags.
-- Supports setup types, mistakes, and user strategies.
-- ================================================================

-- ─── Tag Categories ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trade_tag_categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(50) NOT NULL UNIQUE,    -- 'setup_type', 'mistake', 'strategy'
    label       VARCHAR(100) NOT NULL,          -- Display label
    color       VARCHAR(7),                     -- Hex color for UI
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO trade_tag_categories (name, label, color) VALUES
    ('setup_type', 'Setup Type', '#6366f1'),
    ('mistake',    'Mistake',    '#f59e0b'),
    ('strategy',   'Strategy',   '#10b981')
ON CONFLICT (name) DO NOTHING;

-- ─── Tags ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trade_tags (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
    category_id     INTEGER REFERENCES trade_tag_categories(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    color           VARCHAR(7),             -- Optional override color
    is_preset       BOOLEAN DEFAULT FALSE,  -- System presets vs user-created
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, category_id, name)
);

-- ─── Preset Tags (system defaults, user_id = NULL) ──────────────────────────

-- Setup Types
INSERT INTO trade_tags (user_id, category_id, name, is_preset) VALUES
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'setup_type'), 'Breakout', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'setup_type'), 'Pullback', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'setup_type'), 'Reversal', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'setup_type'), 'Trend Follow', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'setup_type'), 'Gap Fill', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'setup_type'), 'VWAP Bounce', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'setup_type'), 'Support/Resistance', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'setup_type'), 'Momentum', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'setup_type'), 'Earnings Play', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'setup_type'), 'Scalp', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'setup_type'), 'Swing', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'setup_type'), 'News Catalyst', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'setup_type'), 'Technical Pattern', TRUE)
ON CONFLICT DO NOTHING;

-- Mistakes
INSERT INTO trade_tags (user_id, category_id, name, is_preset) VALUES
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'mistake'), 'FOMO', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'mistake'), 'Oversize', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'mistake'), 'Early Exit', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'mistake'), 'Late Entry', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'mistake'), 'Revenge Trade', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'mistake'), 'No Stop Loss', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'mistake'), 'Chasing', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'mistake'), 'Held Too Long', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'mistake'), 'Ignored Signal', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'mistake'), 'Poor Risk/Reward', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'mistake'), 'Overtrade', TRUE)
ON CONFLICT DO NOTHING;

-- Strategies
INSERT INTO trade_tags (user_id, category_id, name, is_preset) VALUES
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'strategy'), 'Day Trade', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'strategy'), 'Swing Trade', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'strategy'), 'Position Trade', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'strategy'), 'Scalping', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'strategy'), 'Mean Reversion', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'strategy'), 'Momentum', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'strategy'), 'Options Selling', TRUE),
    (NULL, (SELECT id FROM trade_tag_categories WHERE name = 'strategy'), 'Earnings', TRUE)
ON CONFLICT DO NOTHING;

-- ─── Junction: trades ↔ tags (for future DB-backed trades) ──────────────────

CREATE TABLE IF NOT EXISTS journal_trade_tags (
    id          SERIAL PRIMARY KEY,
    trade_id    VARCHAR(100) NOT NULL,      -- Trade ID (can be localStorage uid or future DB id)
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    tag_id      INTEGER REFERENCES trade_tags(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (trade_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_trade_tags_trade ON journal_trade_tags (trade_id);
CREATE INDEX IF NOT EXISTS idx_trade_tags_user ON journal_trade_tags (user_id);
CREATE INDEX IF NOT EXISTS idx_trade_tags_tag ON journal_trade_tags (tag_id);

-- ═════════════════════════════════════════════════════════════════════════════
