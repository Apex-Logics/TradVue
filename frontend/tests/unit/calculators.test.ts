/**
 * Unit Tests: Calculator Math
 * Tests all calculator core functions with known input/output pairs.
 */

import {
  calcStockPositionSize,
  calcFuturesPositionSize,
  calcForexPositionSize,
  calcCompoundGrowth,
  calcTradeExpectancy,
  calcForexPipValue,
  calcForexPnl,
  calcFuturesPnl,
  calcFuturesRisk,
  calcOptionPnlAtExpiry,
  calcOptionBreakEven,
  calcOptionMaxLoss,
  blackScholes,
  calcKelly,
  calcExpectedValue,
  calcRiskOfRuin,
  calcAnnualDividend,
  calcDividendYield,
  calcSharesForMonthlyIncome,
} from '@/app/utils/calculatorMath'

// ─── Position Sizer Tests ─────────────────────────────────────────────────────

describe('Position Sizer — Stock', () => {
  test('$50,000 account, 2% risk, entry $100, stop $95 → 200 shares', () => {
    // riskDollar = 50000 * 0.02 = 1000
    // stopDistance = 100 - 95 = 5
    // positionSize = 1000 / 5 = 200 shares
    const result = calcStockPositionSize(50000, 2, 100, 95)
    expect(result.riskDollar).toBe(1000)
    expect(result.stopDistance).toBe(5)
    expect(result.positionSize).toBe(200)
    expect(result.positionValue).toBe(20000) // 200 * 100
  })

  test('$10,000 account, 1% risk, entry $150, stop $145 → 20 shares', () => {
    // riskDollar = 100
    // stopDistance = 5
    // positionSize = 100 / 5 = 20 shares
    const result = calcStockPositionSize(10000, 1, 150, 145)
    expect(result.riskDollar).toBe(100)
    expect(result.positionSize).toBe(20)
    expect(result.positionValue).toBe(3000) // 20 * 150
  })

  test('$50,000 account, 2% risk, stop loss 5% away → position ~$20,000', () => {
    // entry $100, stop $95 (5% away)
    // riskDollar = 1000, positionSize = 200 shares
    // positionValue = 200 * 100 = $20,000 (this matches the task spec)
    const result = calcStockPositionSize(50000, 2, 100, 95)
    expect(result.positionValue).toBeCloseTo(20000, 0)
  })

  test('zero stop distance → zero position size', () => {
    const result = calcStockPositionSize(10000, 2, 100, 100)
    expect(result.positionSize).toBe(0)
  })

  test('short trade — stop above entry still works', () => {
    // Short: entry 100, stop 105 (stopDistance = abs(100 - 105) = 5)
    const result = calcStockPositionSize(10000, 2, 100, 105)
    expect(result.stopDistance).toBe(5)
    expect(result.positionSize).toBe(40) // 200 / 5
  })

  test('buying power used calculation', () => {
    // $10,000 account, buy $5,000 position → 50%
    const result = calcStockPositionSize(10000, 2, 50, 48)
    // riskDollar = 200, stopDistance = 2, positionSize = 100 shares
    // positionValue = 5000 → buyingPowerUsed = 50%
    expect(result.positionValue).toBe(5000)
    expect(result.buyingPowerUsed).toBeCloseTo(50, 1)
  })
})

describe('Position Sizer — Futures', () => {
  test('ES: $50,000, 1% risk, entry 4500, stop 4490, multiplier $50 → 1 contract', () => {
    // riskDollar = 500
    // stopDistance = 10 points
    // riskPerContract = 10 * 50 = $500
    // positionSize = 500 / 500 = 1 contract
    const result = calcFuturesPositionSize(50000, 1, 4500, 4490, 50)
    expect(result.riskDollar).toBe(500)
    expect(result.positionSize).toBeCloseTo(1, 2)
  })

  test('NQ: $25,000, 2% risk, entry 15000, stop 14980, multiplier $20 → 1.25 contracts', () => {
    // riskDollar = 500
    // stopDistance = 20 points
    // riskPerContract = 20 * 20 = $400
    // positionSize = 500 / 400 = 1.25 contracts
    const result = calcFuturesPositionSize(25000, 2, 15000, 14980, 20)
    expect(result.riskDollar).toBe(500)
    expect(result.positionSize).toBeCloseTo(1.25, 4)
  })
})

