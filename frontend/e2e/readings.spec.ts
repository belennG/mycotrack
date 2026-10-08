import { expect, test } from '@playwright/test'
import { addReading, openOysterBatch, readingHeadings, readingTexts, startDemo } from './helpers'

test.beforeEach(async ({ page }) => {
  await startDemo(page)
  await openOysterBatch(page)
})

/** "Reading: Oct 8, 2026, 4:09 PM" -> a timestamp, so order can be asserted without caring about format. */
const toTime = (heading: string) => Date.parse(heading.replace('Reading: ', ''))

test.describe('readings with a time of day', () => {
  test('every reading shows its date and time', async ({ page }) => {
    const headings = await readingTexts(page)

    expect(headings).toHaveLength(10) // a full first page
    for (const heading of headings) {
      expect(heading).toMatch(/^Reading: [A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} (AM|PM)$/)
    }
  })

  test('the sample data has several readings on the same day, each at its own time', async ({
    page,
  }) => {
    const headings = await readingTexts(page)

    const timesByDay = new Map<string, string[]>()
    for (const heading of headings) {
      const [, day, time] = /^Reading: (.*), (\d{1,2}:\d{2} [AP]M)$/.exec(heading)!
      timesByDay.set(day, [...(timesByDay.get(day) ?? []), time])
    }

    const crowdedDay = [...timesByDay.values()].find((times) => times.length >= 2)
    expect(crowdedDay, 'a day with two or more readings').toBeDefined()
    expect(new Set(crowdedDay).size).toBe(crowdedDay!.length) // each at a different time
  })

  test('are listed newest first', async ({ page }) => {
    const times = (await readingTexts(page)).map(toTime)

    expect(times.length).toBeGreaterThan(1)
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })

  test('readings entered out of order are listed by when they were taken', async ({ page }) => {
    await addReading(page, { when: '2030-06-15T18:00', temperature: '25.1' })
    await addReading(page, { when: '2030-06-15T07:15', temperature: '19.4' })
    await addReading(page, { when: '2030-06-15T09:30', temperature: '22.2' })

    const headings = readingHeadings(page)
    await expect(headings.nth(0)).toHaveText('Reading: Jun 15, 2030, 6:00 PM')
    await expect(headings.nth(1)).toHaveText('Reading: Jun 15, 2030, 9:30 AM')
    await expect(headings.nth(2)).toHaveText('Reading: Jun 15, 2030, 7:15 AM')
  })

  test('the dashboard’s latest reading is the most recent one taken, not the last one entered', async ({
    page,
  }) => {
    await addReading(page, { when: '2030-06-15T18:00', temperature: '31.5' })
    // Entered afterwards, but taken earlier: must not replace the latest.
    await addReading(page, { when: '2030-06-15T06:00', temperature: '17.5' })

    await page.getByRole('link', { name: 'Dashboard' }).click()

    const oyster = page.getByText('Oyster-Block-01').locator('..')
    await expect(oyster.getByText('🌡️ 31.5 °C')).toBeVisible()
    await expect(oyster.getByText('🌡️ 17.5 °C')).toHaveCount(0)
  })
})

test.describe('adding a reading', () => {
  test('confirms with a message and shows the new reading', async ({ page }) => {
    await addReading(page, { when: '2030-06-15T09:30', temperature: '22.2' })

    await expect(page.getByText('Tracking Created')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Reading: Jun 15, 2030, 9:30 AM' }),
    ).toBeVisible()
  })

  test('asks for every measurement before saving', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add New Tracking' }).click()
    await page.getByRole('button', { name: 'Save Log' }).click()

    await expect(page.getByText('Temperature is required')).toBeVisible()
    await expect(page.getByText('Humidity is required')).toBeVisible()
    await expect(page.getByText('pH level is required')).toBeVisible()
    await expect(page.getByText('Moisture is required')).toBeVisible()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('rejects values outside the physical range', async ({ page }) => {
    const dialogOpen = page.getByRole('button', { name: '+ Add New Tracking' })
    await dialogOpen.click()
    const dialog = page.getByRole('dialog')

    await dialog.getByPlaceholder('24.5').fill('150')
    await dialog.getByPlaceholder('85.0').fill('-5')
    await dialog.getByPlaceholder('6.5').fill('15')
    await dialog.getByPlaceholder('60.0').fill('101')
    await dialog.getByRole('button', { name: 'Save Log' }).click()

    await expect(dialog.getByText('Cannot exceed 100')).toHaveCount(2)
    await expect(dialog.getByText('Must be at least 0')).toBeVisible()
    await expect(dialog.getByText('Cannot exceed 14')).toBeVisible()
  })

  test('pages through a long history ten readings at a time', async ({ page }) => {
    await expect(page.getByText('Page 1 of 2')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled()
    await expect(readingHeadings(page)).toHaveCount(10)

    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByText('Page 2 of 2')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
    await expect(readingHeadings(page)).not.toHaveCount(0)

    await page.getByRole('button', { name: 'Previous' }).click()
    await expect(page.getByText('Page 1 of 2')).toBeVisible()
  })

  test('a reading goes to the batch it was added to, not another', async ({ page }) => {
    await addReading(page, { when: '2030-06-15T09:30', temperature: '22.2' })

    await page.getByRole('link', { name: 'Dashboard' }).click()
    await page.getByText('Shiitake-Log-07').click()

    // Wait until the other batch's own readings are on screen, then check the new one is not.
    const headings = await readingTexts(page)
    expect(headings).not.toContain('Reading: Jun 15, 2030, 9:30 AM')
  })
})
