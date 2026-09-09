import type { Quote } from '../types'

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * True when a quote object has a usable last price.
 * Stubs with current/changePct null still count as objects in React state
 * and render as "—" / green "—" in the watchlist.
 */
export function isPricedQuote(quote: unknown): boolean {
  const q = asRecord(quote)
  if (!q) return false
  const n = numberOrNull(q.current ?? q.c ?? q.price)
  return n != null && n !== 0
}

/**
 * Map batch/single quote payloads onto the FE Quote shape.
 * Accepts { current, changePct } (prod Alpaca) and Finnhub raw { c, d, dp }.
 * Returns null for unavailable stubs so they are not hydrated into UI state.
 */
export function normalizeQuote(raw: unknown, fallbackSymbol?: string): Quote | null {
  const q = asRecord(raw)
  if (!q) return null
  const current = numberOrNull(q.current ?? q.c ?? q.price)
  if (current == null || current === 0) return null

  const change = numberOrNull(q.change ?? q.d)
  const changePct = numberOrNull(q.changePct ?? q.dp ?? q.percentChange)
  const symbol = String(q.symbol || fallbackSymbol || '').toUpperCase()
  const source = q.source
  const sourceNorm: Quote['source'] =
    source === 'alpaca' || source === 'mock' || source === 'finnhub'
      ? source
      : 'finnhub'

  return {
    symbol,
    current,
    change: change ?? 0,
    changePct: changePct ?? 0,
    high: numberOrNull(q.high ?? q.h) ?? current,
    low: numberOrNull(q.low ?? q.l) ?? current,
    open: numberOrNull(q.open ?? q.o) ?? current,
    prevClose: numberOrNull(q.prevClose ?? q.pc) ?? current,
    timestamp: typeof q.timestamp === 'string' ? q.timestamp : new Date().toISOString(),
    source: sourceNorm,
  }
}

/**
 * Merge a batch `data` map into existing quotes. Unpriced stubs are dropped
 * so they cannot overwrite a good cached price or become a fake "loaded" row.
 */
export function mergeQuoteRecords(
  prev: Record<string, Quote>,
  incoming: Record<string, unknown> | null | undefined,
): Record<string, Quote> {
  const next = { ...prev }
  if (!incoming) return next
  for (const [key, raw] of Object.entries(incoming)) {
    const normalized = normalizeQuote(raw, key)
    if (!normalized) continue
    next[normalized.symbol || key.toUpperCase()] = normalized
  }
  return next
}

export function pricedQuoteMap(incoming: Record<string, unknown> | null | undefined): Record<string, Quote> {
  return mergeQuoteRecords({}, incoming)
}
