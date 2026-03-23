/**
 * portfolio-import.spec.ts
 * E2E tests for Portfolio CSV Import feature
 *
 * Tests the "Import CSV" button and modal in the Holdings tab.
 * Requires the dev server to be running on http://localhost:3000
 */

import { test, expect, Page } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Navigate to portfolio holdings tab */
async function goToHoldings(page: Page) {
  await page.goto('/portfolio')
  // Click on Holdings tab
  await page.getByRole('button', { name: /Holdings/i }).click()
  await page.waitForTimeout(300)
}

/** Create a temporary CSV file with given content and return its path */
function createTempCSV(content: string): string {
  const tmpDir = os.tmpdir()
  const tmpFile = path.join(tmpDir, `portfolio-test-${Date.now()}.csv`)
  fs.writeFileSync(tmpFile, content, 'utf-8')
  return tmpFile
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Portfolio Import — button and modal', () => {
  test('Import CSV button exists in Holdings tab', async ({ page }) => {
    await goToHoldings(page)
    const importBtn = page.getByTestId('import-csv-button')
    await expect(importBtn).toBeVisible()
    await expect(importBtn).toHaveText(/Import CSV/i)
  })

  test('Import CSV modal opens when button is clicked', async ({ page }) => {
    await goToHoldings(page)
    await page.getByTestId('import-csv-button').click()
    // Modal title should appear
    await expect(page.getByText('Import Portfolio Holdings')).toBeVisible()
  })

  test('Modal closes when X button is clicked', async ({ page }) => {
    await goToHoldings(page)
    await page.getByTestId('import-csv-button').click()
    await expect(page.getByText('Import Portfolio Holdings')).toBeVisible()
    // Click X to close
    await page.getByRole('button', { name: '✕' }).click()
    await expect(page.getByText('Import Portfolio Holdings')).not.toBeVisible()
  })

  test('Valid generic CSV imports successfully — shows preview table', async ({ page }) => {
    const csvContent = `Symbol,Shares,CostBasis,DateAcquired,Sector,Notes
AAPL,10,150.00,2024-01-15,Information Technology,Test import
MSFT,5,300.00,2024-02-20,Information Technology,Test
`
    const csvPath = createTempCSV(csvContent)

    await goToHoldings(page)
    await page.getByTestId('import-csv-button').click()

    // Upload the file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(csvPath)
    await page.waitForTimeout(200)

    // Click Parse & Preview
    await page.getByTestId('parse-csv-button').click()
    await page.waitForTimeout(400)

    // Preview step should show the holdings
    await expect(page.getByText(/2 holding/i).first()).toBeVisible()
    await expect(page.getByText('AAPL').first()).toBeVisible()
    await expect(page.getByText('MSFT').first()).toBeVisible()

    // Clean up
    fs.unlinkSync(csvPath)
  })

  test('Import preview shows correct data from CSV', async ({ page }) => {
    const csvContent = `Symbol,Shares,CostBasis
KO,100,55.50
`
    const csvPath = createTempCSV(csvContent)

    await goToHoldings(page)
    await page.getByTestId('import-csv-button').click()

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(csvPath)
    await page.getByTestId('parse-csv-button').click()
    await page.waitForTimeout(400)

    await expect(page.getByText('KO').first()).toBeVisible()
    // Should show shares count
    await expect(page.getByText('100').first()).toBeVisible()

    fs.unlinkSync(csvPath)
  })

  test('Import button triggers actual import — holdings appear in table', async ({ page }) => {
    // Clear any existing localStorage state
    await page.goto('/portfolio')
    await page.evaluate(() => {
      localStorage.removeItem('cg_portfolio_holdings')
    })
    await page.reload()

    await page.getByRole('button', { name: /Holdings/i }).click()
    await page.waitForTimeout(300)

    const csvContent = `Symbol,Shares,CostBasis,DateAcquired
TSLA,5,200.00,2024-03-01
`
    const csvPath = createTempCSV(csvContent)

    await page.getByTestId('import-csv-button').click()

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(csvPath)
    await page.getByTestId('parse-csv-button').click()
    await page.waitForTimeout(400)

    // Confirm the import
    await page.getByTestId('confirm-import-button').click()
    await page.waitForTimeout(500)

    // TSLA should now appear in the holdings table
    await expect(page.getByText('TSLA').first()).toBeVisible()

    fs.unlinkSync(csvPath)
  })
})
