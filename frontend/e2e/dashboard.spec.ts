import { expect, test, type Page } from '@playwright/test'
import { openOysterBatch, startDemo } from './helpers'

/** The count badge next to a status column's heading. */
const columnCount = (page: Page, status: string) =>
  page.getByRole('heading', { name: status, exact: true }).locator('..').locator('span').last()

test.beforeEach(async ({ page }) => {
  await startDemo(page)
})

test.describe('the dashboard', () => {
  test('lays the sample batches out by status, with counts', async ({ page }) => {
    await expect(columnCount(page, 'ACTIVE')).toHaveText('2')
    await expect(columnCount(page, 'COMPLETED')).toHaveText('1')
    await expect(columnCount(page, 'FAILED')).toHaveText('1')
    await expect(columnCount(page, 'ARCHIVED')).toHaveText('1')

    for (const name of [
      'Oyster-Block-01',
      'Shiitake-Log-07',
      'LionsMane-Bag-03',
      'KingOyster-Trial-02',
      'Reishi-Archive-2025',
    ]) {
      await expect(page.getByText(name)).toBeVisible()
    }
  })

  test('shows the latest reading on each batch card', async ({ page }) => {
    const oyster = page.getByText('Oyster-Block-01').locator('..')

    await expect(oyster.getByText('Latest Log')).toBeVisible()
    await expect(oyster.getByText(/🌡️ [\d.]+ °C/)).toBeVisible()
    await expect(oyster.getByText(/💧 [\d.]+ %/)).toBeVisible()
  })

  test('opens a batch’s readings when its card is clicked', async ({ page }) => {
    await openOysterBatch(page)
  })

  test('offers to add a tracking now that there are batches', async ({ page }) => {
    await expect(page.getByRole('button', { name: '+ Create New Tracking' })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ Create New Batch' })).toBeVisible()
  })

  test('navigates between the dashboard and settings', async ({ page }) => {
    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    await page.getByRole('link', { name: 'Dashboard' }).click()
    await expect(page.getByRole('heading', { name: 'Cultivation Dashboard' })).toBeVisible()
  })
})
