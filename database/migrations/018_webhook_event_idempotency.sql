-- ================================================================
-- Migration 018: Webhook Event Idempotency (P0 2026-09 #3)
--
-- Webhook deliveries are retried by TradingView / NinjaTrader on timeout and
-- may be replayed by proxies. Persisting the external order id and enforcing a
-- (user_id, order_id) uniqueness constraint makes re-processing a genuine
-- retry a no-op instead of creating a duplicate event + trade.
--
-- Placeholder order ids (TradingView strategy alerts emit the direction word
-- "Long"/"Short", etc.) are stored as NULL by the application, so the PARTIAL
-- unique index below intentionally ignores them.
--
-- ── Safety ──────────────────────────────────────────────────────────────────
-- Forward:
--   * ADD COLUMN ... IF NOT EXISTS is nullable with no default → no table
--     rewrite, no backfill; existing rows get order_id = NULL.
--   * The unique index is PARTIAL (WHERE order_id IS NOT NULL); every existing
--     row has order_id = NULL, so it cannot conflict with historical data.
--   * In prod, run the index build with CREATE UNIQUE INDEX CONCURRENTLY
--     (shown below, commented) to avoid holding a write lock. The plain form
--     here is for transactional migration runners / fresh installs.
-- Rollback: see 018_webhook_event_idempotency_rollback.sql — dropping the index
--   and column is instant and non-destructive (only the retry-dedup metadata is
--   lost; trades and events are untouched).
-- ================================================================

ALTER TABLE webhook_events
    ADD COLUMN IF NOT EXISTS order_id VARCHAR(100);

COMMENT ON COLUMN webhook_events.order_id IS
    'External per-fill order id used for retry idempotency. NULL when the payload has no id or only a non-unique placeholder (e.g. "Long"/"Short").';

-- Transactional / fresh-install form:
CREATE UNIQUE INDEX IF NOT EXISTS uniq_webhook_events_user_order
    ON webhook_events (user_id, order_id)
    WHERE order_id IS NOT NULL;

-- Zero-downtime prod form (run OUTSIDE a transaction instead of the above):
--   CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_webhook_events_user_order
--       ON webhook_events (user_id, order_id)
--       WHERE order_id IS NOT NULL;

-- =============================================================================
