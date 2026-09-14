import {
  formatQuotesUpdatedAgo,
  shouldFetchWatchlistQuotes,
  watchlistQuotesAreFresh,
  WL_QUOTE_POLL_MS,
} from '../../app/utils/watchlistQuotePoll'
import { WL_CACHE_TTL } from '../../app/constants'

describe('watchlist quote poll helpers', () => {
  test('poll interval matches the 60s localStorage / server quote cache', () => {
    expect(WL_QUOTE_POLL_MS).toBe(60_000)
    expect(WL_QUOTE_POLL_MS).toBe(WL_CACHE_TTL)
  })

  test('hidden tabs never fetch', () => {
    expect(shouldFetchWatchlistQuotes(true, null)).toBe(false)
    expect(shouldFetchWatchlistQuotes(true, 1)).toBe(false)
  })

  test('visible tab with no prior success should fetch', () => {
    expect(shouldFetchWatchlistQuotes(false, null)).toBe(true)
    expect(shouldFetchWatchlistQuotes(false, 0)).toBe(true)
  })

  test('visible tab skips fetch while the 60s cache is still fresh', () => {
    const now = 1_000_000
    expect(watchlistQuotesAreFresh(now - 10_000, now)).toBe(true)
    expect(shouldFetchWatchlistQuotes(false, now - 10_000, now)).toBe(false)
  })

  test('visible tab fetches once the 60s cache expires (resume-on-focus)', () => {
    const now = 1_000_000
    expect(watchlistQuotesAreFresh(now - 60_000, now)).toBe(false)
    expect(shouldFetchWatchlistQuotes(false, now - 60_000, now)).toBe(true)
    expect(shouldFetchWatchlistQuotes(false, now - 90_000, now)).toBe(true)
  })

  test('formatQuotesUpdatedAgo stays minimal', () => {
    expect(formatQuotesUpdatedAgo(null)).toBeNull()
    expect(formatQuotesUpdatedAgo(0)).toBeNull()
    const now = 10_000_000
    expect(formatQuotesUpdatedAgo(now - 2_000, now)).toBe('Updated just now')
    expect(formatQuotesUpdatedAgo(now - 12_000, now)).toBe('Updated 12s ago')
    expect(formatQuotesUpdatedAgo(now - 125_000, now)).toBe('Updated 2m ago')
    expect(formatQuotesUpdatedAgo(now - 3_700_000, now)).toBe('Updated 1h+ ago')
  })
})
