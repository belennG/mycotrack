import { expect, test } from '@playwright/test'
import { startDemo } from './helpers'

test.describe('getting in without an account', () => {
  test('a signed-out visitor is sent to the login page, whichever page they ask for', async ({
    page,
  }) => {
    for (const path of ['/dashboard', '/settings', '/batches/demo-batch-1/trackings']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByRole('button', { name: 'Try the demo' })).toBeVisible()
    }
  })

  test('login is unavailable here, but the demo is one click away', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('button', { name: 'Log in' })).toBeDisabled()
    await expect(page.getByText('Login is not configured in this environment.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try the demo' })).toBeEnabled()
  })

  test('the demo opens a populated dashboard and says it is a demo', async ({ page }) => {
    await startDemo(page)

    await expect(page.getByRole('status')).toContainText('Demo mode')
    await expect(page.getByText('Demo User')).toBeVisible()
    await expect(page.getByTestId('organization')).toHaveText('Demo Farm · Owner')
  })

  test('the demo survives a reload', async ({ page }) => {
    await startDemo(page)

    await page.reload()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: 'Cultivation Dashboard' })).toBeVisible()
  })

  test('a page can be opened directly once inside the demo', async ({ page }) => {
    await startDemo(page)

    await page.goto('/batches/demo-batch-1/trackings')

    await expect(page.getByRole('heading', { name: 'Trackings' })).toBeVisible()
  })

  test('leaving the demo returns to the login page and locks the app again', async ({ page }) => {
    await startDemo(page)

    await page.getByRole('button', { name: 'Exit demo' }).first().click()
    await expect(page).toHaveURL(/\/login$/)

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
  })

  test('two visitors never share demo data', async ({ browser }) => {
    const first = await browser.newPage()
    const second = await browser.newPage()
    await startDemo(first)
    await startDemo(second)

    await first.getByRole('button', { name: '+ Create New Batch' }).click()
    await first.getByPlaceholder('e.g., Golden Teacher Batch #1').fill('Only-Mine')
    await first.getByPlaceholder('e.g., Psilocybe cubensis').fill('Reishi')
    await first.locator('input[name="expected_harvest_date"]').fill('2030-01-01')
    await first.getByPlaceholder('e.g., Greenhouse Room A').fill('Shelf')
    await first.getByRole('button', { name: 'Save Entry' }).click()
    await expect(first).toHaveURL(/\/trackings$/)

    await second.goto('/dashboard')
    await expect(second.getByText('Only-Mine')).toHaveCount(0)
    await first.close()
    await second.close()
  })
})
