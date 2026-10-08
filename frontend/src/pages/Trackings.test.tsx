import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import Trackings from './Trackings'
import { renderWithProviders } from '../test/renderWithProviders'
import { server } from '../test/msw/server'
import { API, trackingFixture } from '../test/msw/handlers'

vi.mock('../utils/appToast', () => ({
  appToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const app = (
  <Routes>
    <Route path="/batches/:id/trackings" element={<Trackings />} />
  </Routes>
)
const route = '/batches/batch-1/trackings'

const readingTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

const serveList = (items = [trackingFixture()], total = items.length) =>
  server.use(http.get(`${API}/v1/trackings/`, () => HttpResponse.json({ total, items })))

beforeEach(() => vi.clearAllMocks())

describe('Trackings: the list', () => {
  it('shows each reading with its date AND time', async () => {
    serveList([
      trackingFixture({ id: 't1', tracking_date: '2026-10-08T18:00:00' }),
      trackingFixture({ id: 't2', tracking_date: '2026-10-08T08:30:00' }),
    ])
    renderWithProviders(app, { route })

    expect(
      await screen.findByText(`Reading: ${readingTime('2026-10-08T18:00:00')}`),
    ).toBeInTheDocument()
    expect(screen.getByText(`Reading: ${readingTime('2026-10-08T08:30:00')}`)).toBeInTheDocument()
  })

  it('keeps the order the API returns (newest reading first)', async () => {
    serveList([
      trackingFixture({ id: 't1', tracking_date: '2026-10-08T18:00:00' }),
      trackingFixture({ id: 't2', tracking_date: '2026-10-08T08:30:00' }),
    ])
    renderWithProviders(app, { route })

    const readings = await screen.findAllByText(/^Reading:/)
    expect(readings.map((r) => r.textContent)).toEqual([
      `Reading: ${readingTime('2026-10-08T18:00:00')}`,
      `Reading: ${readingTime('2026-10-08T08:30:00')}`,
    ])
  })

  it('shows the measurements and any notes', async () => {
    serveList([trackingFixture({ temperature: 22.5, humidity: 90, notes: 'Looks healthy' })])
    renderWithProviders(app, { route })

    expect(await screen.findByText(/22\.5/)).toBeInTheDocument()
    expect(screen.getByText('Looks healthy')).toBeInTheDocument()
  })

  it('says so when there are no readings', async () => {
    serveList([], 0)
    renderWithProviders(app, { route })

    expect(await screen.findByText('No logs found for this batch.')).toBeInTheDocument()
  })

  it('offers a retry when loading fails, and recovers', async () => {
    server.use(http.get(`${API}/v1/trackings/`, () => new HttpResponse(null, { status: 500 })))
    renderWithProviders(app, { route })

    const retry = await screen.findByRole('button', { name: 'Retry Connection' })
    serveList([trackingFixture({ notes: 'back online' })])
    await userEvent.setup().click(retry)

    expect(await screen.findByText('back online')).toBeInTheDocument()
  })
})

describe('Trackings: pagination', () => {
  it('pages through readings ten at a time', async () => {
    const skips: (string | null)[] = []
    server.use(
      http.get(`${API}/v1/trackings/`, ({ request }) => {
        skips.push(new URL(request.url).searchParams.get('skip'))
        return HttpResponse.json({ total: 25, items: [trackingFixture()] })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(app, { route })

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Page 3 of 3')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    expect(skips).toEqual(['0', '10', '20'])
  })
})

async function openForm() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: '+ Add New Tracking' }))
  await screen.findByRole('dialog')
  return user
}

describe('Trackings: adding a reading', () => {
  it('asks for every measurement before saving', async () => {
    serveList()
    renderWithProviders(app, { route })
    const user = await openForm()

    await user.click(screen.getByRole('button', { name: 'Save Log' }))

    expect(await screen.findByText('Temperature is required')).toBeInTheDocument()
    expect(screen.getByText('Humidity is required')).toBeInTheDocument()
    expect(screen.getByText('pH level is required')).toBeInTheDocument()
    expect(screen.getByText('Moisture is required')).toBeInTheDocument()
  })

  it('rejects values outside the physical range', async () => {
    serveList()
    renderWithProviders(app, { route })
    const user = await openForm()

    await user.type(screen.getByPlaceholderText('24.5'), '150')
    await user.type(screen.getByPlaceholderText('85.0'), '-5')
    await user.type(screen.getByPlaceholderText('6.5'), '15')
    await user.type(screen.getByPlaceholderText('60.0'), '101')
    await user.click(screen.getByRole('button', { name: 'Save Log' }))

    expect(await screen.findAllByText('Cannot exceed 100')).toHaveLength(2) // temperature, moisture
    expect(screen.getByText('Must be at least 0')).toBeInTheDocument() // humidity
    expect(screen.getByText('Cannot exceed 14')).toBeInTheDocument() // pH
  })

  it('saves a valid reading for this batch, then closes the form and confirms', async () => {
    serveList()
    let body: Record<string, unknown> | undefined
    server.use(
      http.post(`${API}/v1/trackings`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(trackingFixture(), { status: 201 })
      }),
    )
    renderWithProviders(app, { route })
    const user = await openForm()

    await user.type(screen.getByPlaceholderText('24.5'), '22.5')
    await user.type(screen.getByPlaceholderText('85.0'), '90')
    await user.type(screen.getByPlaceholderText('6.5'), '6.8')
    await user.type(screen.getByPlaceholderText('60.0'), '80')
    await user.click(screen.getByRole('button', { name: 'Save Log' }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body).toMatchObject({
      batch_id: 'batch-1',
      temperature: 22.5, // numbers, not strings
      humidity: 90,
      ph_level: 6.8,
      moisture: 80,
    })
    expect(typeof body!.tracking_date).toBe('string')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps the form open, with what was typed, if saving fails', async () => {
    serveList()
    server.use(
      http.post(`${API}/v1/trackings`, () =>
        HttpResponse.json({ detail: 'Associated Batch not found' }, { status: 404 }),
      ),
    )
    renderWithProviders(app, { route })
    const user = await openForm()

    await user.type(screen.getByPlaceholderText('24.5'), '22.5')
    await user.type(screen.getByPlaceholderText('85.0'), '90')
    await user.type(screen.getByPlaceholderText('6.5'), '6.8')
    await user.type(screen.getByPlaceholderText('60.0'), '80')
    await user.click(screen.getByRole('button', { name: 'Save Log' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Log' })).toBeEnabled())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('24.5')).toHaveValue(22.5)
  })
})
