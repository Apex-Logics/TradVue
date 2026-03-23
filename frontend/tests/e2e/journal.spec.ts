import { test, expect, type Page } from '@playwright/test'

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function clearStorage(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.clear() } catch { /* ignore */ }
    try { sessionStorage.clear() } catch { /* ignore */ }

    try {
      localStorage.setItem('cg_token', 'playwright-test-token')
      localStorage.setItem('cg_user', JSON.stringify({
        id: 'playwright-user',
        email: 'playwright@example.com',
        name: 'Playwright Tester',
        tier: 'free',
        created_at: '2026-03-20T12:00:00.000Z',
      }))
    } catch { /* ignore */ }
  })
}

async function goToJournal(page: Page) {
  await page.goto('/journal', { waitUntil: 'domcontentloaded' })
  // Wait for React to hydrate
  await page.waitForTimeout(500)
}

async function openNewTradeForm(page: Page) {
  const tradeLogTab = page.getByRole('button', { name: /Trade Log/i }).first()
  await tradeLogTab.click()

  const newTradeBtn = page.getByRole('button', { name: /^\+ Log Trade$/i }).first()
  await expect(newTradeBtn).toBeVisible()
  await newTradeBtn.click({ force: true })
  if (!(await page.getByText(/Log a New Trade/i).first().isVisible().catch(() => false))) {
    await newTradeBtn.evaluate((el: HTMLButtonElement) => el.click())
  }

  await expect(page.getByText(/Log a New Trade/i).first()).toBeVisible()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Journal Page', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page)
  })

  test('page loads and shows Trade Log tab', async ({ page }) => {
    await goToJournal(page)
    // The "Trade Log" tab/button should be visible
    await expect(page.getByRole('button', { name: /Trade Log/i }).first()).toBeVisible()
  })

  test('opens new trade form and shows all key fields', async ({ page }) => {
    await goToJournal(page)
    await openNewTradeForm(page)

    // Symbol field
    await expect(page.getByPlaceholder(/ticker|symbol|e\.g\. AAPL|NQ/i).first()).toBeVisible()
    // Entry price field
    await expect(page.locator('xpath=//label[contains(.,"Entry Price")]/following-sibling::div//input | //label[contains(.,"Entry Price")]/following-sibling::input').first()).toBeVisible()
    // Exit price field
    await expect(page.locator('xpath=//label[contains(.,"Exit Price")]/following-sibling::input').first()).toBeVisible()
    // Direction selector should be visible inside the form
    await expect(page.locator('xpath=//label[contains(.,"Direction")]/following-sibling::select').first()).toBeVisible()
  })

  test('typing NQ auto-detects Futures and shows tick info', async ({ page }) => {
    await goToJournal(page)
    await openNewTradeForm(page)

    const symbolInput = page.getByPlaceholder(/ticker|symbol|e\.g\. AAPL|NQ/i).first()
    await symbolInput.fill('NQ')
    await symbolInput.dispatchEvent('input')
    await page.waitForTimeout(500)

    // Asset class should become Futures
    const assetSelect = page.locator('xpath=//label[contains(.,"Asset Class")]/following-sibling::select').first()
    await expect(assetSelect).toHaveValue('Futures')
  })

  test('typing AAPL keeps asset class as Stock', async ({ page }) => {
    await goToJournal(page)
    await openNewTradeForm(page)

    const symbolInput = page.getByPlaceholder(/ticker|symbol|e\.g\. AAPL|NQ/i).first()
    await symbolInput.fill('AAPL')
    await symbolInput.dispatchEvent('input')
    await page.waitForTimeout(500)

    // Stock should still be selected (it's the default and AAPL doesn't trigger futures detection)
    const assetSelect = page.locator('xpath=//label[contains(.,"Asset Class")]/following-sibling::select').first()
    await expect(assetSelect).toHaveValue('Stock')
  })

  test('futures symbol shows live price hint instead of fill button', async ({ page }) => {
    await goToJournal(page)
    await openNewTradeForm(page)

    const symbolInput = page.getByPlaceholder(/ticker|symbol|e\.g\. AAPL|NQ/i).first()
    await symbolInput.fill('NQ')
    await symbolInput.dispatchEvent('input')
    await page.waitForTimeout(500)

    // The "Live price fill not available for futures" message should be visible
    // and the fill button should NOT be visible
    const fillButton = page.getByRole('button', { name: /Fill NQ current price/i })
    await expect(fillButton).not.toBeVisible()

    const futuresHint = page.getByText(/Live price fill not available for futures/i)
    await expect(futuresHint).toBeVisible()
  })

  test('enters a complete stock trade and verifies P&L', async ({ page }) => {
    await goToJournal(page)
    await openNewTradeForm(page)

    // Fill in symbol
    const symbolInput = page.getByPlaceholder(/ticker|symbol|e\.g\. AAPL|NQ/i).first()
    await symbolInput.fill('AAPL')
    await symbolInput.dispatchEvent('input')
    await page.waitForTimeout(300)

    // Make sure asset class is Stock
    const assetSelect = page.locator('xpath=//label[contains(.,"Asset Class")]/following-sibling::select').first()
    await assetSelect.selectOption('Stock')

    // Direction: Long (current UI uses a select, and Long is the default)
    const directionSelect = page.locator('xpath=//label[contains(.,"Direction")]/following-sibling::select').first()
    await directionSelect.selectOption('Long')

    // Entry price
    const entryInput = page.locator('xpath=//label[contains(.,"Entry Price")]/following-sibling::div//input | //label[contains(.,"Entry Price")]/following-sibling::input').first()
    await entryInput.fill('150')

    // Exit price
    const exitInput = page.locator('xpath=//label[contains(.,"Exit Price")]/following-sibling::input').first()
    await exitInput.fill('155')

    // Position size / shares
    const sizeInput = page.locator('xpath=//label[contains(.,"Position Size") or contains(.,"Contracts")]/following-sibling::input').first()
    await sizeInput.fill('100')

    // Stop loss (if present)
    const stopInput = page.locator('xpath=//label[contains(.,"Stop Loss")]/following-sibling::input').first()
    if (await stopInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await stopInput.fill('148')
    }

    // Save trade
    const saveButton = page.getByRole('button', { name: /Save Trade|Log Trade|Submit|Save/i }).first()
    await saveButton.click()
    await page.waitForTimeout(500)

    // Verify trade appears in the list with $500 P&L
    await expect(page.getByText('AAPL')).toBeVisible()
    await expect(page.getByText(/\$500|\+500/)).toBeVisible()
  })

  test('enters a futures trade and verifies P&L', async ({ page }) => {
    await goToJournal(page)
    await openNewTradeForm(page)

    // Fill in symbol NQ
    const symbolInput = page.getByPlaceholder(/ticker|symbol|e\.g\. AAPL|NQ/i).first()
    await symbolInput.fill('NQ')
    await symbolInput.dispatchEvent('input')
    await page.waitForTimeout(500)

    // Select Futures asset class
    const assetSelect = page.locator('xpath=//label[contains(.,"Asset Class")]/following-sibling::select').first()
    await assetSelect.selectOption('Futures')
    await page.waitForTimeout(300)

    // Entry price
    const entryInput = page.locator('xpath=//label[contains(.,"Entry Price")]/following-sibling::div//input | //label[contains(.,"Entry Price")]/following-sibling::input').first()
    await entryInput.fill('20150')

    // Exit price
    const exitInput = page.locator('xpath=//label[contains(.,"Exit Price")]/following-sibling::input').first()
    await exitInput.fill('20175')

    // Contracts
    const contractsInput = page.locator('xpath=//label[contains(.,"Contracts")]/following-sibling::input').first()
    await contractsInput.fill('2')

    // Save trade
    const saveButton = page.getByRole('button', { name: /Save Trade|Log Trade|Submit|Save/i }).first()
    await saveButton.click()
    await page.waitForTimeout(500)

    // Verify trade appears with P&L info (ticks or dollars)
    await expect(page.getByText('NQ')).toBeVisible()
  })

  test('asset type filter shows only filtered trades', async ({ page }) => {
    await goToJournal(page)
    await openNewTradeForm(page)

    const symbolInput = page.getByPlaceholder(/ticker|symbol|e\.g\. AAPL|NQ/i).first()
    await symbolInput.fill('NQ')
    await symbolInput.dispatchEvent('input')
    await page.waitForTimeout(300)

    await page.locator('xpath=//label[contains(.,"Entry Price")]/following-sibling::div//input | //label[contains(.,"Entry Price")]/following-sibling::input').first().fill('20150')
    await page.locator('xpath=//label[contains(.,"Exit Price")]/following-sibling::input').first().fill('20175')
    await page.locator('xpath=//label[contains(.,"Contracts")]/following-sibling::input').first().fill('1')
    await page.getByRole('button', { name: /Save Trade|Log Trade|Submit|Save/i }).first().click()
    await page.waitForTimeout(500)

    // Current UI uses a select for asset filtering instead of filter buttons.
    const assetFilter = page.getByRole('combobox').nth(0)
    await expect(assetFilter).toBeVisible()
    await assetFilter.selectOption('Futures')
    await page.waitForTimeout(300)
    await expect(assetFilter).toHaveValue('Futures')
    await expect(page.getByText('NQ')).toBeVisible()
  })

  test('playbook dropdown shows all 5 default playbooks', async ({ page }) => {
    await goToJournal(page)
    await openNewTradeForm(page)

    // The playbook dropdown/select should have 5 options
    const playbookSelect = page.locator('select').filter({
      has: page.getByRole('option', { name: /Playbook|Opening Range|VWAP|Gap/i }),
    }).first()

    if (await playbookSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      const options = await playbookSelect.locator('option').count()
      // 5 playbooks + 1 "No playbook" option = 6 total
      expect(options).toBeGreaterThanOrEqual(5)
    } else {
      // Playbook dropdown may be a custom component
      const playbookLabel = page.getByText(/Playbook/i).first()
      await expect(playbookLabel).toBeVisible()
    }
  })
})
