/**
 * calculatorMath.ts
 * Pure math functions extracted from calculator components.
 * These functions are framework-agnostic and fully testable.
 */

// ─── Position Sizer ────────────────────────────────────────────────────────────

export interface PositionSizeResult {
  riskDollar: number
  stopDistance: number
  positionSize: number
  positionValue: number
  buyingPowerUsed: number
}

/**
 * Calculate position size for stocks/crypto.
 * positionSize = (account * riskPct/100) / |entry - stop|
 */
export function calcStockPositionSize(
  account: number,
  riskPct: number,
  entry: number,
  stop: number,
): PositionSizeResult {
  const riskDollar = account * (riskPct / 100)
  const stopDistance = Math.abs(entry - stop)
  const positionSize = stopDistance > 0 ? riskDollar / stopDistance : 0
  const positionValue = positionSize * entry
  const buyingPowerUsed = account > 0 ? (positionValue / account) * 100 : 0
  return { riskDollar, stopDistance, positionSize, positionValue, buyingPowerUsed }
}

/**
 * Calculate position size for futures contracts.
 * positionSize = (account * riskPct/100) / (|entry - stop| * multiplier)
 */
export function calcFuturesPositionSize(
  account: number,
  riskPct: number,
  entry: number,
  stop: number,
  multiplier: number,
): PositionSizeResult {
  const riskDollar = account * (riskPct / 100)
  const stopDistance = Math.abs(entry - stop)
  const positionSize = stopDistance > 0 ? riskDollar / (stopDistance * multiplier) : 0
  const positionValue = positionSize * entry * multiplier
  const buyingPowerUsed = account > 0 ? (positionValue / account) * 100 : 0
  return { riskDollar, stopDistance, positionSize, positionValue, buyingPowerUsed }
}

/**
 * Calculate position size for forex (in lots).
 * 1 standard lot = 100,000 units
 * positionSize (lots) = (account * riskPct/100) / |entry - stop| / 100000
 */
export function calcForexPositionSize(
  account: number,
  riskPct: number,
  entry: number,
  stop: number,
): PositionSizeResult {
  const riskDollar = account * (riskPct / 100)
  const stopDistance = Math.abs(entry - stop)
  const rawSize = stopDistance > 0 ? riskDollar / stopDistance : 0
  const positionSize = rawSize / 100000 // convert units to lots
  const positionValue = rawSize * entry
  const buyingPowerUsed = account > 0 ? (positionValue / account) * 100 : 0
  return { riskDollar, stopDistance, positionSize, positionValue, buyingPowerUsed }
}

// ─── Compound Growth ───────────────────────────────────────────────────────────

export interface CompoundResult {
  finalBalance: number
  totalContributions: number
  totalProfit: number
  multiplier: number
}

/**
 * Compound growth with periodic contributions (monthly compounding).
 * Each period: balance = balance * (1 + ratePerPeriod) + contribution
 */
export function calcCompoundGrowth(
  startCapital: number,
  monthlyContribution: number,
  monthlyRatePct: number,
  years: number,
): CompoundResult {
  const ratePerPeriod = monthlyRatePct / 100
  const periods = years * 12
  let balance = startCapital
  let totalContributions = startCapital

  for (let i = 0; i < periods; i++) {
    balance = balance * (1 + ratePerPeriod) + monthlyContribution
    totalContributions += monthlyContribution
  }

  const totalProfit = balance - totalContributions
  const multiplier = startCapital > 0 ? balance / startCapital : 0

  return { finalBalance: balance, totalContributions, totalProfit, multiplier }
}

// ─── Trade Expectancy ──────────────────────────────────────────────────────────

export interface ExpectancyResult {
  expectancyPerTrade: number
  rrRatio: number
  breakEvenWinRate: number
  monthlyExpectancy: number
  annualExpectancy: number
}

/**
 * Trade expectancy = (winRate * avgWin) - (lossRate * avgLoss)
 * Break-even win rate = avgLoss / (avgWin + avgLoss)
 */
