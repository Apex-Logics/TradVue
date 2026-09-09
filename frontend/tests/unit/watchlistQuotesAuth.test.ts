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
