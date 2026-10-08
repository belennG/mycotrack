import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes, useParams } from 'react-router-dom'
import BatchDrawer from './BatchDrawer'
import { appToast } from '../utils/appToast'
import { renderWithProviders } from '../test/renderWithProviders'
import { server } from '../test/msw/server'
import { API, batchFixture } from '../test/msw/handlers'

vi.mock('../utils/appToast', () => ({
  appToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

function TrackingsProbe() {
  return <div>trackings of {useParams().id}</div>
}

const app = (
  <Routes>
    <Route path="/" element={<BatchDrawer />} />
    <Route path="/batches/:id/trackings" element={<TrackingsProbe />} />
  </Routes>
)

beforeEach(() => vi.clearAllMocks())

async function openDrawer() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: '+ Create New Batch' }))
  await screen.findByRole('dialog')
  return user
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('e.g., Golden Teacher Batch #1'), 'Reishi-Test')
  await user.type(screen.getByPlaceholderText('e.g., Psilocybe cubensis'), 'Reishi')
  await user.type(document.querySelector('input[name="expected_harvest_date"]')!, '2026-12-01')
  await user.type(screen.getByPlaceholderText('e.g., Greenhouse Room A'), 'Shelf 1')
}

describe('BatchDrawer', () => {
  it('opens a form to create a batch, starting today and active', async () => {
    renderWithProviders(app)
    await openDrawer()

    expect(screen.getByText('New Batch Entry')).toBeInTheDocument()
    expect(document.querySelector('input[name="start_date"]')).toHaveValue(
      new Date().toISOString().split('T')[0],
    )
  })

  it('requires the essential fields', async () => {
    renderWithProviders(app)
    const user = await openDrawer()

    await user.click(screen.getByRole('button', { name: 'Save Entry' }))

    expect(await screen.findByText('Batch name is required')).toBeInTheDocument()
    expect(screen.getByText('Crop type is required')).toBeInTheDocument()
    expect(screen.getByText('Expected harvest date is required')).toBeInTheDocument()
    expect(screen.getByText('Location is required')).toBeInTheDocument()
  })

  it('creates the batch with ISO dates and opens its readings', async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.post(`${API}/v1/batches`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(batchFixture({ id: 'new-batch' }), { status: 201 })
      }),
    )
    renderWithProviders(app)
    const user = await openDrawer()

    await fillValid(user)
    await user.click(screen.getByRole('button', { name: 'Save Entry' }))

    expect(await screen.findByText('trackings of new-batch')).toBeInTheDocument()
    expect(body).toMatchObject({
      batch_name: 'Reishi-Test',
      crop_type: 'Reishi',
      status: 'ACTIVE',
      location: 'Shelf 1',
    })
    expect(body!.expected_harvest_date).toBe('2026-12-01T00:00:00.000Z')
    expect(appToast.success).toHaveBeenCalledWith('Batch Created', expect.any(String))
  })

  it('shows why a batch could not be saved, and keeps the form', async () => {
    server.use(
      http.post(`${API}/v1/batches`, () =>
        HttpResponse.json({ detail: 'Batch name already exists' }, { status: 400 }),
      ),
    )
    renderWithProviders(app)
    const user = await openDrawer()

    await fillValid(user)
    await user.click(screen.getByRole('button', { name: 'Save Entry' }))

    await waitFor(() =>
      expect(appToast.error).toHaveBeenCalledWith(
        'Failed to Create Batch',
        'Batch name already exists',
      ),
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('forgets a half-filled form when it is cancelled', async () => {
    renderWithProviders(app)
    const user = await openDrawer()
    await user.type(screen.getByPlaceholderText('e.g., Greenhouse Room A'), 'Shelf 1')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await openDrawer()

    expect(screen.getByPlaceholderText('e.g., Greenhouse Room A')).toHaveValue('')
  })
})
