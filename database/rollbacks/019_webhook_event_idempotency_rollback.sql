-- ================================================================
-- Rollback for Migration 019: Webhook Event Idempotency (P0 2026-09 #3)
--
-- Kept OUTSIDE database/migrations/ on purpose: a `*.sql` migration runner must
-- not pick this up and undo the forward migration immediately after applying it.
-- Apply this file manually/explicitly when you intend to roll back.
--
-- Non-destructive to data: removes only the retry-dedup metadata (index +
-- column); existing webhook events and trades are untouched.
--
-- IMPORTANT — order matters, and NOT just for the two statements below:
--   The running receiver code ALWAYS writes order_id on every event insert, so
--   it depends on the column existing. Roll the application CODE back FIRST (or
--   atomically with this rollback); otherwise, once the column is dropped,
--   webhook ingest will fail on every event insert.
--   Within this file, drop the index before the column it depends on.
-- ================================================================

DROP INDEX IF EXISTS uniq_webhook_events_user_order;

ALTER TABLE webhook_events
    DROP COLUMN IF EXISTS order_id;

-- =============================================================================
