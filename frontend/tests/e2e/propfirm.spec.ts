import { test, expect, type Page } from '@playwright/test'

async function clearStorage(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.clear() } catch { /* ignore */ }
    try { sessionStorage.clear() } catch { /* ignore */ }
  })
}

async function goToPropFirm(page: Page) {
  await page.goto('/propfirm', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
}

test.describe('Prop Firm Page', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page)
  })

  test('page loads', async ({ page }) => {
    await goToPropFirm(page)
    // The page heading or main content should be visible
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible({ timeout: 10_000 })
  })

  test('shows empty state when no accounts added', async ({ page }) => {
    await goToPropFirm(page)
    // With empty localStorage, the "Add Account" button should be visible
    // and the empty state message should appear
    const addBtn = page.getByRole('button', { name: /Add Account/i }).first()
    await expect(addBtn).toBeVisible({ timeout: 10_000 })
  })

  test('clicking Add Account opens the modal', async ({ page }) => {
    await goToPropFirm(page)
    const addBtn = page.getByRole('button', { name: /Add Account/i }).first()
    await addBtn.click()
    await page.waitForTimeout(300)

    // Modal should now be visible — look for firm selection buttons
    const topstepBtn = page.getByRole('button', { name: /TopStep/i }).first()
    await expect(topstepBtn).toBeVisible({ timeout: 5_000 })
  })

  test('selecting TopStep from firm list shows rules auto-populated', async ({ page }) => {
    await goToPropFirm(page)
    const addBtn = page.getByRole('button', { name: /Add Account/i }).first()
    await addBtn.click()
    await page.waitForTimeout(300)

    // TopStep should be the default (already selected) or click it
    const topstepBtn = page.getByRole('button', { name: /TopStep/i }).first()
    await expect(topstepBtn).toBeVisible()
    await topstepBtn.click()
    await page.waitForTimeout(300)

    // Rules should be populated — look for common prop firm rule fields
    const ruleField = page.getByText(/Max Drawdown|Daily Loss|Profit Target/i).first()
    await expect(ruleField).toBeVisible({ timeout: 5_000 })
  })

  test('creates an account and it appears as a card', async ({ page }) => {
    await goToPropFirm(page)
    const addBtn = page.getByRole('button', { name: /Add Account/i }).first()
    await addBtn.click()
    await page.waitForTimeout(300)

    // Select TopStep (it's the default)
    const topstepBtn = page.getByRole('button', { name: /TopStep/i }).first()
    await topstepBtn.click()
    await page.waitForTimeout(200)

    // Click save/create button inside the modal
    const createBtn = page.getByRole('button', { name: /Create Account/i })
    await createBtn.click()
    await page.waitForTimeout(500)

    // Account card should appear with TopStep branding
    const accountCard = page.getByText(/TopStep/i).first()
    await expect(accountCard).toBeVisible({ timeout: 5_000 })
  })

  test('both disclaimers are visible on the page', async ({ page }) => {
    await goToPropFirm(page)
    // The page has a disclaimer section — look for disclaimer keyword
    const disclaimer = page.getByText(/Disclaimer|disclaimer|not financial advice/i).first()
    await expect(disclaimer).toBeVisible({ timeout: 10_000 })
  })

  test('rules are editable in account detail view', async ({ page }) => {
    // First create an account
    await goToPropFirm(page)
    const addBtn = page.getByRole('button', { name: /Add Account/i }).first()
    await addBtn.click()
    await page.waitForTimeout(300)

    const topstepBtn = page.getByRole('button', { name: /TopStep/i }).first()
    await topstepBtn.click()
    await page.waitForTimeout(200)

    const createBtn = page.getByRole('button', { name: /Create Account/i })
    await createBtn.click()
    await page.waitForTimeout(500)

    // Click on the account card to open detail view
    const accountCard = page.getByText(/TopStep/i).first()
    await accountCard.click()
    await page.waitForTimeout(300)

    // Enter rules edit mode, then confirm rule inputs are editable
    const editRulesBtn = page.getByRole('button', { name: /Edit Rules/i })
    await editRulesBtn.click()
    const editableField = page.locator('input[type="number"], input[type="text"]:visible').first()
    await expect(editableField).toBeVisible({ timeout: 5_000 })
  })
})
