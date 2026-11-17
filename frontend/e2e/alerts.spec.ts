import { expect, test } from '@playwright/test'
import { addReading, openOysterBatch, startDemo } from './helpers'

test.describe('alerts in demo mode', () => {
  test.beforeEach(async ({ page }) => {
    await startDemo(page)
  })

  test('the header and the dashboard show that something needs attention', async ({ page }) => {
    // Oyster-Block-01 is losing humidity, and the failed batch left three critical alerts.
    await expect(page.getByRole('link', { name: /^Alerts/ })).toContainText('4')
    await expect(page.getByText('⚠ 1 alert')).toBeVisible()
    await expect(page.getByText('⚠ 3 alerts')).toBeVisible()
  })

  test('lists the alerts, with the humidity warning first to be seen', async ({ page }) => {
    await page.getByRole('link', { name: /^Alerts/ }).click()
    await expect(page).toHaveURL(/\/alerts$/)

    const list = page.getByRole('list', { name: 'open alerts' })
    await expect(list.getByRole('listitem')).toHaveCount(4)
    await expect(list.getByText(/Humidity has fallen on each of the last 4 readings/)).toBeVisible()
    await expect(list.getByText('Warning')).toHaveCount(1)
    await expect(list.getByText('Critical')).toHaveCount(3)
  })

  test('acknowledging an alert removes it from the open list and the counts', async ({ page }) => {
    await page.getByRole('link', { name: /^Alerts/ }).click()

    await page.getByRole('button', { name: 'Acknowledge the alert for Oyster-Block-01' }).click()

    const list = page.getByRole('list', { name: 'open alerts' })
    await expect(list.getByRole('listitem')).toHaveCount(3)
    await expect(page.getByRole('link', { name: /^Alerts/ })).toContainText('3')

    await page.getByRole('button', { name: 'Acknowledged' }).click()
    await expect(
      page.getByRole('list', { name: 'acknowledged alerts' }).getByText(/Humidity has fallen/),
    ).toBeVisible()
  })

  test('saving a reading that is out of range raises a new alert', async ({ page }) => {
    await openOysterBatch(page)
    await addReading(page, { when: '2030-06-15T09:30', temperature: '31' })

    await page.getByRole('link', { name: /^Alerts/ }).click()
    await expect(
      page.getByRole('list', { name: 'open alerts' }).getByText(/Temperature is too high \(31\)/),
    ).toBeVisible()
  })
})
