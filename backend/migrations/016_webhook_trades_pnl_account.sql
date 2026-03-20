-- Migration 016: Add pnl and account_id columns to webhook_trades
-- pnl: stores actual dollar P&L (NinjaTrader provides this with futures multiplier applied)
-- account_id: nullable, for future multi-account support

ALTER TABLE webhook_trades ADD COLUMN IF NOT EXISTS pnl numeric(12,2);
ALTER TABLE webhook_trades ADD COLUMN IF NOT EXISTS account_id varchar(50);

COMMENT ON COLUMN webhook_trades.pnl IS 'Realized P&L in dollars. For NinjaTrader, the addon applies the futures point value multiplier before sending. For TradingView, this is calculated as (exit_price - entry_price) * quantity * direction_factor.';
COMMENT ON COLUMN webhook_trades.account_id IS 'Broker account ID. Nullable for backwards compatibility. NinjaTrader addon may send this in account or account_id field.';