export function calcTradeExpectancy(
  winRatePct: number,
  avgWin: number,
  avgLoss: number,
  tradesPerMonth = 0,
): ExpectancyResult {
  const wr = winRatePct / 100
  const lr = 1 - wr
  const expectancyPerTrade = wr * avgWin - lr * avgLoss
  const rrRatio = avgLoss > 0 ? avgWin / avgLoss : 0
  const breakEvenWinRate = avgLoss > 0 ? avgLoss / (avgWin + avgLoss) : 0
  const monthlyExpectancy = expectancyPerTrade * tradesPerMonth
  const annualExpectancy = monthlyExpectancy * 12
  return { expectancyPerTrade, rrRatio, breakEvenWinRate, monthlyExpectancy, annualExpectancy }
}

// ─── Forex Pip Calculator ─────────────────────────────────────────────────────

/**
 * Pip value in quote currency for a USD-quoted pair.
 * pipValueUSD = lots * unitsPerLot * pipSize * quoteToUSD
 * For USD-quoted pairs (EUR/USD etc.), quoteToUSD = 1.
 */
export function calcForexPipValue(
  lots: number,
  pipSize: number,
  quoteToUSD = 1,
): number {
  const unitsPerLot = 100000
  const units = lots * unitsPerLot
  const pipValueQuote = units * pipSize
  return pipValueQuote * quoteToUSD
}

/**
 * Total dollar P&L for forex trade.
 * pnl = pipValue * pips (positive = profit)
 */
export function calcForexPnl(
  lots: number,
  pipSize: number,
  pips: number,
  quoteToUSD = 1,
): number {
  return calcForexPipValue(lots, pipSize, quoteToUSD) * pips
}

// ─── Futures Calculator ────────────────────────────────────────────────────────

/**
 * Futures P&L in dollars.
 * pnl = (exit - entry) / tickSize * tickValue * contracts
 * For long positions: positive when exit > entry.
 */
export function calcFuturesPnl(
  entry: number,
  exit: number,
  tickSize: number,
  tickValue: number,
  contracts: number,
  direction: 'Long' | 'Short' = 'Long',
): number {
  const priceDiff = direction === 'Long' ? exit - entry : entry - exit
  const ticks = priceDiff / tickSize
  return ticks * tickValue * contracts
}

/**
 * Futures risk in dollars from entry to stop loss.
 */
export function calcFuturesRisk(
  entry: number,
  stop: number,
  tickSize: number,
  tickValue: number,
  contracts: number,
): number {
  const riskTicks = Math.abs(entry - stop) / tickSize
  return riskTicks * tickValue * contracts
}

// ─── Options Calculator ────────────────────────────────────────────────────────

/**
 * Normal CDF approximation (Abramowitz and Stegun).
 */
function normCDF(x: number): number {
  const a1 = 0.2316419, a2 = 0.319381530, a3 = -0.356563782
  const a4 = 1.781477937, a5 = -1.821255978, a6 = 1.330274429
  const t = 1 / (1 + a1 * Math.abs(x))
  const k = 1 - (((((a6 * t + a5) * t + a4) * t + a3) * t + a2) * t) * Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)
  return x >= 0 ? k : 1 - k
}

export interface BlackScholesResult {
  price: number
  delta: number
  gamma: number
  theta: number
  vega: number
}

/**
 * Black-Scholes option pricing.
 * @param S  Spot price
 * @param K  Strike price
 * @param T  Time to expiry (years)
 * @param r  Risk-free rate (decimal)
 * @param v  Implied volatility (decimal)
 * @param type 'call' | 'put'
 */
