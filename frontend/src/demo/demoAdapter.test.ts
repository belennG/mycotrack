import { beforeEach, describe, expect, it } from 'vitest'
import type { AxiosError } from 'axios'
import { apiClient } from '../api/client'
import { resetDemoDb, setDemoLatency } from './demoAdapter'
import { enterDemoMode } from './demoMode'
import type { Batch, DashboardResponse, PaginatedResponse } from '../types/batch'
import type { Tracking } from '../types/tracking'
import type { Me } from '../types/me'

// Everything goes through the real apiClient, exactly as the app uses it in demo mode.
beforeEach(() => {
  setDemoLatency(0)
  resetDemoDb()
  enterDemoMode()
})

const get = async <T>(url: string) => (await apiClient.get<T>(url)).data

async function failure(request: Promise<unknown>) {
  const error = (await request.then(
    () => {
      throw new Error('expected the request to fail')
    },
    (e) => e,
  )) as AxiosError<{ detail: string }>
  return { status: error.response?.status, detail: error.response?.data.detail }
}

const newBatch = {
  batch_name: 'Reishi-Test',
  crop_type: 'Reishi',
  status: 'ACTIVE',
  start_date: '2026-10-01T00:00:00',
  expected_harvest_date: '2026-12-01T00:00:00',
  location: 'Shelf 1',
  notes: '',
}

describe('demo API: batches', () => {
  it('groups the dashboard by status and attaches each batch’s latest reading', async () => {
    const dashboard = await get<DashboardResponse>('/v1/batches/dashboard')

    expect(dashboard.ACTIVE).toHaveLength(2)
    expect(dashboard.COMPLETED).toHaveLength(1)
    expect(dashboard.FAILED).toHaveLength(1)
    expect(dashboard.ARCHIVED).toHaveLength(1)

    const oyster = dashboard.ACTIVE.find((b) => b.batch_name === 'Oyster-Block-01')!
    const readings = await get<PaginatedResponse<Tracking>>(
      `/v1/trackings/?batch_id=${oyster.id}&limit=100`,
    )
    expect(oyster.latest_tracking?.id).toBe(readings.items[0].id)
  })

  it('paginates the batch list', async () => {
    const page1 = await get<PaginatedResponse<Batch>>('/v1/batches?page=1&limit=2')
    const page3 = await get<PaginatedResponse<Batch>>('/v1/batches?page=3&limit=2')

    expect(page1.total).toBe(5)
    expect(page1.items).toHaveLength(2)
    expect(page3.items).toHaveLength(1)
  })

  it('creates a batch and then lists it', async () => {
    const { data: created } = await apiClient.post<Batch>('/v1/batches', newBatch)
    expect(created.id).toBeTruthy()

    const list = await get<PaginatedResponse<Batch>>('/v1/batches?limit=50')
    expect(list.total).toBe(6)
    expect(list.items.some((b) => b.batch_name === 'Reishi-Test')).toBe(true)
  })

  it('rejects a duplicate batch name like the real API does', async () => {
    await apiClient.post('/v1/batches', newBatch)

    expect(await failure(apiClient.post('/v1/batches', newBatch))).toEqual({
      status: 400,
      detail: 'Batch name already exists',
    })
  })

  it('rejects renaming a batch to a name that is taken', async () => {
    const list = await get<PaginatedResponse<Batch>>('/v1/batches?limit=50')
    const [a, b] = list.items

    expect(
      await failure(apiClient.put(`/v1/batches/${a.id}`, { batch_name: b.batch_name })),
    ).toEqual({ status: 400, detail: 'Batch name already exists' })
  })

  it('updates a batch', async () => {
    const [batch] = (await get<PaginatedResponse<Batch>>('/v1/batches')).items
    const { data } = await apiClient.put<Batch>(`/v1/batches/${batch.id}`, { notes: 'edited' })

    expect(data.notes).toBe('edited')
    expect((await get<Batch>(`/v1/batches/${batch.id}`)).notes).toBe('edited')
  })

  it('answers 404 for an unknown batch', async () => {
    expect(await failure(apiClient.get('/v1/batches/nope'))).toEqual({
      status: 404,
      detail: 'Batch not found',
    })
  })
})

