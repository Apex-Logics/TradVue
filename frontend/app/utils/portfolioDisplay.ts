/**
 * Portfolio display helpers — never treat cost basis as live market value.
 *
 * Before prices load, `currentPrice ?? avgCost` made MARKET VALUE equal COST
 * BASIS and RETURNS equal $0, which flashed fake money ($8,400 / $0) then
 * jumped to real quotes. Callers must skeleton (or "—") until live prices
 * exist; do not substitute avgCost into market-value math.
 *
 * `pricesSettled` is quote completeness, not fetch `finally`. KPIs stay
 * skeletoned until every holding has a live quote or an explicit miss
 * (attempted, no usable price) — then missing holdings render as "—",
 * never a $0 undercount.
 */

export const EM_DASH = '—'

export type PriceQuote = {
  currentPrice?: number | null
  current?: number | null
  dayChange?: number | null
  dayChangePct?: number | null
}

export function livePrice(info: PriceQuote | null | undefined): number | null {
  if (!info) return null
  const raw = info.currentPrice ?? info.current
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return null
  return raw
}

export function holdingsHaveLivePrices(
  holdings: { ticker: string }[],
  quotes: Record<string, PriceQuote | undefined>,
): boolean {
  if (holdings.length === 0) return true
  return holdings.every(h => livePrice(quotes[h.ticker]) != null)
}

export function tickerWasAttempted(
  ticker: string,
  attempted: Record<string, boolean>,
): boolean {
  return Boolean(attempted[ticker])
}

/**
 * Prices are ready when data is loaded and every holding is either live
 * or explicitly missing (fetch attempted, no usable quote). Fetch
 * `finally` alone is not sufficient — a failed/empty quote batch must
 * not paint undercounted KPIs.
 */
export function arePricesSettled(opts: {
  dataLoaded: boolean
  holdings: { ticker: string }[]
  quotes: Record<string, PriceQuote | undefined>
  attemptedTickers: Record<string, boolean>
}): boolean {
  if (!opts.dataLoaded) return false
  if (opts.holdings.length === 0) return true
  return opts.holdings.every(h =>
    livePrice(opts.quotes[h.ticker]) != null
    || tickerWasAttempted(h.ticker, opts.attemptedTickers),
  )
}

export function shouldShowFinancialsSkeleton(opts: {
  dataLoaded: boolean
  holdingsCount: number
  pricesSettled: boolean
}): boolean {
  if (!opts.dataLoaded) return true
  if (opts.holdingsCount === 0) return false
  return !opts.pricesSettled
}

export type DayGainTone = 'up' | 'down' | 'flat' | 'none'

export type DayGainHolding = {
  shares: number
  currentPrice?: number | null
  dayChange?: number | null
  dayChangePct?: number | null
}

export type DayGainResult = {
  dollar: number | null
  percent: number | null
  tone: DayGainTone
}

function finiteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/**
 * Day Gain dollar and percent from the same live-quoted holdings.
 * Missing quotes are skipped (not $0). Percent is dollar / prior-close
 * so the two values always share a sign; color/tone follows that sign.
 */
export function computeDayGain(holdings: DayGainHolding[]): DayGainResult {
  let dollar = 0
  let priorCloseValue = 0
  let counted = 0

  for (const h of holdings) {
    const price = livePrice({ currentPrice: h.currentPrice })
    const change = h.dayChange
    if (price == null || !finiteNumber(change) || !(h.shares > 0)) continue
    dollar += change * h.shares
    priorCloseValue += (price - change) * h.shares
    counted++
  }

  if (counted === 0) {
    return { dollar: null, percent: null, tone: 'none' }
  }

  // Same holdings in both numerators: percent inherits dollar's sign whenever
  // prior close is a positive base. A non-positive base yields no percent
  // (em dash) rather than a flipped sign from mixing in $0 market values.
  const percent = priorCloseValue > 0 ? (dollar / priorCloseValue) * 100 : null
  const tone: DayGainTone = dollar > 0 ? 'up' : dollar < 0 ? 'down' : 'flat'
  return { dollar, percent, tone }
}

export function dayGainColor(tone: DayGainTone): string | undefined {
  if (tone === 'up') return 'var(--green)'
  if (tone === 'down') return 'var(--red)'
  if (tone === 'flat') return 'var(--text-0)'
  return undefined
}

export function formatSignedDollar(n: number, symbol = '$'): string {
  const abs = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (n > 0) return `+${symbol}${abs}`
  if (n < 0) return `-${symbol}${abs}`
  return `${symbol}${abs}`
}

export function formatSignedPercent(pct: number): string {
  if (pct > 0) return `+${pct.toFixed(2)}%`
  if (pct < 0) return `${pct.toFixed(2)}%`
  return '0.00%'
}

export function formatDayGainPair(result: DayGainResult, symbol = '$'): {
  dollar: string
  percent: string
  color: string | undefined
} {
  if (result.dollar == null || result.tone === 'none') {
    return { dollar: EM_DASH, percent: EM_DASH, color: undefined }
  }
  return {
    dollar: formatSignedDollar(result.dollar, symbol),
    percent: result.percent == null ? EM_DASH : formatSignedPercent(result.percent),
    color: dayGainColor(result.tone),
  }
}
