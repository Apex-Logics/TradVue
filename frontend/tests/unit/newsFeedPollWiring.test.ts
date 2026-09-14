import * as fs from 'fs'
import * as path from 'path'

const APP = path.join(__dirname, '../../app')

function read(rel: string): string {
  return fs.readFileSync(path.join(APP, rel), 'utf-8')
}

describe('Dashboard news feed poll wiring', () => {
  test('polls GET /api/feed/news at 60s, pauses when hidden, resumes if stale', () => {
    const src = read('HomeClient.tsx')
    expect(src).toContain('/api/feed/news')
    expect(src).not.toMatch(/\$\{API_BASE\}\/api\/news[?'"`]/)
    expect(src).toContain('NEWS_POLL_MS')
    expect(src).toContain('shouldFetchNewsFeed')
    const start = src.indexOf('News feed: poll')
    expect(start).toBeGreaterThan(-1)
    const body = src.slice(start, start + 1800)
    expect(body).toContain('document.hidden')
    expect(body).toContain('visibilitychange')
    expect(body).toContain('setInterval(refresh, NEWS_POLL_MS)')
    expect(body).toContain("{ silent: true }")
  })

  test('news fetches go through apiFetchSafe (cache: no-store on success path)', () => {
    const home = read('HomeClient.tsx')
    const fetchStart = home.indexOf('Fetch news')
    const fetchBody = home.slice(fetchStart, fetchStart + 2500)
    expect(fetchBody).toContain('apiFetchSafe')
    expect(fetchBody).toContain('refresh=1')

    const api = read('lib/apiFetch.ts')
    expect(api).toContain("cache: 'no-store'")
  })

  test('news header shows Updated … ago and an honest LIVE/PAUSED badge', () => {
    const src = read('components/NewsFeed.tsx')
    expect(src).toContain('formatNewsUpdatedAgo')
    expect(src).toContain('news-updated')
    expect(src).toContain('newsLive')
    expect(src).toContain('● LIVE')
    expect(src).toContain('○ PAUSED')
    expect(src).not.toContain('hasRealTickerData')
    expect(src).toContain("{ force: true }")
  })
})

describe('/news page poll wiring', () => {
  test('reuses /api/feed/news with visible-tab polling and force refresh', () => {
    const src = read('news/page.tsx')
    expect(src).toContain('/api/feed/news')
    expect(src).toContain('NEWS_POLL_MS')
    expect(src).toContain('shouldFetchNewsFeed')
    expect(src).toContain('visibilitychange')
    expect(src).toContain('document.hidden')
    expect(src).toContain("{ silent: true }")
    expect(src).toContain("{ force: true }")
    expect(src).toContain('refresh=1')
    expect(src).toContain('formatNewsUpdatedAgo')
    expect(src).toContain('● LIVE')
    expect(src).toContain('○ PAUSED')
    expect(src).toContain("category === 'Market Intel'")
  })
})