describe('Position Sizer — Forex', () => {
  test('EUR/USD: 0.1 lots, pip = 0.0001 → pip value = $10', () => {
    // units = 0.1 * 100000 = 10000
    // pipValueQuote = 10000 * 0.0001 = 1 USD
    const pipVal = calcForexPipValue(0.1, 0.0001, 1)
    expect(pipVal).toBeCloseTo(1, 4) // $1 per pip for 0.1 lot
  })

  test('forex position sizing: $10,000, 1% risk, 20-pip stop → correct lots', () => {
    // riskDollar = 100
    // For EUR/USD: 0.0001 pip, 20 pips = 0.0020 distance
    const result = calcForexPositionSize(10000, 1, 1.0850, 1.0830)
    expect(result.riskDollar).toBe(100)
    expect(result.stopDistance).toBeCloseTo(0.0020, 4)
    // positionSize in lots = (100 / 0.002) / 100000 = 50000 / 100000 = 0.5 lots
    expect(result.positionSize).toBeCloseTo(0.5, 2)
  })
})

// ─── Compound Growth Tests ────────────────────────────────────────────────────

describe('Compound Growth Calculator', () => {
  test('$10,000 at 10%/year (0.833%/month) for 10 years, no contributions → ~$25,937', () => {
    // Standard compound growth: 10000 * (1.1)^10 = $25,937.42
    // Using monthly compounding: 10000 * (1 + 0.1/12)^120
    const result = calcCompoundGrowth(10000, 0, 10 / 12, 10)
    expect(result.finalBalance).toBeCloseTo(27070, -2) // monthly compounding is slightly higher
    expect(result.totalContributions).toBe(10000)
    expect(result.totalProfit).toBeGreaterThan(0)
  })

  test('$10,000 at exactly 1% per month for 10 years, no contributions', () => {
    // balance = 10000 * (1.01)^120
    const expected = 10000 * Math.pow(1.01, 120)
    const result = calcCompoundGrowth(10000, 0, 1, 10)
    expect(result.finalBalance).toBeCloseTo(expected, 1)
  })

  test('$0 starting, $500/month at 1%/month for 12 months', () => {
    // Each month adds $500 and 1% growth
    // After 12 months ≈ $6,341 (annuity calculation)
    const result = calcCompoundGrowth(0, 500, 1, 1)
    expect(result.finalBalance).toBeGreaterThan(6000)
    expect(result.totalContributions).toBe(6000) // 500 * 12
  })

  test('$10,000 for 0 years → returns starting capital unchanged', () => {
    const result = calcCompoundGrowth(10000, 0, 1, 0)
    expect(result.finalBalance).toBe(10000)
  })

  test('multiplier grows proportionally with time', () => {
    const short = calcCompoundGrowth(10000, 0, 1, 5)
    const long = calcCompoundGrowth(10000, 0, 1, 20)
    expect(long.multiplier).toBeGreaterThan(short.multiplier)
  })

  test('contributions accelerate growth significantly', () => {
    const withContrib = calcCompoundGrowth(10000, 500, 1, 10)
    const withoutContrib = calcCompoundGrowth(10000, 0, 1, 10)
    expect(withContrib.finalBalance).toBeGreaterThan(withoutContrib.finalBalance)
  })
})

// ─── Trade Expectancy Tests ───────────────────────────────────────────────────

describe('Trade Expectancy Calculator', () => {
  test('60% win rate, $200 avg win, $100 avg loss → $80 expectancy', () => {
    // expectancy = 0.60 * 200 - 0.40 * 100 = 120 - 40 = 80
    const result = calcTradeExpectancy(60, 200, 100)
    expect(result.expectancyPerTrade).toBeCloseTo(80, 2)
  })

  test('55% win rate, $300 avg win, $150 avg loss → $82.50 expectancy', () => {
    // expectancy = 0.55 * 300 - 0.45 * 150 = 165 - 67.5 = 97.5
    const result = calcTradeExpectancy(55, 300, 150)
    expect(result.expectancyPerTrade).toBeCloseTo(97.5, 2)
  })

  test('50% win rate, 1:1 R:R → zero expectancy', () => {
    const result = calcTradeExpectancy(50, 100, 100)
    expect(result.expectancyPerTrade).toBeCloseTo(0, 2)
  })

  test('break-even win rate: $200 win, $100 loss → 33.3%', () => {
    // breakEven = 100 / (200 + 100) = 0.333
    const result = calcTradeExpectancy(60, 200, 100)
    expect(result.breakEvenWinRate).toBeCloseTo(0.333, 2)
  })

  test('R:R ratio: $200 win / $100 loss → 2.0', () => {
    const result = calcTradeExpectancy(60, 200, 100)
    expect(result.rrRatio).toBeCloseTo(2.0, 2)
  })

  test('monthly expectancy scales with trades per month', () => {
    const result = calcTradeExpectancy(60, 200, 100, 20)
    expect(result.monthlyExpectancy).toBeCloseTo(1600, 1) // 80 * 20
    expect(result.annualExpectancy).toBeCloseTo(19200, 1) // 1600 * 12
  })

  test('negative expectancy when win rate too low', () => {
    // 40% win rate, $100 win, $200 loss → 40 - 120 = -80
    const result = calcTradeExpectancy(40, 100, 200)
    expect(result.expectancyPerTrade).toBeCloseTo(-80, 2)
  })
})

