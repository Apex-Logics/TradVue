-- ================================================================
-- Migration 019: Webhook Event Idempotency (P0 2026-09 #3)
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
--
-- ── REQUIRED production deploy order (NOT flexible) ─────────────────────────
--   1. Migrate FIRST: add the order_id column.
--   2. In production, build the partial unique index with
--      CREATE UNIQUE INDEX CONCURRENTLY OUTSIDE a transaction.
--   3. Only after both schema steps succeed, deploy the application code.
--   The receiver always writes order_id on every event insert. Deploying the
--   new code before migration makes webhook ingest fail.
--
-- For transactional migration runners / fresh installs, the plain index form
-- below may be used. In production use the commented CONCURRENTLY form instead.
--
-- Rollback: see database/rollbacks/019_webhook_event_idempotency_rollback.sql.
--   That rollback is outside database/migrations/ and is applied only manually.
--   Roll the application code back before dropping the column, or ingest fails.
-- ================================================================

ALTER TABLE webhook_events
    ADD COLUMN IF NOT EXISTS order_id VARCHAR(100);

COMMENT ON COLUMN webhook_events.order_id IS
    'External per-fill order id used for retry idempotency. NULL when the payload has no id or only a non-unique placeholder (e.g. "Long"/"Short").';

-- Transactional / fresh-install form:
CREATE UNIQUE INDEX IF NOT EXISTS uniq_webhook_events_user_order
    ON webhook_events (user_id, order_id)
    WHERE order_id IS NOT NULL;

-- REQUIRED production form (run OUTSIDE a transaction instead of the above):
--   CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_webhook_events_user_order
--       ON webhook_events (user_id, order_id)
--       WHERE order_id IS NOT NULL;

-- =============================================================================
