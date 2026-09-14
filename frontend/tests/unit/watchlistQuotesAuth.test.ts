import * as fs from 'fs'
import * as path from 'path'

const APP = path.join(__dirname, '../../app')

function read(rel: string): string {
  return fs.readFileSync(path.join(APP, rel), 'utf-8')
}

describe('Watchlist quote fetch wiring', () => {
  test('single-symbol fallback uses /quote/:symbol not the 404 query form', () => {
    const src = read('HomeClient.tsx')
    expect(src).toContain('/api/market-data/quote/${encodeURIComponent(symbol)}')
    expect(src).not.toContain('/api/market-data/quote?symbol=')
    expect(src).toContain('pricedQuoteMap')
    expect(src).toContain('mergeQuoteRecords')
  })

  test('fetchQuotes does not mark every requested symbol fetched in finally', () => {
    const src = read('HomeClient.tsx')
    const start = src.indexOf('Fetch watchlist quotes (batch, with cache)')
    expect(start).toBeGreaterThan(-1)
    const body = src.slice(start, start + 1800)
    expect(body).toContain('watchlistFetchedRef.current.add(s)')
    expect(body).not.toMatch(/finally \{[\s\S]*toFetch\.forEach\(s => watchlistFetchedRef/)
  })

  test('watchlist quotes poll at 60s, pause when hidden, and resume if cache expired', () => {
    const src = read('HomeClient.tsx')
    expect(src).toContain('visibilitychange')
    expect(src).toContain('document.hidden')
    expect(src).toContain('WL_QUOTE_POLL_MS')
    expect(src).toContain('shouldFetchWatchlistQuotes')
    const start = src.indexOf('Watchlist quotes: poll')
    expect(start).toBeGreaterThan(-1)
    const body = src.slice(start, start + 1600)
    expect(body).not.toContain('30_000')
    expect(body).toContain('setInterval(refresh, WL_QUOTE_POLL_MS)')
  })

  test('apiFetch success path bypasses HTTP cache instead of 5-min read-through', () => {
    const src = read('lib/apiFetch.ts')
    expect(src).toContain("cache: 'no-store'")
    expect(src).toContain('staleTtlMs')
    expect(src).toContain("url.includes('/market-data/')")
    const marker = src.indexOf('// ── Success')
    expect(marker).toBeGreaterThan(-1)
    const success = src.slice(marker, marker + 250)
    expect(success).not.toContain('getCachedData')
    expect(src).toContain('cache.set(url')
  })

  test('watchlist header shows a minimal Updated … ago label', () => {
    const src = read('components/WatchlistPanel.tsx')
    expect(src).toContain('formatQuotesUpdatedAgo')
    expect(src).toContain('watchlist-updated')
    expect(src).toContain('quotesUpdatedAt')
  })
})

describe('PersistentNav sign-in', () => {
  const src = read('components/PersistentNav.tsx')

  test('desktop Sign In calls setShowAuthModal directly (does not rely on #signin alone)', () => {
    expect(src).toMatch(/label:\s*'Sign In'[\s\S]{0,120}onClick:\s*\(\)\s*=>\s*setShowAuthModal\(true\)/)
    expect(src).toContain('if (item.onClick)')
    expect(src).toContain('e.preventDefault()')
  })

  test('logged-out mobile drawer has a Sign In control', () => {
    expect(src).toContain('{!user && (')
    expect(src).toMatch(/setShowAuthModal\(true\);\s*setDrawerOpen\(false\)/)
  })
})

describe('Auth hydrate must not clobber a newer login', () => {
  test('background /me only clears the session if the stored token is still the one it validated', () => {
    const src = read('context/AuthContext.tsx')
    expect(src).toContain('getStoredAuthToken() !== storedToken')
    expect(src).toContain("result.reason === 'auth' && getStoredAuthToken() === storedToken")
  })
})

describe('TickerBar unpriced stubs', () => {
  test('does not treat quote objects without a price as live data', () => {
    const src = read('components/TickerBar.tsx')
    expect(src).toContain('Object.values(tickerQuotes).some(isPricedQuote)')
    expect(src).toContain('isPricedQuote(tickerQuotes[sym])')
  })
})
