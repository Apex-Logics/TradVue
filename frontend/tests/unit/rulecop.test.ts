/**
 * Unit Tests: Rule Cop Engine
 * Tests all rule checkers with known inputs and edge cases.
 */

import {
  checkMaxTradesPerDay,
  checkMaxDailyLoss,
  checkMaxLossPerTrade,
  checkMaxPositionSize,
  checkMaxConsecutiveLosses,
  checkNoTradingAfterTime,
  checkMinRiskReward,
  checkNoRevengeTrading,
  checkAllRules,
  getTodaySummary,
  getRuleStatusToday,
  type RuleTrade,
} from '../../app/utils/ruleCopEngine'

import { TradingRule, RuleViolation } from '../../app/utils/ruleCopData'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10)

function makeRule(overrides: Partial<TradingRule> = {}): TradingRule {
  return {
    id: 'test-rule-1',
    name: 'Test Rule',
    type: 'max_trades_per_day',
    enabled: true,
    value: 5,
    description: 'Test description',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeTrade(overrides: Partial<RuleTrade> = {}): RuleTrade {
  return {
    id: `trade-${Math.random().toString(36).slice(2)}`,
    date: TODAY,
    time: '10:00',
    pnl: 100,
    positionSize: 5000,
    entryPrice: 100,
    stopLoss: 95,
    takeProfit: 110,
    direction: 'Long',
    ...overrides,
  }
}

// ─── Max Trades Per Day ────────────────────────────────────────────────────────

describe('checkMaxTradesPerDay', () => {
  it('returns null when trade count equals limit', () => {
    const rule = makeRule({ type: 'max_trades_per_day', value: 5 })
    const trades = Array.from({ length: 5 }, () => makeTrade())
    const result = checkMaxTradesPerDay(rule, trades)
    expect(result).toBeNull()
  })

  it('returns violation when trade count exceeds limit (6 trades, limit 5)', () => {
    const rule = makeRule({ type: 'max_trades_per_day', value: 5 })
    const trades = Array.from({ length: 6 }, () => makeTrade())
    const result = checkMaxTradesPerDay(rule, trades)
    expect(result).not.toBeNull()
    expect(result?.severity).toBe('violation')
    expect(result?.details).toContain('6 trades')
    expect(result?.details).toContain('limit of 5')
  })

  it('returns null when 0 trades and limit is 5', () => {
    const rule = makeRule({ type: 'max_trades_per_day', value: 5 })
    const result = checkMaxTradesPerDay(rule, [])
    expect(result).toBeNull()
  })

  it('does not count trades from other days', () => {
    const rule = makeRule({ type: 'max_trades_per_day', value: 3 })
    const trades = [
      makeTrade({ date: '2020-01-01' }),
      makeTrade({ date: '2020-01-01' }),
      makeTrade({ date: '2020-01-01' }),
      makeTrade({ date: '2020-01-01' }),
    ]
    const result = checkMaxTradesPerDay(rule, trades)
    expect(result).toBeNull()
  })
})

// ─── Max Daily Loss ────────────────────────────────────────────────────────────

describe('checkMaxDailyLoss', () => {
  it('returns violation when daily loss exceeds $500 limit', () => {
    const rule = makeRule({ type: 'max_loss_per_day', value: 500 })
    const trades = [
      makeTrade({ pnl: -600 }),
    ]
    const result = checkMaxDailyLoss(rule, trades)
    expect(result).not.toBeNull()
    expect(result?.severity).toBe('violation')
    expect(result?.details).toContain('$500')
    expect(result?.details).toContain('600')
  })

  it('returns violation when cumulative loss across multiple trades exceeds limit', () => {
    const rule = makeRule({ type: 'max_loss_per_day', value: 500 })
    const trades = [
      makeTrade({ pnl: -300 }),
      makeTrade({ pnl: -250 }),
    ]
    const result = checkMaxDailyLoss(rule, trades)
    expect(result).not.toBeNull()
    expect(result?.severity).toBe('violation')
  })

  it('returns null when daily loss is under limit', () => {
    const rule = makeRule({ type: 'max_loss_per_day', value: 500 })
    const trades = [makeTrade({ pnl: -300 })]
    const result = checkMaxDailyLoss(rule, trades)
    expect(result).toBeNull()
  })

  it('returns null when 0 trades', () => {
    const rule = makeRule({ type: 'max_loss_per_day', value: 500 })
    const result = checkMaxDailyLoss(rule, [])
    expect(result).toBeNull()
  })

  it('returns null when all trades are profitable', () => {
    const rule = makeRule({ type: 'max_loss_per_day', value: 500 })
    const trades = [makeTrade({ pnl: 300 }), makeTrade({ pnl: 200 })]
    const result = checkMaxDailyLoss(rule, trades)
    expect(result).toBeNull()
  })
})

// ─── Max Loss Per Trade ────────────────────────────────────────────────────────

describe('checkMaxLossPerTrade', () => {
  it('returns violation when single trade exceeds loss limit', () => {
    const rule = makeRule({ type: 'max_loss_per_trade', value: 200 })
    const trades = [makeTrade({ pnl: -300 })]
    const result = checkMaxLossPerTrade(rule, trades)
    expect(result).not.toBeNull()
    expect(result?.severity).toBe('violation')
    expect(result?.details).toContain('$200')
    expect(result?.details).toContain('300')
  })

  it('returns null when trade loss is under limit', () => {
    const rule = makeRule({ type: 'max_loss_per_trade', value: 200 })
    const trades = [makeTrade({ pnl: -150 })]
    const result = checkMaxLossPerTrade(rule, trades)
    expect(result).toBeNull()
  })

  it('returns null for profitable trades', () => {
    const rule = makeRule({ type: 'max_loss_per_trade', value: 200 })
    const trades = [makeTrade({ pnl: 500 })]
    const result = checkMaxLossPerTrade(rule, trades)
    expect(result).toBeNull()
  })
})

// ─── Max Consecutive Losses ───────────────────────────────────────────────────

describe('checkMaxConsecutiveLosses', () => {
  it('returns violation when 4 consecutive losses exceed limit of 3', () => {
    const rule = makeRule({ type: 'max_consecutive_losses', value: 3 })
    const trades = [
      makeTrade({ pnl: -100, time: '09:30' }),
      makeTrade({ pnl: -100, time: '10:00' }),
      makeTrade({ pnl: -100, time: '10:30' }),
      makeTrade({ pnl: -100, time: '11:00' }),
    ]
    const result = checkMaxConsecutiveLosses(rule, trades)
    expect(result).not.toBeNull()
    expect(result?.severity).toBe('violation')
    expect(result?.details).toContain('4 losses in a row')
  })

  it('returns null when losses are 3 (equals limit)', () => {
    const rule = makeRule({ type: 'max_consecutive_losses', value: 3 })
    const trades = [
      makeTrade({ pnl: -100, time: '09:30' }),
      makeTrade({ pnl: -100, time: '10:00' }),
      makeTrade({ pnl: -100, time: '10:30' }),
    ]
    const result = checkMaxConsecutiveLosses(rule, trades)
    expect(result).toBeNull()
  })

  it('returns null when wins break the loss streak', () => {
    const rule = makeRule({ type: 'max_consecutive_losses', value: 3 })
    const trades = [
      makeTrade({ pnl: -100, time: '09:30' }),
      makeTrade({ pnl: -100, time: '10:00' }),
      makeTrade({ pnl: 200, time: '10:30' }),  // win breaks streak
      makeTrade({ pnl: -100, time: '11:00' }),
      makeTrade({ pnl: -100, time: '11:30' }),
    ]
    const result = checkMaxConsecutiveLosses(rule, trades)
    expect(result).toBeNull()
  })

  it('returns null for 0 trades', () => {
    const rule = makeRule({ type: 'max_consecutive_losses', value: 3 })
    const result = checkMaxConsecutiveLosses(rule, [])
    expect(result).toBeNull()
  })
})

// ─── No Revenge Trading ───────────────────────────────────────────────────────

describe('checkNoRevengeTrading', () => {
  it('returns violation for trade within 15 min of a loss with equal size', () => {
    const rule = makeRule({ type: 'no_revenge_trading', value: 15 })
    const trades = [
      makeTrade({ id: 't1', pnl: -200, time: '10:00', positionSize: 5000 }),
      makeTrade({ id: 't2', pnl: 100,  time: '10:10', positionSize: 5000 }),  // 10 min later, same size
    ]
    const result = checkNoRevengeTrading(rule, trades)
    expect(result).not.toBeNull()
    expect(result?.severity).toBe('violation')
    expect(result?.details).toContain('revenge')
  })

  it('returns violation for trade within window with LARGER size', () => {
    const rule = makeRule({ type: 'no_revenge_trading', value: 15 })
    const trades = [
      makeTrade({ id: 't1', pnl: -200, time: '10:00', positionSize: 5000 }),
      makeTrade({ id: 't2', pnl: 100,  time: '10:05', positionSize: 7000 }), // larger size
    ]
    const result = checkNoRevengeTrading(rule, trades)
    expect(result).not.toBeNull()
  })

  it('returns null when next trade is outside the time window', () => {
    const rule = makeRule({ type: 'no_revenge_trading', value: 15 })
    const trades = [
      makeTrade({ id: 't1', pnl: -200, time: '10:00', positionSize: 5000 }),
      makeTrade({ id: 't2', pnl: 100,  time: '10:20', positionSize: 5000 }), // 20 min later
    ]
    const result = checkNoRevengeTrading(rule, trades)
    expect(result).toBeNull()
  })

  it('returns null when previous trade was a win', () => {
    const rule = makeRule({ type: 'no_revenge_trading', value: 15 })
    const trades = [
      makeTrade({ id: 't1', pnl: 200, time: '10:00', positionSize: 5000 }), // win
      makeTrade({ id: 't2', pnl: 100, time: '10:05', positionSize: 5000 }),
    ]
    const result = checkNoRevengeTrading(rule, trades)
    expect(result).toBeNull()
  })

  it('returns null for 0 trades', () => {
    const rule = makeRule({ type: 'no_revenge_trading', value: 15 })
    const result = checkNoRevengeTrading(rule, [])
    expect(result).toBeNull()
  })
})

// ─── No Trading After Time ─────────────────────────────────────────────────────

describe('checkNoTradingAfterTime', () => {
  it('returns violation when trade entered after cutoff', () => {
    const rule = makeRule({ type: 'no_trading_after_time', value: '15:00' })
    const trades = [makeTrade({ time: '15:30' })]
    const result = checkNoTradingAfterTime(rule, trades)
    expect(result).not.toBeNull()
    expect(result?.severity).toBe('violation')
    expect(result?.details).toContain('15:30')
  })

  it('returns null when all trades are before cutoff', () => {
    const rule = makeRule({ type: 'no_trading_after_time', value: '15:00' })
    const trades = [makeTrade({ time: '14:30' })]
    const result = checkNoTradingAfterTime(rule, trades)
    expect(result).toBeNull()
  })

  it('returns null for trades exactly at cutoff', () => {
    const rule = makeRule({ type: 'no_trading_after_time', value: '15:00' })
    const trades = [makeTrade({ time: '15:00' })]
    const result = checkNoTradingAfterTime(rule, trades)
    expect(result).toBeNull()
  })
})

// ─── Max Position Size ─────────────────────────────────────────────────────────

describe('checkMaxPositionSize', () => {
  it('returns violation for oversized position', () => {
    const rule = makeRule({ type: 'max_position_size', value: 10000 })
    const trades = [makeTrade({ positionSize: 15000 })]
    const result = checkMaxPositionSize(rule, trades)
    expect(result).not.toBeNull()
    expect(result?.severity).toBe('violation')
    expect(result?.details).toContain('$10000')
  })

  it('returns null when position is within limit', () => {
    const rule = makeRule({ type: 'max_position_size', value: 10000 })
    const trades = [makeTrade({ positionSize: 8000 })]
    const result = checkMaxPositionSize(rule, trades)
    expect(result).toBeNull()
  })
})

// ─── checkAllRules ─────────────────────────────────────────────────────────────

describe('checkAllRules', () => {
  it('returns empty array when no rules are enabled', () => {
    const rules: TradingRule[] = [
      makeRule({ enabled: false }),
      makeRule({ id: 'rule-2', enabled: false, type: 'max_loss_per_day', value: 500 }),
    ]
    const trades = Array.from({ length: 10 }, () => makeTrade({ pnl: -600 }))
    const result = checkAllRules(rules, trades)
    expect(result).toHaveLength(0)
  })

  it('returns empty array when 0 trades', () => {
    const rules: TradingRule[] = [
      makeRule({ type: 'max_trades_per_day', value: 5, enabled: true }),
      makeRule({ id: 'rule-2', type: 'max_loss_per_day', value: 500, enabled: true }),
    ]
    const result = checkAllRules(rules, [])
    expect(result).toHaveLength(0)
  })

  it('returns violations from multiple rules', () => {
    const rules: TradingRule[] = [
      makeRule({ id: 'rule-1', type: 'max_trades_per_day', value: 3, enabled: true }),
      makeRule({ id: 'rule-2', type: 'max_loss_per_day', value: 100, enabled: true }),
    ]
    const trades = [
      makeTrade({ pnl: -200, time: '09:30' }),
      makeTrade({ pnl: -200, time: '10:00' }),
      makeTrade({ pnl: -200, time: '10:30' }),
      makeTrade({ pnl: -200, time: '11:00' }),
    ]
    const result = checkAllRules(rules, trades)
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('all rules passing returns empty array', () => {
    const rules: TradingRule[] = [
      makeRule({ id: 'rule-1', type: 'max_trades_per_day', value: 10, enabled: true }),
      makeRule({ id: 'rule-2', type: 'max_loss_per_day', value: 10000, enabled: true }),
    ]
    const trades = [
      makeTrade({ pnl: 100, time: '09:30' }),
      makeTrade({ pnl: 200, time: '10:00' }),
    ]
    const result = checkAllRules(rules, trades)
    expect(result).toHaveLength(0)
  })
})

// ─── Summary Helpers ───────────────────────────────────────────────────────────

describe('getTodaySummary', () => {
  it('returns followed === total when no violations', () => {
    const rules = [makeRule({ id: 'r1' }), makeRule({ id: 'r2' })]
    const result = getTodaySummary(rules, [])
    expect(result.followed).toBe(2)
    expect(result.total).toBe(2)
  })

  it('returns 0 total when no rules', () => {
    const result = getTodaySummary([], [])
    expect(result.total).toBe(0)
    expect(result.followed).toBe(0)
  })
})

describe('getRuleStatusToday', () => {
  it('returns "following" when no violations', () => {
    const status = getRuleStatusToday('rule-1', [])
    expect(status).toBe('following')
  })

  it('returns "violated" when violation exists today', () => {
    const v: RuleViolation = {
      id: 'v1', ruleId: 'rule-1', ruleName: 'Test',
      date: TODAY, details: 'test', severity: 'violation',
      acknowledged: false, createdAt: new Date().toISOString(),
    }
    const status = getRuleStatusToday('rule-1', [v])
    expect(status).toBe('violated')
  })

  it('returns "following" when violation is acknowledged', () => {
    const v: RuleViolation = {
      id: 'v1', ruleId: 'rule-1', ruleName: 'Test',
      date: TODAY, details: 'test', severity: 'violation',
      acknowledged: true, createdAt: new Date().toISOString(),
    }
    const status = getRuleStatusToday('rule-1', [v])
    expect(status).toBe('following')
  })
})
