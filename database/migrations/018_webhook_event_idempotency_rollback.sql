-- ================================================================
-- Rollback for Migration 018: Webhook Event Idempotency (P0 2026-09 #3)
--
-- Non-destructive: removes only the retry-dedup metadata. Existing webhook
-- events and trades are untouched. After rollback the receiver falls back to
-- its previous (non-idempotent) behavior — safe, because the application code
-- treats a missing order_id column defensively.
--
-- Order matters: drop the index before the column it depends on.
-- ================================================================

DROP INDEX IF EXISTS uniq_webhook_events_user_order;

ALTER TABLE webhook_events
    DROP COLUMN IF EXISTS order_id;

-- =============================================================================
