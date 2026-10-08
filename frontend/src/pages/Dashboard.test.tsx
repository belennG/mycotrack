import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes, useParams } from 'react-router-dom'
import Dashboard from './Dashboard'
import { renderWithProviders } from '../test/renderWithProviders'
import { server } from '../test/msw/server'
import { API, batchFixture, trackingFixture } from '../test/msw/handlers'
import type { DashboardBatch, DashboardResponse } from '../types/batch'

const dashboardBatch = (over: Partial<DashboardBatch> = {}): DashboardBatch => ({
  ...batchFixture(),
  latest_tracking: trackingFixture(),
  ...over,
})

const dashboard = (over: Partial<DashboardResponse> = {}): DashboardResponse => ({
  ACTIVE: [],
  COMPLETED: [],
  FAILED: [],
  ARCHIVED: [],
  ...over,
})

const serve = (data: DashboardResponse) =>
  server.use(http.get(`${API}/v1/batches/dashboard`, () => HttpResponse.json(data)))

function TrackingsProbe() {
  return <div>trackings of {useParams().id}</div>
}

const app = (
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/batches/:id/trackings" element={<TrackingsProbe />} />
  </Routes>
)

describe('Dashboard', () => {
  it('shows a loading message first', () => {
    serve(dashboard())
    renderWithProviders(app, { route: '/dashboard' })
    expect(screen.getByText(/Loading your cultivation dashboard/)).toBeInTheDocument()
  })

  it('says so when the data cannot be loaded', async () => {
    server.use(
      http.get(`${API}/v1/batches/dashboard`, () => new HttpResponse(null, { status: 500 })),
    )
    renderWithProviders(app, { route: '/dashboard' })

    expect(await screen.findByText('Failed to load dashboard data.')).toBeInTheDocument()
  })

  it('lays batches out in a column per status, with counts', async () => {
    serve(
      dashboard({
        ACTIVE: [
          dashboardBatch({ id: 'a1', batch_name: 'Oyster-1' }),
          dashboardBatch({ id: 'a2', batch_name: 'Shiitake-1' }),
        ],
        FAILED: [dashboardBatch({ id: 'f1', batch_name: 'KingOyster-1', status: 'FAILED' })],
      }),
    )
    renderWithProviders(app, { route: '/dashboard' })

    expect(await screen.findByText('Oyster-1')).toBeInTheDocument()
    expect(screen.getByText('Shiitake-1')).toBeInTheDocument()
    expect(screen.getByText('KingOyster-1')).toBeInTheDocument()
    // Empty columns say so.
    expect(screen.getAllByText('No batches')).toHaveLength(2)
  })

  it('shows the latest reading of each batch', async () => {
    serve(
      dashboard({
        ACTIVE: [
          dashboardBatch({
            latest_tracking: trackingFixture({ temperature: 22.5, humidity: 91, ph_level: 6.8 }),
          }),
        ],
      }),
    )
    renderWithProviders(app, { route: '/dashboard' })

    expect(await screen.findByText(/22\.5 °C/)).toBeInTheDocument()
    expect(screen.getByText(/91 %/)).toBeInTheDocument()
    expect(screen.getByText(/6\.8/)).toBeInTheDocument()
  })

  it('shows a reading of exactly zero as 0, not as missing data', async () => {
    // 0 °C and 0 % are real measurements; only null/undefined means "no value".
    serve(
      dashboard({
        ACTIVE: [
          dashboardBatch({
            latest_tracking: trackingFixture({ temperature: 0, humidity: 0, ph_level: null }),
          }),
        ],
      }),
    )
    renderWithProviders(app, { route: '/dashboard' })

    expect(await screen.findByText(/🌡️ 0 °C/)).toBeInTheDocument()
    expect(screen.getByText(/💧 0 %/)).toBeInTheDocument()
    expect(screen.getByText(/🧪 --/)).toBeInTheDocument() // the genuinely missing one
  })

  it('says when a batch has no readings yet', async () => {
    serve(dashboard({ ACTIVE: [dashboardBatch({ latest_tracking: null })] }))
    renderWithProviders(app, { route: '/dashboard' })

    expect(await screen.findByText('No logs yet.')).toBeInTheDocument()
  })

  it('opens a batch’s readings when its card is clicked', async () => {
    serve(dashboard({ ACTIVE: [dashboardBatch({ id: 'abc', batch_name: 'Oyster-1' })] }))
    renderWithProviders(app, { route: '/dashboard' })

    await userEvent.setup().click(await screen.findByText('Oyster-1'))
    expect(await screen.findByText('trackings of abc')).toBeInTheDocument()
  })

  it('only offers "new tracking" when there is a batch to add one to', async () => {
    serve(dashboard())
    const { unmount } = renderWithProviders(app, { route: '/dashboard' })
    await screen.findByText('Cultivation Dashboard')
    expect(screen.queryByRole('button', { name: /create new tracking/i })).not.toBeInTheDocument()
    unmount()

    serve(dashboard({ ACTIVE: [dashboardBatch()] }))
    renderWithProviders(app, { route: '/dashboard' })
    await screen.findByText('Oyster-Block-01')
    const header = screen.getByRole('heading', { name: 'Cultivation Dashboard' }).parentElement!
    expect(within(header).getByRole('button', { name: /create new tracking/i })).toBeInTheDocument()
  })
})
