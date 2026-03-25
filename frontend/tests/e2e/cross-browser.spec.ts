/**
 * Cross-browser smoke test — verifies core pages load and render key elements
 * in Chromium, Firefox, and WebKit (Safari engine).
 *
 * Run: npx playwright test tests/e2e/cross-browser.spec.ts
 */
import { test, expect } from '@playwright/test'

const BASE = 'https://www.tradvue.com'

const PAGES = [
  { path: '/', name: 'Home', expect: 'TradVue' },
  { path: '/journal', name: 'Journal', expect: 'journal' },
  { path: '/pricing', name: 'Pricing', expect: 'Pro' },
  { path: '/help', name: 'Help', expect: 'help' },
  { path: '/tools', name: 'Tools', expect: 'calculator' },
  { path: '/calendar', name: 'Calendar', expect: 'calendar' },
]

for (const page of PAGES) {
  test(`${page.name} loads and renders (${page.path})`, async ({ page: p }) => {
    const res = await p.goto(`${BASE}${page.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    expect(res?.status()).toBeLessThan(400)

    // Page should have content
    const body = await p.textContent('body')
    expect(body?.toLowerCase()).toContain(page.expect.toLowerCase())

    // No uncaught JS errors (check console)
    const errors: string[] = []
    p.on('pageerror', (err) => errors.push(err.message))
    await p.waitForTimeout(2000)
    expect(errors.length).toBe(0)
  })
}
