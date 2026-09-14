import { WL_CACHE_TTL } from '../constants'

/** Align FE poll with localStorage + server quote cache (60s). */
export const WL_QUOTE_POLL_MS = WL_CACHE_TTL

export function watchlistQuotesAreFresh(
  lastSuccessAt: number | null | undefined,
  now = Date.now(),
  ttlMs = WL_QUOTE_POLL_MS,
): boolean {
  if (lastSuccessAt == null || lastSuccessAt <= 0) return false
  return now - lastSuccessAt < ttlMs
}

/**
 * Hidden tabs must not hit /batch. Visible tabs refetch when the 60s cache is stale
 * (interval tick or visibility resume).
 */
export function shouldFetchWatchlistQuotes(
  hidden: boolean,
  lastSuccessAt: number | null | undefined,
  now = Date.now(),
  ttlMs = WL_QUOTE_POLL_MS,
): boolean {
  if (hidden) return false
  return !watchlistQuotesAreFresh(lastSuccessAt, now, ttlMs)
}

export function formatQuotesUpdatedAgo(
  lastSuccessAt: number | null | undefined,
  now = Date.now(),
): string | null {
  if (lastSuccessAt == null || lastSuccessAt <= 0) return null
  const s = Math.max(0, Math.floor((now - lastSuccessAt) / 1000))
  if (s < 5) return 'Updated just now'
  if (s < 60) return `Updated ${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `Updated ${m}m ago`
  return 'Updated 1h+ ago'
}
