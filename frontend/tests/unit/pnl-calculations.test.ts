/**
 * Unit Tests: P&L Formula Calculations
 * Tests all trade P&L paths: stock, futures, options, short trades, edge cases.
 */

// ─── Pure P&L Functions ───────────────────────────────────────────────────────
// These replicate the inline formulas from journal/page.tsx (calcPnl)
// and futuresContracts.ts (calculatePnlFromTicks, calculateFuturesPnl)

/** Stock/crypto long P&L */
function calcStockPnl(
  entry: number,
  exit: number,
  shares: number,
  commissions = 0,
): number {
  return (exit - entry) * shares - commissions
}

/** Stock/crypto short P&L */
function calcShortPnl(
  entry: number,
  exit: number,
  shares: number,
  commissions = 0,
): number {
  return (entry - exit) * shares - commissions
}

/** Futures P&L using tick math */
function calcFuturesPnlTicks(
  ticks: number,
  tickValue: number,
  contracts: number,
  commissions = 0,
): number {
  return ticks * tickValue * contracts - commissions
}

/** Futures P&L from price difference */
function calcFuturesPnlFromPrices(
  entry: number,
  exit: number,
  tickSize: number,
  tickValue: number,
  contracts: number,
  direction: 'Long' | 'Short' = 'Long',
  commissions = 0,
): number {
  const priceDiff = direction === 'Long' ? exit - entry : entry - exit
  const ticks = priceDiff / tickSize
  return ticks * tickValue * contracts - commissions
}

/** Options P&L — (exit premium - entry premium) × 100 × contracts */
function calcOptionsPnl(
  entryPremium: number,
  exitPremium: number,
  contracts: number,
  commissions = 0,
): number {
  return (exitPremium - entryPremium) * 100 * contracts - commissions
}

/** Options intrinsic value at expiry */
function calcOptionIntrinsicAtExpiry(
  stockPrice: number,
  strike: number,
  type: 'call' | 'put',
): number {
  return type === 'call'
    ? Math.max(0, stockPrice - strike)
    : Math.max(0, strike - stockPrice)
}

// ─── Stock P&L Tests ──────────────────────────────────────────────────────────

describe('Stock P&L — Long', () => {
  test('basic long: (150 - 100) × 100 shares = $5,000', () => {
    expect(calcStockPnl(100, 150, 100)).toBe(5000)
  })

  test('losing long: (90 - 100) × 100 shares = -$1,000', () => {
    expect(calcStockPnl(100, 90, 100)).toBe(-1000)
  })

  test('with commissions: (150 - 100) × 100 - $2.00 = $4,998', () => {
    expect(calcStockPnl(100, 150, 100, 2)).toBe(4998)
  })

  test('fractional shares: (150 - 100) × 10.5 shares = $525', () => {
    expect(calcStockPnl(100, 150, 10.5)).toBeCloseTo(525, 2)
  })

  test('small price move: (100.05 - 100.00) × 1000 shares = $50', () => {
    expect(calcStockPnl(100.00, 100.05, 1000)).toBeCloseTo(50, 2)
  })

  test('large numbers: (200 - 100) × 10,000 shares = $1,000,000', () => {
    expect(calcStockPnl(100, 200, 10000)).toBe(1000000)
  })
})

describe('Stock P&L — Short', () => {
  test('basic short: (100 - 90) × 100 shares = $1,000 profit', () => {
    expect(calcShortPnl(100, 90, 100)).toBe(1000)
  })

  test('losing short (price rises): (100 - 110) × 100 = -$1,000', () => {
    expect(calcShortPnl(100, 110, 100)).toBe(-1000)
  })

  test('short with commissions: (100 - 90) × 100 - $1.50 = $998.50', () => {
    expect(calcShortPnl(100, 90, 100, 1.5)).toBeCloseTo(998.5, 2)
  })

  test('short: entry = exit → zero P&L', () => {
    expect(calcShortPnl(100, 100, 100)).toBe(0)
  })
})

// ─── Futures P&L Tests ────────────────────────────────────────────────────────

