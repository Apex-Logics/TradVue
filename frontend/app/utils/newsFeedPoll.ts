import { formatQuotesUpdatedAgo } from './watchlistQuotePoll'

/** Align FE poll with RSS aggregator TTL (60s) + HTTP max-age=60. */
export const NEWS_POLL_MS = 60_000

/** LIVE badge stays honest for one missed tick; not a websocket. */
export const NEWS_LIVE_WINDOW_MS = NEWS_POLL_MS * 2

export function newsFeedIsFresh(
  lastSuccessAt: number | null | undefined,
  now = Date.now(),
  ttlMs = NEWS_POLL_MS,
): boolean {
  if (lastSuccessAt == null || lastSuccessAt <= 0) return false
  return now - lastSuccessAt < ttlMs
}

/**
 * Hidden tabs must not hit /api/feed/news. Visible tabs refetch when the
 * aggregator TTL is stale (interval tick or visibility resume).
 */
export function shouldFetchNewsFeed(
  hidden: boolean,
  lastSuccessAt: number | null | undefined,
  now = Date.now(),
  ttlMs = NEWS_POLL_MS,
): boolean {
  if (hidden) return false
  return !newsFeedIsFresh(lastSuccessAt, now, ttlMs)
}

/** Polling + fresh enough to call the badge LIVE (not a socket). */
export function newsFeedIsLive(
  hidden: boolean,
  lastSuccessAt: number | null | undefined,
  now = Date.now(),
  liveWindowMs = NEWS_LIVE_WINDOW_MS,
): boolean {
  if (hidden) return false
  if (lastSuccessAt == null || lastSuccessAt <= 0) return false
  return now - lastSuccessAt < liveWindowMs
}

export const formatNewsUpdatedAgo = formatQuotesUpdatedAgo
