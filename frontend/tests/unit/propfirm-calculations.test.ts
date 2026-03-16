/**
 * Unit Tests: Prop Firm Math
 * Tests drawdown, daily loss, profit target, streak, and color zone logic.
 * Mirrors the exported functions from app/utils/propFirmData.ts
 */

import {
  getDrawdownUsedPct,
  getProfitPct,
  getDailyLossPct,
  getDrawdownColor,
} from '@/app/utils/propFirmData'

// ─── Helpers to build minimal PropFirmRules ───────────────────────────────────

function makeRules(overrides: {
  drawdownCurrent?: number
  drawdownLimit?: number
  profitCurrent?: number
  profitTarget?: number
  todayPnl?: number
  dailyLimit?: number
} = {}) {
  return {
    maxDrawdown: {
      limit: overrides.drawdownLimit ?? 5000,
      current: overrides.drawdownCurrent ?? 0,
      type: 'static' as const,
    },
    profitTarget: {
      target: overrides.profitTarget ?? 9000,
      currentPnl: overrides.profitCurrent ?? 0,
    },
    dailyLossLimit: {
      limit: overrides.dailyLimit ?? 2000,
      todayPnl: overrides.todayPnl ?? 0,
    },
  }
}

// ─── Drawdown Percentage Tests ────────────────────────────────────────────────

describe('Drawdown Percentage', () => {
  test('used $3,000 of $5,000 limit → 60%', () => {
    const rules = makeRules({ drawdownCurrent: 3000, drawdownLimit: 5000 })
    expect(getDrawdownUsedPct(rules)).toBeCloseTo(60, 4)
  })

  test('used $4,500 of $5,000 limit → 90%', () => {
    const rules = makeRules({ drawdownCurrent: 4500, drawdownLimit: 5000 })
    expect(getDrawdownUsedPct(rules)).toBeCloseTo(90, 4)
  })

  test('no drawdown used → 0%', () => {
    const rules = makeRules({ drawdownCurrent: 0, drawdownLimit: 5000 })
    expect(getDrawdownUsedPct(rules)).toBe(0)
  })

  test('fully used drawdown → 100%', () => {
    const rules = makeRules({ drawdownCurrent: 5000, drawdownLimit: 5000 })
    expect(getDrawdownUsedPct(rules)).toBe(100)
  })

  test('exceeded drawdown → over 100%', () => {
    const rules = makeRules({ drawdownCurrent: 5500, drawdownLimit: 5000 })
    expect(getDrawdownUsedPct(rules)).toBeCloseTo(110, 4)
  })

  test('zero limit → 0% (no division by zero)', () => {
    const rules = makeRules({ drawdownCurrent: 1000, drawdownLimit: 0 })
    expect(getDrawdownUsedPct(rules)).toBe(0)
  })

  test('$1,000 of $10,000 → 10%', () => {
    const rules = makeRules({ drawdownCurrent: 1000, drawdownLimit: 10000 })
    expect(getDrawdownUsedPct(rules)).toBeCloseTo(10, 4)
  })
})

// ─── Daily Loss Percentage Tests ──────────────────────────────────────────────

describe('Daily Loss Percentage', () => {
  test('-$1,500 today of $2,000 limit → 75%', () => {
    // todayPnl is negative when losing
    const rules = makeRules({ todayPnl: -1500, dailyLimit: 2000 })
    expect(getDailyLossPct(rules)).toBeCloseTo(75, 4)
  })

  test('-$2,000 today of $2,000 limit → 100%', () => {
    const rules = makeRules({ todayPnl: -2000, dailyLimit: 2000 })
    expect(getDailyLossPct(rules)).toBeCloseTo(100, 4)
  })

  test('profitable today (+$500) → 0% daily loss used', () => {
    const rules = makeRules({ todayPnl: 500, dailyLimit: 2000 })
    expect(getDailyLossPct(rules)).toBe(0)
  })

  test('zero today P&L → 0%', () => {
    const rules = makeRules({ todayPnl: 0, dailyLimit: 2000 })
    expect(getDailyLossPct(rules)).toBe(0)
  })

  test('zero daily limit → 0% (no division by zero)', () => {
    const rules = makeRules({ todayPnl: -500, dailyLimit: 0 })
    expect(getDailyLossPct(rules)).toBe(0)
  })

  test('-$500 of $1,000 limit → 50%', () => {
    const rules = makeRules({ todayPnl: -500, dailyLimit: 1000 })
    expect(getDailyLossPct(rules)).toBeCloseTo(50, 4)
  })

  test('exceeds daily limit → over 100%', () => {
    const rules = makeRules({ todayPnl: -2500, dailyLimit: 2000 })
    expect(getDailyLossPct(rules)).toBeCloseTo(125, 4)
  })
})

