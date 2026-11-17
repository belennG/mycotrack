import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes, useParams } from 'react-router-dom'
import Alerts from './Alerts'
import { renderWithProviders } from '../test/renderWithProviders'
import { server } from '../test/msw/server'
import { API, alertFixture } from '../test/msw/handlers'
import type { Alert } from '../types/alert'

/** Serve the alerts list, split by the is_acknowledged filter the page sends. */
function serveAlerts(open: Alert[], acknowledged: Alert[] = []) {
  const requests: string[] = []
  server.use(
    http.get(`${API}/v1/alerts`, ({ request }) => {
      const url = new URL(request.url)
      requests.push(url.search)
      const items = url.searchParams.get('is_acknowledged') === 'true' ? acknowledged : open
      return HttpResponse.json({ total: items.length, items })
    }),
  )
  return requests
}

function TrackingsProbe() {
  return <div>trackings of {useParams().id}</div>
}

const app = (
  <Routes>
    <Route path="/alerts" element={<Alerts />} />
    <Route path="/batches/:id/trackings" element={<TrackingsProbe />} />
  </Routes>
)
const renderAlerts = () => renderWithProviders(app, { route: '/alerts' })

describe('Alerts page', () => {
  it('lists open alerts with their severity, batch and message', async () => {
    serveAlerts([
      alertFixture({ id: 'a1' }),
      alertFixture({
        id: 'a2',
        severity: 'critical',
        batch_name: 'KingOyster-Trial-02',
        message: 'Temperature is too high (30.7). Safe range is 20.0 to 25.0.',
      }),
    ])
    renderAlerts()

    const list = await screen.findByRole('list', { name: 'open alerts' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Warning')).toBeVisible()
    expect(within(items[0]).getByText(/Humidity has fallen on each of the last 4/)).toBeVisible()
    expect(within(items[1]).getByText('Critical')).toBeVisible()
    expect(within(items[1]).getByRole('link', { name: 'KingOyster-Trial-02' })).toHaveAttribute(
      'href',
      '/batches/batch-1/trackings',
    )
    expect(screen.getByRole('button', { name: 'Open (2)' })).toBeVisible()
  })

  it('opens the batch an alert is about', async () => {
    const user = userEvent.setup()
    serveAlerts([alertFixture({ batch_id: 'batch-9', batch_name: 'Shiitake-Log-07' })])
    renderAlerts()

    await user.click(await screen.findByRole('link', { name: 'Shiitake-Log-07' }))

    expect(await screen.findByText('trackings of batch-9')).toBeVisible()
  })

  it('says so when nothing needs attention', async () => {
    serveAlerts([])
    renderAlerts()

    expect(await screen.findByText(/No open alerts/)).toBeVisible()
  })

  it('acknowledges an alert and refreshes the list', async () => {
    const user = userEvent.setup()
    let acknowledgedIds: string[] = []
    const alert = alertFixture({ id: 'a1' })
    server.use(
      http.get(`${API}/v1/alerts`, ({ request }) => {
        const wantsAcknowledged =
          new URL(request.url).searchParams.get('is_acknowledged') === 'true'
        const done = acknowledgedIds.includes('a1')
        const items = wantsAcknowledged === done ? [alert] : []
        return HttpResponse.json({ total: items.length, items })
      }),
      http.post(`${API}/v1/alerts/:id/acknowledge`, ({ params }) => {
        acknowledgedIds = [...acknowledgedIds, String(params.id)]
        return HttpResponse.json({ ...alert, is_acknowledged: true })
      }),
    )
    renderAlerts()

    await user.click(
      await screen.findByRole('button', { name: 'Acknowledge the alert for Oyster-Block-01' }),
    )

    expect(await screen.findByText(/No open alerts/)).toBeVisible()
    expect(acknowledgedIds).toEqual(['a1'])
  })

  it('shows acknowledged alerts on their own tab, without an acknowledge button', async () => {
    const user = userEvent.setup()
    const requests = serveAlerts(
      [],
      [alertFixture({ id: 'a1', is_acknowledged: true, acknowledged_at: '2026-11-17T09:00:00' })],
    )
    renderAlerts()
    await screen.findByText(/No open alerts/)

    await user.click(screen.getByRole('button', { name: 'Acknowledged' }))

    const list = await screen.findByRole('list', { name: 'acknowledged alerts' })
    expect(within(list).getByText(/acknowledged/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: /Acknowledge the alert/ })).not.toBeInTheDocument()
    expect(requests.some((search) => search.includes('is_acknowledged=true'))).toBe(true)
  })

  it('says so when the alerts cannot be loaded', async () => {
    server.use(http.get(`${API}/v1/alerts`, () => new HttpResponse(null, { status: 500 })))
    renderAlerts()

    expect(await screen.findByText('Could not load the alerts.')).toBeVisible()
  })

  it('keeps the alert when acknowledging fails', async () => {
    const user = userEvent.setup()
    serveAlerts([alertFixture()])
    server.use(
      http.post(`${API}/v1/alerts/:id/acknowledge`, () =>
        HttpResponse.json({ detail: 'Insufficient permissions' }, { status: 403 }),
      ),
    )
    renderAlerts()

    await user.click(
      await screen.findByRole('button', { name: 'Acknowledge the alert for Oyster-Block-01' }),
    )

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Acknowledge the alert for Oyster-Block-01' }),
      ).toBeEnabled(),
    )
    expect(screen.getByText(/Humidity has fallen/)).toBeVisible()
  })
})
