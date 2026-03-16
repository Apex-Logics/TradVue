// ─── Rule Cop Engine ──────────────────────────────────────────────────────────
// Pure, math-based rule checking. No LLM. No network calls.
// Each checker is a pure function: (rule, trades) => RuleViolation | null

import { TradingRule, RuleViolation } from './ruleCopData'

// ─── Minimal Trade shape we depend on ────────────────────────────────────────

export interface RuleTrade {
  id: string
  date: string         // YYYY-MM-DD
  time: string         // HH:MM or HH:MM:SS
  pnl: number
  positionSize: number // dollar value of position
  entryPrice: number
  stopLoss: number
  takeProfit: number
  direction: string    // 'Long' | 'Short'
}

// ─── ID generation (deterministic per rule+date+context) ─────────────────────

function makeViolationId(ruleId: string, context: string): string {
  return `${ruleId}-${context}-${Date.now()}`
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Individual Rule Checkers ─────────────────────────────────────────────────

/**
 * Max Trades Per Day
 * Checks today's trade count against threshold.
 */
export function checkMaxTradesPerDay(
  rule: TradingRule,
  trades: RuleTrade[],
): RuleViolation | null {
  const today = todayStr()
  const todayTrades = trades.filter(t => t.date === today)
  const limit = Number(rule.value)

  if (todayTrades.length > limit) {
    return {
      id: makeViolationId(rule.id, `${today}-${todayTrades.length}`),
      ruleId: rule.id,
      ruleName: rule.name,
      date: today,
      details: `Rule triggered: You set a limit of ${limit} trades/day. Today: ${todayTrades.length} trades.`,
      severity: 'violation',
      acknowledged: false,
      createdAt: new Date().toISOString(),
    }
  }

  // Warning at 80% of limit
  if (limit >= 5 && todayTrades.length >= Math.floor(limit * 0.8) && todayTrades.length < limit) {
    return {
      id: makeViolationId(rule.id, `warn-${today}-${todayTrades.length}`),
      ruleId: rule.id,
      ruleName: rule.name,
      date: today,
      details: `Threshold approaching: You set a limit of ${limit} trades/day. Today: ${todayTrades.length} trades.`,
      severity: 'warning',
      acknowledged: false,
      createdAt: new Date().toISOString(),
    }
  }

  return null
}

/**
 * Max Daily Loss
 * Checks if today's cumulative P&L loss exceeds threshold.
 */
export function checkMaxDailyLoss(
  rule: TradingRule,
  trades: RuleTrade[],
): RuleViolation | null {
  const today = todayStr()
  const todayPnl = trades
    .filter(t => t.date === today)
    .reduce((sum, t) => sum + t.pnl, 0)

  const limit = Number(rule.value) // positive dollar amount
  const loss = -todayPnl // positive when losing

  if (loss >= limit) {
    return {
      id: makeViolationId(rule.id, `${today}-${loss.toFixed(0)}`),
      ruleId: rule.id,
      ruleName: rule.name,
      date: today,
      details: `Threshold exceeded: You set a max daily loss of $${limit}. Today's loss: $${loss.toFixed(2)}.`,
      severity: 'violation',
      acknowledged: false,
      createdAt: new Date().toISOString(),
    }
  }

  return null
}

/**
 * Max Loss Per Trade
 * Checks if any individual trade loss exceeds threshold.
 */
export function checkMaxLossPerTrade(
  rule: TradingRule,
  trades: RuleTrade[],
): RuleViolation | null {
  const today = todayStr()
  const limit = Number(rule.value)

  for (const trade of trades) {
    if (trade.date !== today) continue
    const loss = -trade.pnl
    if (loss >= limit) {
      return {
        id: makeViolationId(rule.id, `${trade.id}-${loss.toFixed(0)}`),
        ruleId: rule.id,
        ruleName: rule.name,
        tradeId: trade.id,
        date: today,
        details: `Threshold exceeded: You set a max loss of $${limit} per trade. Trade loss: $${loss.toFixed(2)}.`,
        severity: 'violation',
        acknowledged: false,
        createdAt: new Date().toISOString(),
      }
    }
  }

  return null
}

/**
 * Max Position Size
 * Checks if any trade's position size exceeds threshold.
 */
export function checkMaxPositionSize(
  rule: TradingRule,
  trades: RuleTrade[],
): RuleViolation | null {
  const today = todayStr()
  const limit = Number(rule.value)

  for (const trade of trades) {
    if (trade.date !== today) continue
    if (trade.positionSize > limit) {
      return {
        id: makeViolationId(rule.id, `${trade.id}-${trade.positionSize.toFixed(0)}`),
        ruleId: rule.id,
        ruleName: rule.name,
        tradeId: trade.id,
        date: today,
        details: `Threshold exceeded: You set a max position size of $${limit}. Trade size: $${trade.positionSize.toFixed(2)}.`,
        severity: 'violation',
        acknowledged: false,
        createdAt: new Date().toISOString(),
      }
    }
  }

  return null
}

/**
 * Max Consecutive Losses
 * Checks the most recent streak of losses across all trades (not just today).
 */
export function checkMaxConsecutiveLosses(
  rule: TradingRule,
  trades: RuleTrade[],
): RuleViolation | null {
  if (trades.length === 0) return null

  const limit = Number(rule.value)

  // Sort by date+time ascending
  const sorted = [...trades].sort((a, b) => {
    const da = `${a.date}T${a.time}`
    const db = `${b.date}T${b.time}`
    return da < db ? -1 : da > db ? 1 : 0
  })

  let streak = 0
  let maxStreak = 0

  for (const trade of sorted) {
    if (trade.pnl < 0) {
      streak++
      maxStreak = Math.max(maxStreak, streak)
    } else {
      streak = 0
    }
  }

  if (maxStreak > limit) {
    const today = todayStr()
    return {
      id: makeViolationId(rule.id, `${today}-streak-${maxStreak}`),
      ruleId: rule.id,
      ruleName: rule.name,
      date: today,
      details: `Pattern detected: You set a limit of ${limit} consecutive losses. Current streak: ${maxStreak} losses in a row.`,
      severity: 'violation',
      acknowledged: false,
      createdAt: new Date().toISOString(),
    }
  }

  return null
}

/**
 * No Trading After Time
 * Checks if any of today's trades were entered after the cutoff time.
 * rule.value = 'HH:MM' in ET (e.g., '15:00')
 */
export function checkNoTradingAfterTime(
  rule: TradingRule,
  trades: RuleTrade[],
): RuleViolation | null {
  const today = todayStr()
  const cutoff = String(rule.value) // e.g., '15:00'

  for (const trade of trades) {
    if (trade.date !== today) continue
    // Compare time strings directly (HH:MM format)
    const tradeTime = trade.time.slice(0, 5) // normalize to HH:MM
    if (tradeTime > cutoff) {
      return {
        id: makeViolationId(rule.id, `${trade.id}-${tradeTime}`),
        ruleId: rule.id,
        ruleName: rule.name,
        tradeId: trade.id,
        date: today,
        details: `Rule triggered: You set a cutoff of ${cutoff} ET. Trade entered at ${tradeTime}.`,
        severity: 'violation',
        acknowledged: false,
        createdAt: new Date().toISOString(),
      }
    }
  }

  return null
}

/**
 * Minimum Risk/Reward
 * Flags trades where realized or planned R:R is below threshold.
 * Computes R:R from entry, stopLoss, takeProfit if available.
 */
export function checkMinRiskReward(
  rule: TradingRule,
  trades: RuleTrade[],
): RuleViolation | null {
  const today = todayStr()
  const minRR = Number(rule.value)

  for (const trade of trades) {
    if (trade.date !== today) continue

    // Only check if stop loss and take profit are set
    if (!trade.stopLoss || !trade.takeProfit || trade.stopLoss === 0 || trade.takeProfit === 0) continue

    const entry = trade.entryPrice
    let risk: number
    let reward: number

    if (trade.direction === 'Long') {
      risk = entry - trade.stopLoss
      reward = trade.takeProfit - entry
    } else {
      risk = trade.stopLoss - entry
      reward = entry - trade.takeProfit
    }

    if (risk <= 0) continue // can't compute R:R

    const rr = reward / risk

    if (rr < minRR) {
      return {
        id: makeViolationId(rule.id, `${trade.id}-rr-${rr.toFixed(2)}`),
        ruleId: rule.id,
        ruleName: rule.name,
        tradeId: trade.id,
        date: today,
        details: `Threshold exceeded: You set a minimum R:R of ${minRR}:1. Trade R:R: ${rr.toFixed(2)}:1.`,
        severity: 'warning',
        acknowledged: false,
        createdAt: new Date().toISOString(),
      }
    }
  }

  return null
}

/**
 * No Revenge Trading
 * Flags trades entered within X minutes of a losing trade with equal/larger size.
 * rule.value = minutes (default 15)
 */
export function checkNoRevengeTrading(
  rule: TradingRule,
  trades: RuleTrade[],
): RuleViolation | null {
  const today = todayStr()
  const windowMinutes = Number(rule.value)

  const todayTrades = trades
    .filter(t => t.date === today)
    .sort((a, b) => {
      const ta = `${a.date}T${a.time}`
      const tb = `${b.date}T${b.time}`
      return ta < tb ? -1 : ta > tb ? 1 : 0
    })

  for (let i = 1; i < todayTrades.length; i++) {
    const prev = todayTrades[i - 1]
    const curr = todayTrades[i]

    if (prev.pnl >= 0) continue // previous trade wasn't a loss

    // Parse times
    const prevMs = parseTimeToMs(prev.time)
    const currMs = parseTimeToMs(curr.time)
    const diffMinutes = (currMs - prevMs) / (1000 * 60)

    if (diffMinutes < 0) continue // time went backward (shouldn't happen)

    if (diffMinutes <= windowMinutes && curr.positionSize >= prev.positionSize) {
      return {
        id: makeViolationId(rule.id, `${curr.id}-revenge`),
        ruleId: rule.id,
        ruleName: rule.name,
        tradeId: curr.id,
        date: today,
        details: `Pattern detected: Trade entered ${diffMinutes.toFixed(1)} minutes after a loss with equal/larger size (within your ${windowMinutes}-minute window). Possible revenge trade.`,
        severity: 'violation',
        acknowledged: false,
        createdAt: new Date().toISOString(),
      }
    }
  }

  return null
}

function parseTimeToMs(time: string): number {
  const parts = time.split(':').map(Number)
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  const s = parts[2] ?? 0
  return ((h * 60 + m) * 60 + s) * 1000
}

// ─── Main Engine ──────────────────────────────────────────────────────────────

/**
 * Runs all enabled rules against trade data.
 * Returns a flat list of violations found.
 */
export function checkAllRules(
  rules: TradingRule[],
  trades: RuleTrade[],
): RuleViolation[] {
  const violations: RuleViolation[] = []

  for (const rule of rules) {
    if (!rule.enabled) continue

    let result: RuleViolation | null = null

    switch (rule.type) {
      case 'max_trades_per_day':
        result = checkMaxTradesPerDay(rule, trades)
        break
      case 'max_loss_per_day':
        result = checkMaxDailyLoss(rule, trades)
        break
      case 'max_loss_per_trade':
        result = checkMaxLossPerTrade(rule, trades)
        break
      case 'max_position_size':
        result = checkMaxPositionSize(rule, trades)
        break
      case 'max_consecutive_losses':
        result = checkMaxConsecutiveLosses(rule, trades)
        break
      case 'no_trading_after_time':
        result = checkNoTradingAfterTime(rule, trades)
        break
      case 'min_risk_reward':
        result = checkMinRiskReward(rule, trades)
        break
      case 'no_revenge_trading':
        result = checkNoRevengeTrading(rule, trades)
        break
      case 'max_daily_profit':
        // Future: notify when taking too much profit (greed control)
        break
      case 'custom':
        // Custom rules require manual check — skip automated evaluation
        break
    }

    if (result) violations.push(result)
  }

  return violations
}

/**
 * Load trades from localStorage (cg_journal_trades) and run all rules.
 */
export function checkRulesFromStorage(rules: TradingRule[]): RuleViolation[] {
  try {
    if (typeof window === 'undefined') return []
    const raw = localStorage.getItem('cg_journal_trades')
    if (!raw) return []
    const trades: RuleTrade[] = JSON.parse(raw)
    return checkAllRules(rules, trades)
  } catch {
    return []
  }
}

/**
 * For a given rule, count how many violations exist in the violations array.
 */
export function countViolationsForRule(
  ruleId: string,
  violations: RuleViolation[],
): number {
  return violations.filter(v => v.ruleId === ruleId).length
}

/**
 * Returns today's rule status summary: { followed, total }
 */
export function getTodaySummary(
  rules: TradingRule[],
  violations: RuleViolation[],
): { followed: number; total: number } {
  const today = todayStr()
  const enabledRules = rules.filter(r => r.enabled)
  const todayViolatedRuleIds = new Set(
    violations
      .filter(v => v.date === today && !v.acknowledged && v.severity === 'violation')
      .map(v => v.ruleId),
  )
  const followed = enabledRules.filter(r => !todayViolatedRuleIds.has(r.id)).length
  return { followed, total: enabledRules.length }
}

/**
 * Returns 'following' | 'warning' | 'violated' for a single rule today.
 */
export function getRuleStatusToday(
  ruleId: string,
  violations: RuleViolation[],
): 'following' | 'warning' | 'violated' {
  const today = todayStr()
  const todayViolations = violations.filter(v => v.ruleId === ruleId && v.date === today && !v.acknowledged)

  if (todayViolations.some(v => v.severity === 'violation')) return 'violated'
  if (todayViolations.some(v => v.severity === 'warning')) return 'warning'
  return 'following'
}
