// ─── Rule Cop Default Templates ───────────────────────────────────────────────
// Pre-built rules with sensible defaults. Users can enable/disable and adjust.

import { TradingRule } from './ruleCopData'

export const DEFAULT_RULES: TradingRule[] = [
  {
    id: 'default-max-trades-per-day',
    name: 'Max Trades Per Day',
    type: 'max_trades_per_day',
    enabled: true,
    value: 5,
    description: 'You set a limit of {value} trades per day. Flags when exceeded.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'default-max-loss-per-day',
    name: 'Max Daily Loss',
    type: 'max_loss_per_day',
    enabled: true,
    value: 500,
    description: 'You set a max daily loss of ${value}. Flags when cumulative P&L exceeds this limit.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'default-max-loss-per-trade',
    name: 'Max Loss Per Trade',
    type: 'max_loss_per_trade',
    enabled: true,
    value: 200,
    description: 'You set a max loss of ${value} per trade. Flags individual trades exceeding this limit.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'default-max-position-size',
    name: 'Max Position Size',
    type: 'max_position_size',
    enabled: true,
    value: 10000,
    description: 'You set a max position size of ${value}. Flags oversized positions.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'default-max-consecutive-losses',
    name: 'Max Consecutive Losses',
    type: 'max_consecutive_losses',
    enabled: true,
    value: 3,
    description: 'You set a limit of {value} consecutive losses. Flags after hitting this streak.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'default-no-trading-after-time',
    name: 'No Trading After Time',
    type: 'no_trading_after_time',
    enabled: true,
    value: '15:00',
    description: 'You set a cutoff of {value} ET. Flags trades entered after this time.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'default-min-risk-reward',
    name: 'Minimum Risk/Reward',
    type: 'min_risk_reward',
    enabled: false,
    value: 1.5,
    description: 'You set a minimum R:R of {value}:1. Flags trades with worse ratio.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'default-no-revenge-trading',
    name: 'No Revenge Trading',
    type: 'no_revenge_trading',
    enabled: true,
    value: 15,
    description: 'Flags trades entered within {value} minutes of a loss with equal or larger size.',
    createdAt: new Date().toISOString(),
  },
]

/**
 * Returns a deep copy of the default rules with fresh timestamps.
 */
export function getDefaultRules(): TradingRule[] {
  const now = new Date().toISOString()
  return DEFAULT_RULES.map(r => ({ ...r, createdAt: now }))
}

/**
 * Human-readable description for a rule, interpolating threshold value.
 */
export function formatRuleDescription(rule: TradingRule): string {
  return rule.description
    .replace(/\{value\}/g, String(rule.value))
    .replace(/\$\{value\}/g, `$${rule.value}`)
}

/**
 * Human-readable label for rule type.
 */
export function getRuleTypeLabel(type: TradingRule['type']): string {
  const labels: Record<TradingRule['type'], string> = {
    max_trades_per_day: 'Max Trades / Day',
    max_loss_per_day: 'Max Daily Loss',
    max_loss_per_trade: 'Max Loss / Trade',
    max_position_size: 'Max Position Size',
    max_consecutive_losses: 'Max Consecutive Losses',
    no_trading_after_time: 'No Trading After Time',
    min_risk_reward: 'Min Risk/Reward',
    max_daily_profit: 'Max Daily Profit',
    no_revenge_trading: 'No Revenge Trading',
    custom: 'Custom Rule',
  }
  return labels[type] ?? 'Custom Rule'
}
