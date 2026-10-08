import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useBatch, useBatches, useCreateBatch, useDashboard, useUpdateBatch } from './useBatches'
import { appToast } from '../utils/appToast'
import { createWrapper } from '../test/renderWithProviders'
import { server } from '../test/msw/server'
import { API, batchFixture } from '../test/msw/handlers'

vi.mock('../utils/appToast', () => ({
  appToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

beforeEach(() => vi.clearAllMocks())

describe('useBatches', () => {
  it('loads a page of batches', async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useBatches(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.items.map((b) => b.batch_name)).toEqual(['Oyster-Block-01'])
  })

  it('asks the API for the requested page, caching each page separately', async () => {
    let requestedPage: string | null = null
    server.use(
      http.get(`${API}/v1/batches`, ({ request }) => {
        requestedPage = new URL(request.url).searchParams.get('page')
        return HttpResponse.json({ total: 0, items: [] })
      }),
    )
    const { Wrapper, queryClient } = createWrapper()
    const { result } = renderHook(() => useBatches(3), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(requestedPage).toBe('3')
    expect(queryClient.getQueryData(['batches', 3])).toBeDefined()
  })

  it('reports an error when the API fails', async () => {
    server.use(http.get(`${API}/v1/batches`, () => new HttpResponse(null, { status: 500 })))
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useBatches(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe('useBatch', () => {
  it('does nothing without an id', () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useBatch(undefined), { wrapper: Wrapper })

    expect(result.current.fetchStatus).toBe('idle') // no request made (an unhandled one would fail)
  })

  it('loads one batch', async () => {
    server.use(
      http.get(`${API}/v1/batches/batch-9`, () =>
        HttpResponse.json(batchFixture({ id: 'batch-9' })),
      ),
    )
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useBatch('batch-9'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.data?.id).toBe('batch-9'))
  })
})

describe('useDashboard', () => {
  it('loads the dashboard grouped by status', async () => {
    server.use(
      http.get(`${API}/v1/batches/dashboard`, () =>
        HttpResponse.json({ ACTIVE: [], COMPLETED: [], FAILED: [], ARCHIVED: [] }),
      ),
    )
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useDashboard(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.data).toHaveProperty('ACTIVE'))
  })
})

const payload = {
  batch_name: 'New',
  crop_type: 'Oyster',
  status: 'ACTIVE' as const,
  start_date: '2026-10-01',
  expected_harvest_date: '2026-11-01',
  location: 'A',
}

describe('useCreateBatch', () => {
  it('creates the batch, refreshes the list and confirms with a toast', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/batches`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(batchFixture({ id: 'new-id' }), { status: 201 })
      }),
    )
    const { Wrapper, queryClient } = createWrapper()
    queryClient.setQueryData(['batches', 1], { total: 0, items: [] })
    const { result } = renderHook(() => useCreateBatch(), { wrapper: Wrapper })

    result.current.mutate(payload)

    await waitFor(() =>
      expect(appToast.success).toHaveBeenCalledWith('Batch Created', expect.any(String)),
    )
    expect(body).toMatchObject({ batch_name: 'New' })
    expect(queryClient.getQueryState(['batches', 1])?.isInvalidated).toBe(true)
  })

  it('shows the API’s reason when the name is already taken', async () => {
    server.use(
      http.post(`${API}/v1/batches`, () =>
        HttpResponse.json({ detail: 'Batch name already exists' }, { status: 400 }),
      ),
    )
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateBatch(), { wrapper: Wrapper })

    result.current.mutate(payload)

    await waitFor(() =>
      expect(appToast.error).toHaveBeenCalledWith(
        'Failed to Create Batch',
        'Batch name already exists',
      ),
    )
    expect(appToast.success).not.toHaveBeenCalled()
  })

  it('falls back to a generic message when the failure has no detail', async () => {
    server.use(http.post(`${API}/v1/batches`, () => new HttpResponse(null, { status: 500 })))
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateBatch(), { wrapper: Wrapper })

    result.current.mutate(payload)

    await waitFor(() =>
      expect(appToast.error).toHaveBeenCalledWith(
        'Failed to Create Batch',
        'An unexpected error occurred.',
      ),
    )
  })
})

describe('useUpdateBatch', () => {
  it('saves the changes and refreshes that batch and the list', async () => {
    server.use(
      http.put(`${API}/v1/batches/batch-1`, () =>
        HttpResponse.json(batchFixture({ notes: 'edited' })),
      ),
    )
    const { Wrapper, queryClient } = createWrapper()
    queryClient.setQueryData(['batch', 'batch-1'], batchFixture())
    queryClient.setQueryData(['batches', 1], { total: 1, items: [] })
    queryClient.setQueryData(['dashboard'], { ACTIVE: [] })
    const { result } = renderHook(() => useUpdateBatch(), { wrapper: Wrapper })

    result.current.mutate({ id: 'batch-1', payload: { notes: 'edited' } })

    await waitFor(() =>
      expect(appToast.success).toHaveBeenCalledWith('Batch Updated', expect.any(String)),
    )
    expect(queryClient.getQueryState(['batch', 'batch-1'])?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(['batches', 1])?.isInvalidated).toBe(true)
    // A status change moves the batch to another dashboard column.
    expect(queryClient.getQueryState(['dashboard'])?.isInvalidated).toBe(true)
  })
})