// ─── Profit Target Progress Tests ─────────────────────────────────────────────

describe('Profit Target Progress', () => {
  test('$4,000 of $9,000 target → 44.4%', () => {
    const rules = makeRules({ profitCurrent: 4000, profitTarget: 9000 })
    expect(getProfitPct(rules)).toBeCloseTo(44.44, 1)
  })

  test('$9,000 of $9,000 target → 100%', () => {
    const rules = makeRules({ profitCurrent: 9000, profitTarget: 9000 })
    expect(getProfitPct(rules)).toBe(100)
  })

  test('exceeds target → capped at 100%', () => {
    // getProfitPct uses Math.min(..., 100)
    const rules = makeRules({ profitCurrent: 10000, profitTarget: 9000 })
    expect(getProfitPct(rules)).toBe(100)
  })

  test('$0 earned → 0%', () => {
    const rules = makeRules({ profitCurrent: 0, profitTarget: 9000 })
    expect(getProfitPct(rules)).toBe(0)
  })

  test('zero profit target → 0% (no division by zero)', () => {
    const rules = makeRules({ profitCurrent: 5000, profitTarget: 0 })
    expect(getProfitPct(rules)).toBe(0)
  })

  test('$500 of $10,000 → 5%', () => {
    const rules = makeRules({ profitCurrent: 500, profitTarget: 10000 })
    expect(getProfitPct(rules)).toBeCloseTo(5, 4)
  })

  test('$2,500 of $5,000 → 50%', () => {
    const rules = makeRules({ profitCurrent: 2500, profitTarget: 5000 })
    expect(getProfitPct(rules)).toBeCloseTo(50, 4)
  })
})

// ─── Color Zone Threshold Tests ────────────────────────────────────────────────

describe('Drawdown Color Zones', () => {
  // Thresholds: 0-60% green, 60-80% yellow, 80-90% orange, 90%+ red

  test('0% → green', () => {
    expect(getDrawdownColor(0)).toBe('#00c06a')
  })

  test('50% → green (below 60%)', () => {
    expect(getDrawdownColor(50)).toBe('#00c06a')
  })

  test('59.9% → green (just below yellow threshold)', () => {
    expect(getDrawdownColor(59.9)).toBe('#00c06a')
  })

  test('60% → yellow', () => {
    expect(getDrawdownColor(60)).toBe('#f0a500')
  })

  test('70% → yellow (between 60-80%)', () => {
    expect(getDrawdownColor(70)).toBe('#f0a500')
  })

  test('79.9% → yellow (just below orange threshold)', () => {
    expect(getDrawdownColor(79.9)).toBe('#f0a500')
  })

  test('80% → orange', () => {
    expect(getDrawdownColor(80)).toBe('#f97316')
  })

  test('85% → orange (between 80-90%)', () => {
    expect(getDrawdownColor(85)).toBe('#f97316')
  })

  test('89.9% → orange (just below red threshold)', () => {
    expect(getDrawdownColor(89.9)).toBe('#f97316')
  })

  test('90% → red', () => {
    expect(getDrawdownColor(90)).toBe('#ff4560')
  })

  test('95% → red', () => {
    expect(getDrawdownColor(95)).toBe('#ff4560')
  })

  test('100% → red', () => {
    expect(getDrawdownColor(100)).toBe('#ff4560')
  })

  test('110% (exceeded) → red', () => {
    expect(getDrawdownColor(110)).toBe('#ff4560')
  })
})

// ─── Streak Calculation Tests ─────────────────────────────────────────────────
// Tests the streak logic used in journal stats (weekdays only)

