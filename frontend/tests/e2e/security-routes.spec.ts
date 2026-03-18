import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL || 'https://www.tradvue.com'

/**
 * Security: Internal routes must be blocked in production.
 *
 * /dashboard and /ops → 308 redirect to / (middleware blocks entirely)
 * /admin → 302 redirect to / for unauthenticated users (middleware auth gate)
 */

test.describe('Internal Route Protection', () => {

  test('/dashboard redirects to home (308) — no flash', async ({ page }) => {
    const response = await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' })
    // Should have been redirected to home
    expect(page.url()).toBe(`${BASE}/`)
    // Should NOT contain any internal dashboard content
    const body = await page.textContent('body')
    expect(body).not.toContain('INTERNAL OPS')
    expect(body).not.toContain('Agent Status')
    expect(body).not.toContain('Backlog')
  })

  test('/ops redirects to home (308) — no flash', async ({ page }) => {
    const response = await page.goto(`${BASE}/ops`, { waitUntil: 'domcontentloaded' })
    expect(page.url()).toBe(`${BASE}/`)
    const body = await page.textContent('body')
    expect(body).not.toContain('INTERNAL OPS')
  })

  test('/admin redirects to home when not authenticated', async ({ page }) => {
    // Clear any cookies to ensure unauthenticated state
    await page.context().clearCookies()
    const response = await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
    expect(page.url()).toBe(`${BASE}/`)
    const body = await page.textContent('body')
    // Should NOT contain admin panel content
    expect(body).not.toContain('Admin Dashboard')
    expect(body).not.toContain('Users')
    expect(body).not.toContain('Feedback')
  })

  test('/dashboard/anything also redirects', async ({ page }) => {
    await page.goto(`${BASE}/dashboard/settings`, { waitUntil: 'domcontentloaded' })
    expect(page.url()).toBe(`${BASE}/`)
  })

  test('/ops/anything also redirects', async ({ page }) => {
    await page.goto(`${BASE}/ops/tasks`, { waitUntil: 'domcontentloaded' })
    expect(page.url()).toBe(`${BASE}/`)
  })
})
