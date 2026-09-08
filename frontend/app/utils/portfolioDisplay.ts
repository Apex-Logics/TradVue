/**
 * Portfolio display helpers — never treat cost basis as live market value.
 *
 * Before prices load, `currentPrice ?? avgCost` made MARKET VALUE equal COST
 * BASIS and RETURNS equal $0, which flashed fake money ($8,400 / $0) then
 * jumped to real quotes. Callers must skeleton (or "—") until live prices
 * exist; do not substitute avgCost into market-value math.
 */

export type PriceQuote = {
  currentPrice?: number | null
  current?: number | null
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

export function shouldShowFinancialsSkeleton(opts: {
  dataLoaded: boolean
  holdingsCount: number
  pricesSettled: boolean
}): boolean {
  if (!opts.dataLoaded) return true
  if (opts.holdingsCount === 0) return false
  return !opts.pricesSettled
}