describe('demo API: trackings', () => {
  const OYSTER = 'demo-batch-1'

  it('lists the newest reading first, by when it was taken', async () => {
    const { items } = await get<PaginatedResponse<Tracking>>(
      `/v1/trackings/?batch_id=${OYSTER}&limit=100`,
    )

    const times = items.map((t) => t.tracking_date)
    expect(times).toEqual([...times].sort().reverse())
  })

  it('has several readings on the same day for active batches, each with its own time', async () => {
    const { items } = await get<PaginatedResponse<Tracking>>(
      `/v1/trackings/?batch_id=${OYSTER}&limit=100`,
    )
    const perDay = new Map<string, Set<string>>()
    for (const t of items) {
      const day = t.tracking_date.slice(0, 10)
      perDay.set(day, (perDay.get(day) ?? new Set()).add(t.tracking_date))
    }

    expect([...perDay.values()].some((times) => times.size >= 2)).toBe(true)
  })

  it('paginates with skip and limit', async () => {
    const all = await get<PaginatedResponse<Tracking>>(
      `/v1/trackings/?batch_id=${OYSTER}&limit=100`,
    )
    const page = await get<PaginatedResponse<Tracking>>(
      `/v1/trackings/?batch_id=${OYSTER}&skip=2&limit=3`,
    )

    expect(page.total).toBe(all.total)
    expect(page.items.map((t) => t.id)).toEqual(all.items.slice(2, 5).map((t) => t.id))
  })

  it('includes every reading on the date_to day', async () => {
    const day = '2026-10-08'
    const make = (time: string) =>
      apiClient.post('/v1/trackings/', { batch_id: OYSTER, tracking_date: `${day}T${time}Z` })
    await make('00:05:00')
    await make('23:50:00')

    const { items } = await get<PaginatedResponse<Tracking>>(
      `/v1/trackings/?batch_id=${OYSTER}&date_from=${day}&date_to=${day}&limit=100`,
    )
    // The two added above are on the day (other readings on that exact day may also match).
    const times = items.map((t) => t.tracking_date)
    expect(times.some((t) => t.startsWith(`${day}T00:05`))).toBe(true)
    expect(times.some((t) => t.startsWith(`${day}T23:50`))).toBe(true)
    expect(times.every((t) => t.startsWith(day))).toBe(true)
  })

  it('creates a reading, defaulting missing metrics to null, and bumps the batch', async () => {
    // A completed batch whose last update is days old, so "bumped" is unambiguous.
    const COMPLETED = 'demo-batch-3'
    const before = await get<Batch>(`/v1/batches/${COMPLETED}`)
    const { data } = await apiClient.post<Tracking>('/v1/trackings/', {
      batch_id: COMPLETED,
      temperature: 23.1,
    })

    expect(data.temperature).toBe(23.1)
    expect(data.humidity).toBeNull()
    expect(data.batch_id).toBe(COMPLETED)
    expect((await get<Batch>(`/v1/batches/${COMPLETED}`)).updated_at > before.updated_at).toBe(true)
  })

  it('rejects a reading for a batch that does not exist', async () => {
    expect(await failure(apiClient.post('/v1/trackings/', { batch_id: 'nope' }))).toEqual({
      status: 404,
      detail: 'Associated Batch not found',
    })
  })

  it('updates and deletes a reading', async () => {
    const { items } = await get<PaginatedResponse<Tracking>>(`/v1/trackings/?batch_id=${OYSTER}`)
    const target = items[0]

    const { data } = await apiClient.put<Tracking>(`/v1/trackings/${target.id}`, { notes: 'hi' })
    expect(data.notes).toBe('hi')

    expect((await apiClient.delete(`/v1/trackings/${target.id}`)).status).toBe(204)
    expect(await failure(apiClient.get(`/v1/trackings/${target.id}`))).toEqual({
      status: 404,
      detail: 'tracking not found',
    })
  })
})

describe('demo API: session', () => {
  it('serves the profile and a demo organization', async () => {
    const me = await get<Me>('/v1/me')

    expect(me.organization).toMatchObject({ name: 'Demo Farm', role: 'OWNER' })
    expect(me.organizations).toHaveLength(1)
  })

  it('returns to the pristine sample data after a reset', async () => {
    await apiClient.post('/v1/batches', newBatch)
    expect((await get<PaginatedResponse<Batch>>('/v1/batches')).total).toBe(6)

    resetDemoDb()
    expect((await get<PaginatedResponse<Batch>>('/v1/batches')).total).toBe(5)
  })

  it('keeps changes across a "reload" (state is read back from sessionStorage)', async () => {
    await apiClient.post('/v1/batches', newBatch)
    // Simulate a page reload: drop the in-memory copy but keep sessionStorage.
    const saved = sessionStorage.getItem('mycotrack-demo-db')!
    resetDemoDb()
    sessionStorage.setItem('mycotrack-demo-db', saved)

    expect((await get<PaginatedResponse<Batch>>('/v1/batches')).total).toBe(6)
  })

  it('answers 404 for a route it has no mock for', async () => {
    expect((await failure(apiClient.get('/v1/unknown'))).status).toBe(404)
  })
})
