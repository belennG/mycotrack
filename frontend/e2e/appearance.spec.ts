import { expect, test } from '@playwright/test'
import { startDemo } from './helpers'

test.describe('dark mode', () => {
  test('switches on and off, and is remembered across a reload', async ({ page }) => {
    await startDemo(page)
    const html = page.locator('html')

    await page.getByRole('button', { name: /dark/i }).click()
    await expect(html).toHaveClass(/dark/)

    await page.reload()
    await expect(html).toHaveClass(/dark/)
    await expect(page.getByRole('button', { name: /light/i })).toBeVisible()

    await page.getByRole('button', { name: /light/i }).click()
    await expect(html).not.toHaveClass(/dark/)
  })
})
