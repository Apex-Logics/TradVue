-- Migration 006: Add is_active column to price_alerts
-- Enhances the existing price_alerts table with an is_active flag
-- (complements the existing 'triggered' boolean)

ALTER TABLE price_alerts
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill: triggered alerts should be inactive
UPDATE price_alerts SET is_active = FALSE WHERE triggered = TRUE;

-- Index for active alert lookups (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_price_alerts_active
  ON price_alerts (is_active) WHERE is_active = TRUE;

COMMENT ON COLUMN price_alerts.is_active IS 'Whether the alert is active and should be checked. Set to FALSE when triggered or manually disabled.';