describe('Futures P&L', () => {
  test('ES long: 10 point move = 40 ticks at $12.50, 1 contract → $500', () => {
    // 40 ticks * $12.50 * 1 = $500
    expect(calcFuturesPnlTicks(40, 12.5, 1)).toBe(500)
  })

  test('NQ long: entry 20150, exit 20175, tickSize=0.25, tickValue=$5, 2 contracts', () => {
    // 25 points / 0.25 = 100 ticks, pnl = 100 * 5 * 2 = $1000
    expect(calcFuturesPnlFromPrices(20150, 20175, 0.25, 5, 2, 'Long')).toBeCloseTo(1000, 2)
  })

  test('CL crude: entry 80.00, exit 79.50, short, tickSize=0.01, tickValue=$10, 1 contract → $500', () => {
    // 0.50 move = 50 ticks, 50 * 10 * 1 = $500 for short
    expect(calcFuturesPnlFromPrices(80.00, 79.50, 0.01, 10, 1, 'Short')).toBeCloseTo(500, 2)
  })

  test('ES short: entry 4500, exit 4510 (adverse) → -$500', () => {
    // 10 points = 40 ticks, short loses → -40 * 12.5 = -500
    expect(calcFuturesPnlFromPrices(4500, 4510, 0.25, 12.5, 1, 'Short')).toBeCloseTo(-500, 2)
  })

  test('multiple contracts scale linearly', () => {
    const single = calcFuturesPnlFromPrices(4500, 4510, 0.25, 12.5, 1, 'Long')
    const triple = calcFuturesPnlFromPrices(4500, 4510, 0.25, 12.5, 3, 'Long')
    expect(triple).toBeCloseTo(single * 3, 2)
  })

  test('GC gold: entry 1900, exit 1910, tickSize=0.10, tickValue=$10, 1 contract → $1000', () => {
    // 10 point move = 100 ticks, 100 * 10 = $1000
    expect(calcFuturesPnlFromPrices(1900, 1910, 0.10, 10, 1, 'Long')).toBeCloseTo(1000, 2)
  })

  test('futures with commissions deducted', () => {
    // 40 ticks * $12.50 * 1 = $500, minus $4 commissions = $496
    expect(calcFuturesPnlTicks(40, 12.5, 1, 4)).toBe(496)
  })

  test('flat trade (entry = exit) → $0 (minus commissions)', () => {
    expect(calcFuturesPnlFromPrices(4500, 4500, 0.25, 12.5, 1, 'Long')).toBe(0)
  })
})

// ─── Options P&L Tests ────────────────────────────────────────────────────────

