import { test, expect, type Page } from '@playwright/test'

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function goToRules(page: Page) {
  await page.goto('/rules', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Trading Rules Page', () => {

  test('page loads and shows Trading Rules heading', async ({ page }) => {
    await goToRules(page)
    const heading = page.getByRole('heading', { name: /Trading Rules/i })
    await expect(heading).toBeVisible()
  })

  test('disclaimer is present', async ({ page }) => {
    await goToRules(page)
    const disclaimer = page.getByTestId('disclaimer')
    await expect(disclaimer).toBeVisible()
    await expect(disclaimer).toContainText('self-accountability only')
    await expect(disclaimer).toContainText('TradVue does not enforce')
  })

  test('default rules are shown on first load', async ({ page }) => {
    // Clear localStorage so defaults are seeded
    await page.addInitScript(() => {
      try { localStorage.removeItem('cg_rulecop') } catch { /* ignore */ }
    })
    await goToRules(page)
    const cards = page.getByTestId('rule-card')
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('toggle rule on/off works', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.removeItem('cg_rulecop') } catch { /* ignore */ }
    })
    await goToRules(page)
    // Find first toggle switch
    const toggle = page.getByRole('switch').first()
    const initialChecked = await toggle.getAttribute('aria-checked')
    await toggle.click()
    await page.waitForTimeout(300)
    const newChecked = await toggle.getAttribute('aria-checked')
    expect(newChecked).not.toBe(initialChecked)
  })

  test('can edit threshold value', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.removeItem('cg_rulecop') } catch { /* ignore */ }
    })
    await goToRules(page)
    // Click the threshold value button on first card
    const thresholdBtn = page.getByTestId('threshold-value').first()
    await expect(thresholdBtn).toBeVisible()
    await thresholdBtn.click()
    // An input should appear
    const input = page.getByLabel('Edit threshold').first()
    await expect(input).toBeVisible()
    await input.fill('10')
    await input.press('Enter')
    await page.waitForTimeout(300)
    // The button should now show the new value
    const updatedBtn = page.getByTestId('threshold-value').first()
    await expect(updatedBtn).toContainText('10')
  })

  test('"+ Add Custom Rule" button opens the add rule modal', async ({ page }) => {
    await goToRules(page)
    const addBtn = page.getByTestId('add-rule-btn')
    await expect(addBtn).toBeVisible()
    await addBtn.click()
    await page.waitForTimeout(300)
    const modal = page.getByRole('heading', { name: /Add Custom Rule/i })
    await expect(modal).toBeVisible()
  })

  test('today summary section is visible', async ({ page }) => {
    await goToRules(page)
    const summaryText = page.getByText(/rules followed today/i)
    await expect(summaryText).toBeVisible()
  })

  test('"Rules" nav section appears in navigation', async ({ page }) => {
    await goToRules(page)
    const tradingMenu = page.getByRole('button', { name: /Trading/i })
    await expect(tradingMenu).toBeVisible()
  })

})
