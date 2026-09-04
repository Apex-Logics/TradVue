-- ================================================================
-- Migration 020: Webhook auth-fail events (Q5 / Review B5)
--
-- Invalid / inactive webhook tokens previously returned (or 200-acked) without
-- inserting a webhook_events row, so the Events log looked empty. Auth-fail
-- rows need:
--   * nullable token_id  — unknown tokens have no FK parent
--   * nullable user_id   — unknown tokens cannot be attributed to a user
--   * status 'auth_fail' — distinct from parse/match 'error'
--
-- Also admits 'test' (already written by POST /api/webhooks/test).
--
-- ── Safety ──────────────────────────────────────────────────────────────────
-- Additive / relaxing only: DROP NOT NULL and a wider CHECK. No backfill.
-- Existing rows keep their token_id / user_id / status.
--
-- STAGING FIRST. Do not apply from this PR. Live apply is an
-- Axle / Erick gate after Nova review.
-- ================================================================

ALTER TABLE webhook_events
    ALTER COLUMN token_id DROP NOT NULL;

ALTER TABLE webhook_events
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE webhook_events DROP CONSTRAINT IF EXISTS webhook_events_status_check;
ALTER TABLE webhook_events ADD CONSTRAINT webhook_events_status_check
    CHECK (status IN ('received', 'matched', 'error', 'ignored', 'test', 'auth_fail'));

COMMENT ON COLUMN webhook_events.token_id IS
    'Owning webhook_tokens.id. NULL when the presented token did not match any row (auth_fail).';

COMMENT ON COLUMN webhook_events.user_id IS
    'Owning user. NULL when the presented token did not match any row (auth_fail).';

-- =============================================================================
