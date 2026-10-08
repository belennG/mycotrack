import { expect, type Page } from '@playwright/test'

/** Enter the demo from the login page and wait for the dashboard. */
export async function startDemo(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Try the demo' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Cultivation Dashboard' })).toBeVisible()
}

/** Open the first batch (Oyster-Block-01) from the dashboard. */
export async function openOysterBatch(page: Page) {
  await page.getByText('Oyster-Block-01').click()
  await expect(page).toHaveURL(/\/batches\/demo-batch-1\/trackings$/)
  await expect(page.getByRole('heading', { name: 'Trackings' })).toBeVisible()
}

/** The visible text of every reading heading, newest first, e.g. "Reading: Oct 8, 2026, 4:09 PM". */
export function readingHeadings(page: Page) {
  return page.getByRole('heading', { name: /^Reading:/ })
}

/**
 * The text of every reading heading currently listed. Waits for the list to load first: reading
 * the headings straight away would see an empty list, and tests on an empty list pass vacuously.
 */
export async function readingTexts(page: Page) {
  const headings = readingHeadings(page)
  await expect(headings.first()).toBeVisible()
  return headings.allTextContents()
}

export interface ReadingInput {
  /** datetime-local value, e.g. 2030-06-15T09:30 */
  when: string
  temperature: string
  humidity?: string
  ph?: string
  moisture?: string
}

/** Add a reading through the "Add New Tracking" form and wait for it to be saved. */
export async function addReading(page: Page, reading: ReadingInput) {
  await page.getByRole('button', { name: '+ Add New Tracking' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await dialog.locator('input[type="datetime-local"]').fill(reading.when)
  await dialog.getByPlaceholder('24.5').fill(reading.temperature)
  await dialog.getByPlaceholder('85.0').fill(reading.humidity ?? '90')
  await dialog.getByPlaceholder('6.5').fill(reading.ph ?? '6.8')
  await dialog.getByPlaceholder('60.0').fill(reading.moisture ?? '80')
  await dialog.getByRole('button', { name: 'Save Log' }).click()

  await expect(dialog).toBeHidden()
}
