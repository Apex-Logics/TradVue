import {
  NEWS_LIVE_WINDOW_MS,
  NEWS_POLL_MS,
  formatNewsUpdatedAgo,
  newsFeedIsFresh,
  newsFeedIsLive,
  shouldFetchNewsFeed,
} from '../../app/utils/newsFeedPoll'

describe('news feed poll helpers', () => {
  test('poll interval is 60s to match the RSS aggregator TTL', () => {
    expect(NEWS_POLL_MS).toBe(60_000)
    expect(NEWS_LIVE_WINDOW_MS).toBe(120_000)
  })

  test('hidden tabs never fetch', () => {
    expect(shouldFetchNewsFeed(true, null)).toBe(false)
    expect(shouldFetchNewsFeed(true, 1)).toBe(false)
  })

  test('visible tab with no prior success should fetch', () => {
    expect(shouldFetchNewsFeed(false, null)).toBe(true)
    expect(shouldFetchNewsFeed(false, 0)).toBe(true)
  })

  test('visible tab skips fetch while the 60s cache is still fresh', () => {
    const now = 1_000_000
    expect(newsFeedIsFresh(now - 10_000, now)).toBe(true)
    expect(shouldFetchNewsFeed(false, now - 10_000, now)).toBe(false)
  })

  test('visible tab fetches once the 60s cache expires (resume-on-focus)', () => {
    const now = 1_000_000
    expect(newsFeedIsFresh(now - 60_000, now)).toBe(false)
    expect(shouldFetchNewsFeed(false, now - 60_000, now)).toBe(true)
    expect(shouldFetchNewsFeed(false, now - 90_000, now)).toBe(true)
  })

  test('LIVE badge is honest: visible + fresh within 2x poll window, not a websocket', () => {
    const now = 1_000_000
    expect(newsFeedIsLive(true, now - 1_000, now)).toBe(false)
    expect(newsFeedIsLive(false, null, now)).toBe(false)
    expect(newsFeedIsLive(false, now - 30_000, now)).toBe(true)
    expect(newsFeedIsLive(false, now - 119_000, now)).toBe(true)
    expect(newsFeedIsLive(false, now - 120_000, now)).toBe(false)
  })

  test('formatNewsUpdatedAgo stays minimal', () => {
    expect(formatNewsUpdatedAgo(null)).toBeNull()
    expect(formatNewsUpdatedAgo(0)).toBeNull()
    const now = 10_000_000
    expect(formatNewsUpdatedAgo(now - 2_000, now)).toBe('Updated just now')
    expect(formatNewsUpdatedAgo(now - 12_000, now)).toBe('Updated 12s ago')
    expect(formatNewsUpdatedAgo(now - 125_000, now)).toBe('Updated 2m ago')
    expect(formatNewsUpdatedAgo(now - 3_700_000, now)).toBe('Updated 1h+ ago')
  })
})