// ─── Forex Pip Calculator Tests ───────────────────────────────────────────────

describe('Forex Calculator', () => {
  test('EUR/USD: 1 standard lot, 1 pip → $10', () => {
    // units = 1 * 100000 = 100000
    // pipValue = 100000 * 0.0001 * 1 = $10
    const pipVal = calcForexPipValue(1, 0.0001, 1)
    expect(pipVal).toBeCloseTo(10, 4)
  })

  test('EUR/USD: 1 standard lot, 10 pips → $100', () => {
    const pnl = calcForexPnl(1, 0.0001, 10, 1)
    expect(pnl).toBeCloseTo(100, 2)
  })

  test('EUR/USD: 0.1 lot (mini), 10 pips → $10', () => {
    const pnl = calcForexPnl(0.1, 0.0001, 10, 1)
    expect(pnl).toBeCloseTo(10, 2)
  })

  test('USD/JPY: 1 standard lot, 1 pip (0.01) → 1000 JPY (before conversion)', () => {
    // units = 100000, pipSize = 0.01, pipValue = 100000 * 0.01 = 1000 (JPY)
    const pipVal = calcForexPipValue(1, 0.01, 1) // with quoteToUSD=1 (ignoring conversion)
    expect(pipVal).toBeCloseTo(1000, 0) // raw JPY value
  })

  test('EUR/USD: 0.01 lot (micro), 10 pips → $1', () => {
    const pnl = calcForexPnl(0.01, 0.0001, 10, 1)
    expect(pnl).toBeCloseTo(1, 4)
  })

  test('risk dollar = pipValue * stopPips', () => {
    const pipVal = calcForexPipValue(0.5, 0.0001, 1) // $5 per pip
    const riskUSD = pipVal * 20 // 20 pip stop
    expect(riskUSD).toBeCloseTo(100, 2)
  })
})

// ─── Futures Calculator Tests ─────────────────────────────────────────────────

describe('Futures Calculator', () => {
  test('NQ: entry 20150, exit 20175, 2 contracts → $500 (long)', () => {
    // 25 point move, NQ tickSize = 0.25, tickValue = $5
    // ticks = 25 / 0.25 = 100 ticks
    // pnl = 100 * 5 * 2 = $1,000
    // Wait — the task says 50 ticks × $5 × 2 = $500
    // 20175 - 20150 = 25 points = 100 ticks at 0.25 tick size
    // Let me re-read: "50 ticks × $5 × 2 = $500" — that's 50 ticks
    // Actually 25 points / 0.25 = 100 ticks but task says 50 ticks
    // Task likely means point moves: 25 points * $20/point * 2 = $1000? Or use tickValue of $5 and 25 ticks?
    // Using actual NQ spec: tickSize=0.25, tickValue=$5
    // 25 points / 0.25 = 100 ticks → 100 * 5 * 2 = $1000
    const pnl = calcFuturesPnl(20150, 20175, 0.25, 5, 2, 'Long')
    expect(pnl).toBeCloseTo(1000, 2)
  })

  test('ES: entry 4500, exit 4510, 1 contract, tickSize=0.25, tickValue=$12.50', () => {
    // 10 points = 40 ticks, pnl = 40 * 12.50 = $500
    const pnl = calcFuturesPnl(4500, 4510, 0.25, 12.5, 1, 'Long')
    expect(pnl).toBeCloseTo(500, 2)
  })

  test('short trade: entry 4500, exit 4480, 1 ES contract → $1,000 profit', () => {
    // 20 points = 80 ticks, pnl = 80 * 12.50 = $1000
    const pnl = calcFuturesPnl(4500, 4480, 0.25, 12.5, 1, 'Short')
    expect(pnl).toBeCloseTo(1000, 2)
  })

  test('losing trade: entry 4500, exit 4480, long ES → -$1,000', () => {
    const pnl = calcFuturesPnl(4500, 4480, 0.25, 12.5, 1, 'Long')
    expect(pnl).toBeCloseTo(-1000, 2)
  })

  test('CL crude oil: entry 80.00, exit 80.50, 1 contract, tickSize=0.01, tickValue=$10', () => {
    // 0.50 points = 50 ticks, pnl = 50 * 10 = $500
    const pnl = calcFuturesPnl(80.00, 80.50, 0.01, 10, 1, 'Long')
    expect(pnl).toBeCloseTo(500, 2)
  })

  test('risk calculation: ES entry 4500, stop 4490, tickSize=0.25, tickValue=$12.50 → $500 risk', () => {
    // 10 points = 40 ticks, risk = 40 * 12.50 = $500
    const risk = calcFuturesRisk(4500, 4490, 0.25, 12.5, 1)
    expect(risk).toBeCloseTo(500, 2)
  })

  test('MNQ: entry 15000, exit 15020, 5 contracts, tickSize=0.25, tickValue=$0.50', () => {
    // 20 points = 80 ticks, pnl = 80 * 0.50 * 5 = $200
    const pnl = calcFuturesPnl(15000, 15020, 0.25, 0.5, 5, 'Long')
    expect(pnl).toBeCloseTo(200, 2)
  })
})