export function blackScholes(
  S: number,
  K: number,
  T: number,
  r: number,
  v: number,
  type: 'call' | 'put',
): BlackScholesResult {
  if (T <= 0 || v <= 0 || S <= 0 || K <= 0) return { price: 0, delta: 0, gamma: 0, theta: 0, vega: 0 }
  const d1 = (Math.log(S / K) + (r + v * v / 2) * T) / (v * Math.sqrt(T))
  const d2 = d1 - v * Math.sqrt(T)
  const price = type === 'call'
    ? S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2)
    : K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1)
  const delta = type === 'call' ? normCDF(d1) : normCDF(d1) - 1
  const gamma = Math.exp(-d1 * d1 / 2) / (S * v * Math.sqrt(2 * Math.PI * T))
  const theta = type === 'call'
    ? -(S * v * Math.exp(-d1 * d1 / 2)) / (2 * Math.sqrt(2 * Math.PI * T)) - r * K * Math.exp(-r * T) * normCDF(d2)
    : -(S * v * Math.exp(-d1 * d1 / 2)) / (2 * Math.sqrt(2 * Math.PI * T)) + r * K * Math.exp(-r * T) * normCDF(-d2)
  const vega = S * Math.sqrt(T) * Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI)
  return { price, delta, gamma, theta, vega }
}

/**
 * Option P&L at expiration given a specific stock price.
 * pnl = (intrinsicValue - premiumPaid) * contracts * 100
 */
export function calcOptionPnlAtExpiry(
  stockPrice: number,
  strike: number,
  premiumPaid: number,
  contracts: number,
  type: 'call' | 'put',
): number {
  const intrinsic = type === 'call'
    ? Math.max(0, stockPrice - strike)
    : Math.max(0, strike - stockPrice)
  return (intrinsic - premiumPaid) * contracts * 100
}

/**
 * Option break-even price at expiry.
 */
export function calcOptionBreakEven(
  strike: number,
  premium: number,
  type: 'call' | 'put',
): number {
  return type === 'call' ? strike + premium : strike - premium
}

/**
 * Maximum loss on a long option (premium paid in full).
 */
export function calcOptionMaxLoss(premium: number, contracts: number): number {
  return premium * contracts * 100
}

// ─── Risk of Ruin ──────────────────────────────────────────────────────────────

/**
 * Kelly criterion: optimal risk fraction.
 * kelly = winRate - (1 - winRate) / R:R
 */
export function calcKelly(winRate: number, rrRatio: number): number {
  if (rrRatio <= 0) return 0
  return Math.max(0, winRate - (1 - winRate) / rrRatio)
}

/**
 * Expected value per trade in R units.
 * ev = winRate * rrRatio - (1 - winRate)
 */
export function calcExpectedValue(winRate: number, rrRatio: number): number {
  return winRate * rrRatio - (1 - winRate)
}

/**
 * Risk of Ruin approximation using gambler's ruin formula.
 * Returns probability [0, 1] of hitting the drawdown threshold.
 */
export function calcRiskOfRuin(
  winRate: number,
  rrRatio: number,
  riskPct: number,
  maxDrawdownPct: number,
): number {
  const lossRate = 1 - winRate
  const p = winRate
  const q = lossRate
  const r = rrRatio
  const ratio = (q / p) * (1 / r)
  const tradesNeeded = Math.round(maxDrawdownPct / riskPct)
  if (ratio >= 1) return 1
  return Math.pow(ratio, tradesNeeded)
}

// ─── Dividend Planner ─────────────────────────────────────────────────────────

/**
 * Annual dividend income.
 */
export function calcAnnualDividend(shares: number, dividendPerShare: number): number {
  return shares * dividendPerShare
}

/**
 * Dividend yield %.
 */
export function calcDividendYield(annualDividend: number, stockPrice: number): number {
  return stockPrice > 0 ? (annualDividend / stockPrice) * 100 : 0
}

/**
 * Shares needed to reach target monthly income.
 */
export function calcSharesForMonthlyIncome(
  targetMonthly: number,
  annualDividendPerShare: number,
): number {
  const annualTarget = targetMonthly * 12
  return annualDividendPerShare > 0 ? annualTarget / annualDividendPerShare : 0
}
