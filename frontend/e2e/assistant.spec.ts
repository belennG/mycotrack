import { expect, test } from '@playwright/test'
import { startDemo } from './helpers'

test.beforeEach(async ({ page }) => {
  await startDemo(page)
  await page.getByRole('link', { name: 'Assistant' }).click()
  await expect(page).toHaveURL(/\/assistant$/)
  await expect(page.getByRole('heading', { name: 'Assistant', exact: true })).toBeVisible()
})

test.describe('the assistant in demo mode', () => {
  test('replays a recorded answer, labelled as a recording, as a formatted table', async ({
    page,
  }) => {
    await page
      .getByRole('button', { name: 'Compare the average temperature of my active batches.' })
      .click()

    const conversation = page.getByRole('log', { name: 'Conversation' })
    await expect(conversation.getByRole('table')).toBeVisible()
    await expect(conversation.getByRole('cell', { name: 'Oyster-Block-01' })).toBeVisible()
    await expect(conversation.getByText(/^Recorded answer · .* · claude-/)).toBeVisible()
    await expect(
      conversation.getByText(/Looked at: list_batches, get_batch_summary ×2/),
    ).toBeVisible()
  })

  test('lets you pick another recorded question after the first', async ({ page }) => {
    await page.getByRole('button', { name: 'How is Oyster-Block-01 doing?' }).click()
    await expect(page.getByText(/^Recorded answer · /)).toHaveCount(1)

    // The one just asked is gone; the others are still there to choose.
    await expect(page.getByRole('button', { name: 'How is Oyster-Block-01 doing?' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Why did KingOyster-Trial-02 fail?' }).click()
    await expect(page.getByText(/^Recorded answer · /)).toHaveCount(2)

    await page.getByRole('button', { name: 'Clear conversation' }).click()
    await expect(page.getByText(/^Recorded answer · /)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'How is Oyster-Block-01 doing?' })).toBeVisible()
  })

  test('keeps a conversation going, one recorded answer after another', async ({ page }) => {
    await page.getByRole('button', { name: 'How is Oyster-Block-01 doing?' }).click()
    await expect(page.getByText(/^Recorded answer · /)).toHaveCount(1)

    await page.getByRole('textbox', { name: 'Your question' }).fill('¿Cómo van mis lotes activos?')
    await page.getByRole('button', { name: 'Ask' }).click()

    await expect(page.getByText(/^Recorded answer · /)).toHaveCount(2)
    // The second answer is about both active batches. (Its wording changes every time the
    // recordings are made, so this checks a fact it must contain, not a sentence.)
    await expect(
      page.getByRole('log', { name: 'Conversation' }).getByText('Shiitake-Log-07').first(),
    ).toBeVisible()
  })

  test('is honest that it cannot answer anything that was not recorded', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Your question' }).fill('What is the weather tomorrow?')
    await page.getByRole('textbox', { name: 'Your question' }).press('Enter')

    await expect(page.getByText(/I can only replay recorded answers/)).toBeVisible()
    await expect(page.getByText(/^Recorded answer · /)).toHaveCount(0)
  })

  test('explains what it is, and that no model is called in the demo', async ({ page }) => {
    await page.getByText('About this assistant').click()

    await expect(page.getByText(/no AI model is called/)).toBeVisible()
    await expect(
      page.getByRole('link', { name: /how it works and how it is kept safe/ }),
    ).toBeVisible()
  })

  test('never talks to the API in demo mode', async ({ page }) => {
    const apiCalls: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/api/')) apiCalls.push(request.url())
    })

    await page.getByRole('button', { name: 'Which of my batches need attention?' }).click()
    await expect(page.getByText(/^Recorded answer · /)).toBeVisible()

    expect(apiCalls).toEqual([])
  })
})