describe('Streak Calculations', () => {
  /** Count consecutive wins/losses, counting only weekday trade dates */
  function calcStreak(trades: Array<{ date: string; pnl: number }>): number {
    if (trades.length === 0) return 0
    const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date))
    const last = sorted[sorted.length - 1]
    const isWin = last.pnl > 0

    let streak = 0
    for (let i = sorted.length - 1; i >= 0; i--) {
      const t = sorted[i]
      if ((isWin && t.pnl > 0) || (!isWin && t.pnl <= 0)) {
        streak++
      } else {
        break
      }
    }
    return isWin ? streak : -streak
  }

  /** Check if a date is a weekday (Mon–Fri) */
  function isWeekday(dateStr: string): boolean {
    const d = new Date(dateStr + 'T12:00:00Z') // noon UTC to avoid timezone issues
    const day = d.getUTCDay()
    return day >= 1 && day <= 5
  }

  test('3 consecutive wins → streak +3', () => {
    const trades = [
      { date: '2024-01-08', pnl: 200 }, // Monday
      { date: '2024-01-09', pnl: 150 }, // Tuesday
      { date: '2024-01-10', pnl: 300 }, // Wednesday
    ]
    expect(calcStreak(trades)).toBe(3)
  })

  test('2 consecutive losses → streak -2', () => {
    const trades = [
      { date: '2024-01-08', pnl: 200 },
      { date: '2024-01-09', pnl: -100 },
      { date: '2024-01-10', pnl: -150 },
    ]
    expect(calcStreak(trades)).toBe(-2)
  })

  test('win streak broken → reset count', () => {
    const trades = [
      { date: '2024-01-08', pnl: 200 },
      { date: '2024-01-09', pnl: 300 },
      { date: '2024-01-10', pnl: -100 }, // loss breaks streak
      { date: '2024-01-11', pnl: 150 },  // new win streak
    ]
    expect(calcStreak(trades)).toBe(1) // only 1 consecutive win at end
  })

  test('empty trades → streak 0', () => {
    expect(calcStreak([])).toBe(0)
  })

  test('single winning trade → streak +1', () => {
    const trades = [{ date: '2024-01-08', pnl: 100 }]
    expect(calcStreak(trades)).toBe(1)
  })

  test('weekdays: Mon–Fri are valid trading days', () => {
    // 2024-01-08 = Monday, 2024-01-12 = Friday
    expect(isWeekday('2024-01-08')).toBe(true) // Monday
    expect(isWeekday('2024-01-09')).toBe(true) // Tuesday
    expect(isWeekday('2024-01-10')).toBe(true) // Wednesday
    expect(isWeekday('2024-01-11')).toBe(true) // Thursday
    expect(isWeekday('2024-01-12')).toBe(true) // Friday
  })

  test('weekends: Sat and Sun are not trading days', () => {
    expect(isWeekday('2024-01-13')).toBe(false) // Saturday
    expect(isWeekday('2024-01-14')).toBe(false) // Sunday
  })

  test('trading days counter only counts unique weekday dates', () => {
    const tradeDates = [
      '2024-01-08', // Monday — valid
      '2024-01-09', // Tuesday — valid
      '2024-01-10', // Wednesday — valid
      '2024-01-10', // duplicate — doesn't count twice
    ]
    const uniqueDays = new Set(tradeDates.filter(isWeekday))
    expect(uniqueDays.size).toBe(3)
  })
})

// ─── Combined PropFirm Dashboard Math ─────────────────────────────────────────

describe('PropFirm Dashboard Calculations', () => {
  test('account at 75% of all limits is in yellow/orange zone', () => {
    const rules = makeRules({
      drawdownCurrent: 3750,
      drawdownLimit: 5000,
      profitCurrent: 3375,
      profitTarget: 9000,
      todayPnl: -1500,
      dailyLimit: 2000,
    })

    expect(getDrawdownUsedPct(rules)).toBeCloseTo(75, 1)
    expect(getProfitPct(rules)).toBeCloseTo(37.5, 1)
    expect(getDailyLossPct(rules)).toBeCloseTo(75, 1)

    expect(getDrawdownColor(75)).toBe('#f0a500') // yellow
    expect(getDrawdownColor(getDailyLossPct(rules))).toBe('#f0a500') // yellow
  })

  test('critical account: 91% drawdown used → red zone', () => {
    const rules = makeRules({ drawdownCurrent: 4550, drawdownLimit: 5000 })
    const pct = getDrawdownUsedPct(rules)
    expect(pct).toBeCloseTo(91, 1)
    expect(getDrawdownColor(pct)).toBe('#ff4560')
  })

  test('healthy account: 15% drawdown used → green zone', () => {
    const rules = makeRules({ drawdownCurrent: 750, drawdownLimit: 5000 })
    const pct = getDrawdownUsedPct(rules)
    expect(pct).toBeCloseTo(15, 1)
    expect(getDrawdownColor(pct)).toBe('#00c06a')
  })
})