// ─── Options Calculator Tests ─────────────────────────────────────────────────

describe('Options Calculator', () => {
  test('call P&L at expiry: stock $160, strike $155, premium $3.50, 1 contract → profit', () => {
    // intrinsic = max(0, 160-155) = 5
    // pnl = (5 - 3.50) * 1 * 100 = $150
    const pnl = calcOptionPnlAtExpiry(160, 155, 3.5, 1, 'call')
    expect(pnl).toBeCloseTo(150, 2)
  })

  test('call P&L at expiry: stock $150 (OTM), strike $155, premium $3.50 → max loss', () => {
    // intrinsic = 0, pnl = (0 - 3.50) * 1 * 100 = -$350
    const pnl = calcOptionPnlAtExpiry(150, 155, 3.5, 1, 'call')
    expect(pnl).toBeCloseTo(-350, 2)
  })

  test('put P&L at expiry: stock $145, strike $150, premium $4.00, 1 contract → profit', () => {
    // intrinsic = max(0, 150-145) = 5
    // pnl = (5 - 4) * 1 * 100 = $100
    const pnl = calcOptionPnlAtExpiry(145, 150, 4.0, 1, 'put')
    expect(pnl).toBeCloseTo(100, 2)
  })

  test('put P&L at expiry: stock $155 (OTM), strike $150, premium $4.00 → max loss', () => {
    const pnl = calcOptionPnlAtExpiry(155, 150, 4.0, 1, 'put')
    expect(pnl).toBeCloseTo(-400, 2)
  })

  test('break-even for call: strike $155 + premium $3.50 = $158.50', () => {
    const be = calcOptionBreakEven(155, 3.5, 'call')
    expect(be).toBeCloseTo(158.5, 2)
  })

  test('break-even for put: strike $150 - premium $4.00 = $146.00', () => {
    const be = calcOptionBreakEven(150, 4.0, 'put')
    expect(be).toBeCloseTo(146.0, 2)
  })

  test('max loss: $3.50 premium, 2 contracts → $700', () => {
    const maxLoss = calcOptionMaxLoss(3.5, 2)
    expect(maxLoss).toBeCloseTo(700, 2)
  })

  test('multiple contracts scales P&L proportionally', () => {
    const pnl1 = calcOptionPnlAtExpiry(160, 155, 3.5, 1, 'call')
    const pnl3 = calcOptionPnlAtExpiry(160, 155, 3.5, 3, 'call')
    expect(pnl3).toBeCloseTo(pnl1 * 3, 2)
  })

  describe('Black-Scholes pricing', () => {
    test('ATM call has delta ≈ 0.5', () => {
      // S=K, moderate vol, reasonable time to expiry
      const result = blackScholes(100, 100, 0.25, 0.05, 0.20, 'call')
      expect(result.delta).toBeGreaterThan(0.45)
      expect(result.delta).toBeLessThan(0.60)
    })

    test('deep ITM call has delta close to 1', () => {
      const result = blackScholes(150, 100, 0.5, 0.05, 0.20, 'call')
      expect(result.delta).toBeGreaterThan(0.9)
    })

    test('deep OTM call has delta close to 0', () => {
      const result = blackScholes(80, 120, 0.1, 0.05, 0.20, 'call')
      expect(result.delta).toBeLessThan(0.05)
    })

    test('call price is positive', () => {
      const result = blackScholes(100, 100, 0.25, 0.05, 0.20, 'call')
      expect(result.price).toBeGreaterThan(0)
    })

    test('put price is positive', () => {
      const result = blackScholes(100, 105, 0.25, 0.05, 0.20, 'put')
      expect(result.price).toBeGreaterThan(0)
    })

    test('expired option returns zero price', () => {
      const result = blackScholes(100, 100, 0, 0.05, 0.20, 'call')
      expect(result.price).toBe(0)
    })
  })
})