describe('Options P&L', () => {
  test('call: entry $2.00, exit $5.00, 1 contract → $300 profit', () => {
    // (5 - 2) * 100 * 1 = $300
    expect(calcOptionsPnl(2.0, 5.0, 1)).toBe(300)
  })

  test('call: losing trade — entry $3.50, exit $1.00, 1 contract → -$250', () => {
    // (1 - 3.5) * 100 * 1 = -$250
    expect(calcOptionsPnl(3.5, 1.0, 1)).toBe(-250)
  })

  test('put: entry $4.00, exit $7.50, 2 contracts → $700 profit', () => {
    // (7.5 - 4) * 100 * 2 = $700
    expect(calcOptionsPnl(4.0, 7.5, 2)).toBe(700)
  })

  test('option expires worthless: entry $3.50, exit $0.00 → -$350', () => {
    expect(calcOptionsPnl(3.5, 0, 1)).toBe(-350)
  })

  test('contracts scale linearly', () => {
    const one = calcOptionsPnl(2, 5, 1)
    const five = calcOptionsPnl(2, 5, 5)
    expect(five).toBe(one * 5)
  })

  test('with commissions: $300 profit - $2 = $298', () => {
    expect(calcOptionsPnl(2.0, 5.0, 1, 2)).toBe(298)
  })

  describe('Intrinsic value at expiry', () => {
    test('ITM call: stock $160, strike $155 → intrinsic = $5', () => {
      expect(calcOptionIntrinsicAtExpiry(160, 155, 'call')).toBe(5)
    })

    test('OTM call: stock $150, strike $155 → intrinsic = $0', () => {
      expect(calcOptionIntrinsicAtExpiry(150, 155, 'call')).toBe(0)
    })

    test('ITM put: stock $145, strike $150 → intrinsic = $5', () => {
      expect(calcOptionIntrinsicAtExpiry(145, 150, 'put')).toBe(5)
    })

    test('OTM put: stock $155, strike $150 → intrinsic = $0', () => {
      expect(calcOptionIntrinsicAtExpiry(155, 150, 'put')).toBe(0)
    })

    test('ATM call: stock = strike → intrinsic = $0', () => {
      expect(calcOptionIntrinsicAtExpiry(150, 150, 'call')).toBe(0)
    })
  })
})

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe('P&L Edge Cases', () => {
  test('zero shares → zero P&L', () => {
    expect(calcStockPnl(100, 150, 0)).toBe(0)
    expect(calcShortPnl(100, 90, 0)).toBe(0)
  })

  test('zero contracts → zero futures P&L', () => {
    expect(calcFuturesPnlTicks(40, 12.5, 0)).toBe(0)
  })

  test('negative P&L is correctly signed', () => {
    expect(calcStockPnl(100, 80, 100)).toBe(-2000)
    expect(calcFuturesPnlTicks(-40, 12.5, 1)).toBe(-500)
    expect(calcOptionsPnl(5, 2, 1)).toBe(-300)
  })

  test('very large numbers do not overflow', () => {
    const bigPnl = calcStockPnl(100, 200, 1000000)
    expect(bigPnl).toBe(100000000) // $100 million
    expect(isFinite(bigPnl)).toBe(true)
  })

  test('floating point precision: $0.01 tick move handled correctly', () => {
    // CL: 1 tick = $0.01, tickValue = $10
    // 1 tick profit on 1 contract = $10
    const pnl = calcFuturesPnlTicks(1, 10, 1)
    expect(pnl).toBe(10)
  })

  test('floating point: stock trade at sub-cent price difference', () => {
    // 1000 shares, 0.001 move = $1 total
    const pnl = calcStockPnl(10.000, 10.001, 1000)
    expect(pnl).toBeCloseTo(1.0, 3)
  })

  test('commissions can create a loss on a winning trade', () => {
    // $5 gain but $10 commission → net -$5
    const pnl = calcStockPnl(100, 100.05, 100, 10) // 0.05 * 100 = 5 gross, -10 = -5
    expect(pnl).toBeCloseTo(-5, 2)
  })

  test('entry equals exit → zero gross P&L', () => {
    expect(calcStockPnl(100, 100, 1000)).toBe(0)
    expect(calcShortPnl(100, 100, 1000)).toBe(0)
  })

  test('negative commission value (rebate) increases P&L', () => {
    // Some brokers pay rebates (negative commission)
    const pnl = calcStockPnl(100, 110, 100, -5) // 1000 + 5 = 1005
    expect(pnl).toBe(1005)
  })
})

// ─── R-Multiple Tests ─────────────────────────────────────────────────────────

describe('R-Multiple Calculations', () => {
  function calcRMultiple(
    entry: number,
    exit: number,
    stop: number,
    direction: 'Long' | 'Short' = 'Long',
  ): number {
    const riskPerUnit = Math.abs(entry - stop)
    if (riskPerUnit === 0) return 0
    const rewardPerUnit = direction === 'Long'
      ? exit - entry
      : entry - exit
    return rewardPerUnit / riskPerUnit
  }

  test('2R winner: entry $100, stop $95, exit $110 → 2R', () => {
    expect(calcRMultiple(100, 110, 95, 'Long')).toBeCloseTo(2, 4)
  })

  test('1R loser: entry $100, stop $95, exit $95 → -1R', () => {
    expect(calcRMultiple(100, 95, 95, 'Long')).toBeCloseTo(-1, 4)
  })

  test('short 3R winner: entry $100, stop $103, exit $91 → 3R', () => {
    expect(calcRMultiple(100, 91, 103, 'Short')).toBeCloseTo(3, 4)
  })

  test('zero stop distance → zero R', () => {
    expect(calcRMultiple(100, 110, 100, 'Long')).toBe(0)
  })
})
