import { expect, test } from '@playwright/test'
import { startDemo } from './helpers'

test.beforeEach(async ({ page }) => {
  await startDemo(page)
  await page.getByRole('button', { name: '+ Create New Batch' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

async function fillBatch(
  page: import('@playwright/test').Page,
  { name, species, harvest, location }: Record<string, string>,
) {
  const dialog = page.getByRole('dialog')
  if (name) await dialog.getByPlaceholder('e.g., Golden Teacher Batch #1').fill(name)
  if (species) await dialog.getByPlaceholder('e.g., Psilocybe cubensis').fill(species)
  if (harvest) await dialog.locator('input[name="expected_harvest_date"]').fill(harvest)
  if (location) await dialog.getByPlaceholder('e.g., Greenhouse Room A').fill(location)
}

test.describe('creating a batch', () => {
  test('saves it, confirms, and opens its (still empty) readings', async ({ page }) => {
    await fillBatch(page, {
      name: 'Enoki-Test-01',
      species: 'Enoki',
      harvest: '2030-01-15',
      location: 'Cold Room',
    })
    await page.getByRole('button', { name: 'Save Entry' }).click()

    await expect(page.getByText('Batch Created')).toBeVisible()
    await expect(page).toHaveURL(/\/batches\/.+\/trackings$/)
    await expect(page.getByText('No logs found for this batch.')).toBeVisible()
  })

  test('the new batch appears on the dashboard as active', async ({ page }) => {
    await fillBatch(page, {
      name: 'Enoki-Test-01',
      species: 'Enoki',
      harvest: '2030-01-15',
      location: 'Cold Room',
    })
    await page.getByRole('button', { name: 'Save Entry' }).click()
    await expect(page).toHaveURL(/\/trackings$/)

    await page.getByRole('link', { name: 'Dashboard' }).click()

    const active = page.getByRole('heading', { name: 'ACTIVE', exact: true }).locator('..')
    await expect(active.locator('span').last()).toHaveText('3')
    await expect(page.getByText('Enoki-Test-01')).toBeVisible()
    await expect(page.getByText('No logs yet.')).toBeVisible()
  })

  test('refuses a name that is already taken, explains why, and keeps the form', async ({
    page,
  }) => {
    await fillBatch(page, {
      name: 'Oyster-Block-01',
      species: 'Oyster',
      harvest: '2030-01-15',
      location: 'Room',
    })
    await page.getByRole('button', { name: 'Save Entry' }).click()

    await expect(page.getByText('Batch name already exists')).toBeVisible()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('asks for the essential fields, including the species', async ({ page }) => {
    await page.getByRole('button', { name: 'Save Entry' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Batch name is required')).toBeVisible()
    await expect(dialog.getByText('Crop type is required')).toBeVisible()
    await expect(dialog.getByText('Expected harvest date is required')).toBeVisible()
    await expect(dialog.getByText('Location is required')).toBeVisible()
  })

  test('cancelling forgets what was typed', async ({ page }) => {
    await fillBatch(page, { name: 'Half-Typed' })

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await page.getByRole('button', { name: '+ Create New Batch' }).click()

    await expect(
      page.getByRole('dialog').getByPlaceholder('e.g., Golden Teacher Batch #1'),
    ).toHaveValue('')
  })

  test('leaving the demo discards the batch', async ({ page }) => {
    await fillBatch(page, {
      name: 'Enoki-Test-01',
      species: 'Enoki',
      harvest: '2030-01-15',
      location: 'Cold Room',
    })
    await page.getByRole('button', { name: 'Save Entry' }).click()
    await expect(page).toHaveURL(/\/trackings$/)

    await page.getByRole('button', { name: 'Exit demo' }).first().click()
    await page.getByRole('button', { name: 'Try the demo' }).click()

    await expect(page.getByRole('heading', { name: 'Cultivation Dashboard' })).toBeVisible()
    await expect(page.getByText('Oyster-Block-01')).toBeVisible()
    await expect(page.getByText('Enoki-Test-01')).toHaveCount(0)
  })
})