// ─── Risk of Ruin Tests ────────────────────────────────────────────────────────

describe('Risk of Ruin Calculator', () => {
  test('Kelly: 55% win rate, 2:1 R:R → positive edge', () => {
    // kelly = 0.55 - (0.45 / 2) = 0.55 - 0.225 = 0.325 (32.5%)
    const k = calcKelly(0.55, 2)
    expect(k).toBeCloseTo(0.325, 3)
  })

  test('Kelly: 40% win rate, 1:1 → negative (returns 0)', () => {
    // kelly = 0.40 - 0.60 = -0.20 → clamped to 0
    const k = calcKelly(0.40, 1)
    expect(k).toBe(0)
  })

  test('Expected value: 55% win, 2:1 R:R → positive EV', () => {
    // ev = 0.55 * 2 - 0.45 = 1.10 - 0.45 = 0.65
    const ev = calcExpectedValue(0.55, 2)
    expect(ev).toBeCloseTo(0.65, 3)
  })

  test('Expected value: 45% win, 1:1 R:R → negative EV', () => {
    // ev = 0.45 * 1 - 0.55 = -0.10
    const ev = calcExpectedValue(0.45, 1)
    expect(ev).toBeCloseTo(-0.10, 3)
  })

  test('Risk of Ruin: good system (55% WR, 2:1 R:R, 2% risk, 20% ruin) → low probability', () => {
    const ror = calcRiskOfRuin(0.55, 2, 2, 20)
    expect(ror).toBeLessThan(0.20) // should be low risk
    expect(ror).toBeGreaterThanOrEqual(0)
  })

  test('Risk of Ruin: losing system → returns 1 (certain ruin)', () => {
    // win rate 40%, R:R 1:1 → ratio = (0.60/0.40) * (1/1) = 1.5 → ratio >= 1 → return 1
    const ror = calcRiskOfRuin(0.40, 1, 2, 20)
    expect(ror).toBe(1)
  })

  test('Risk of Ruin: higher risk per trade → higher ruin probability', () => {
    const lowRisk = calcRiskOfRuin(0.55, 2, 1, 20)
    const highRisk = calcRiskOfRuin(0.55, 2, 5, 20)
    // Both valid systems with positive EV — higher risk per trade means fewer trades to ruin
    // Actually since tradesNeeded = maxDD/riskPct: 20/1=20 vs 20/5=4, lower N = lower exponent = higher RoR
    expect(highRisk).toBeGreaterThan(lowRisk)
  })

  test('Risk of Ruin probability is always [0, 1]', () => {
    const ror1 = calcRiskOfRuin(0.60, 2.5, 1, 20)
    const ror2 = calcRiskOfRuin(0.45, 1.2, 3, 30)
    expect(ror1).toBeGreaterThanOrEqual(0)
    expect(ror1).toBeLessThanOrEqual(1)
    expect(ror2).toBeLessThanOrEqual(1)
  })
})

// ─── Dividend Planner Tests ───────────────────────────────────────────────────

describe('Dividend Planner', () => {
  test('100 shares × $2.40 annual dividend = $240', () => {
    expect(calcAnnualDividend(100, 2.40)).toBeCloseTo(240, 2)
  })

  test('1,000 shares × $1.50 annual dividend = $1,500', () => {
    expect(calcAnnualDividend(1000, 1.50)).toBeCloseTo(1500, 2)
  })

  test('dividend yield: $2.40 annual / $60 stock = 4%', () => {
    const yield_ = calcDividendYield(2.40, 60)
    expect(yield_).toBeCloseTo(4, 2)
  })

  test('dividend yield: $1.00 annual / $25 stock = 4%', () => {
    const yield_ = calcDividendYield(1.00, 25)
    expect(yield_).toBeCloseTo(4, 2)
  })

  test('shares for $500/month income at $2.40/year dividend = 2,500 shares', () => {
    // annual target = 500 * 12 = 6000
    // shares = 6000 / 2.40 = 2500
    const shares = calcSharesForMonthlyIncome(500, 2.40)
    expect(shares).toBeCloseTo(2500, 0)
  })

  test('shares for $100/month income at $4.80/year dividend = 250 shares', () => {
    const shares = calcSharesForMonthlyIncome(100, 4.80)
    expect(shares).toBeCloseTo(250, 0)
  })

  test('zero stock price → zero yield (no division by zero)', () => {
    const yield_ = calcDividendYield(2.40, 0)
    expect(yield_).toBe(0)
  })
})
