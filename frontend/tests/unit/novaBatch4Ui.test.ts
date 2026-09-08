import * as fs from 'fs'
import * as path from 'path'
import { isAttributionHref } from '../../app/help/attribution'

const APP = path.join(__dirname, '../../app')

function read(rel: string): string {
  return fs.readFileSync(path.join(APP, rel), 'utf-8')
}

describe('Nova Batch 4 — help attribution', () => {
  test('empty and hash URLs are not treated as attribution links', () => {
    expect(isAttributionHref('#')).toBe(false)
    expect(isAttributionHref('')).toBe(false)
    expect(isAttributionHref('   ')).toBe(false)
    expect(isAttributionHref(undefined)).toBe(false)
    expect(isAttributionHref('https://newsapi.org')).toBe(true)
  })

  test('RSS Feeds is not a hash / empty-href link', () => {
    const src = read('help/HelpClient.tsx')
    expect(src).toContain("name: 'RSS Feeds'")
    expect(src).not.toMatch(/name:\s*'RSS Feeds'[\s\S]{0,80}url:\s*'#'/)
    expect(src).toContain('isAttributionHref(source.url)')
    expect(src).toContain('<span')
  })
})

describe('Nova Batch 4 — dashboard shell', () => {
  test('Market Intel live tool is placed in the center col-news column', () => {
    const src = read('HomeClient.tsx')
    const start = src.indexOf("activeNav === 'Market Intel'")
    expect(start).toBeGreaterThan(-1)
    const intelBlock = src.slice(start, start + 500)
    expect(intelBlock).toContain('className="col-news"')
    expect(intelBlock).toContain('<MarketIntel')
  })

  test('phone-width CSS stacks the dashboard into a single column', () => {
    const css = read('globals.css')
    expect(css).toMatch(/PHONE \(≤480px\) — single-column dashboard shell/)
    const phoneBlock = css.slice(css.indexOf('PHONE (≤480px)'))
    expect(phoneBlock).toMatch(/flex-direction:\s*column\s*!important/)
    expect(phoneBlock).toMatch(/\.col-news/)
    expect(phoneBlock).toMatch(/order:\s*1/)
  })

  test('onboarding checklist and modal sheets use shared FAB clearance', () => {
    const css = read('globals.css')
    expect(css).toMatch(/\.onboarding-checklist[\s\S]{0,120}bottom:\s*var\(--tv-fab-clearance\)/)
    expect(css).toContain('.tv-fab-clear-block')
    expect(css).toContain('.tv-fab-clear-modal')
    expect(read('propfirm/page.tsx')).toContain('tv-fab-clear-modal')
    expect(read('help/HelpClient.tsx')).toContain('tv-fab-clear-block')
  })
})

describe('Nova Batch 4 — SEO FAQ accordion', () => {
  const landers = [
    'best-trading-journal/page.tsx',
    'futures-trading-journal/page.tsx',
    'prop-firm-tracker/page.tsx',
    'trading-calculators/page.tsx',
    'options-trading-journal/page.tsx',
    'post-trade-ritual/page.tsx',
    'market-intel/page.tsx',
  ]

  test.each(landers)('%s uses SeoFaqAccordion instead of always-open + rows', (rel) => {
    const src = read(rel)
    expect(src).toContain('SeoFaqAccordion')
    expect(src).not.toContain('seo-faq-q-icon')
  })
})
