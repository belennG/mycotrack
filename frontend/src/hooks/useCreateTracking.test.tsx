import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useCreateTracking } from './useCreateTracking'
import { appToast } from '../utils/appToast'
import { createWrapper } from '../test/renderWithProviders'
import { server } from '../test/msw/server'
import { API, trackingFixture } from '../test/msw/handlers'

vi.mock('../utils/appToast', () => ({
  appToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

beforeEach(() => vi.clearAllMocks())

describe('useCreateTracking', () => {
  it('posts the reading, refreshes the dashboard and the batch’s list, and confirms', async () => {
    let body: unknown
    server.use(
      http.post(`${API}/v1/trackings`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(trackingFixture(), { status: 201 })
      }),
    )
    const { Wrapper, queryClient } = createWrapper()
    queryClient.setQueryData(['trackings', 'batch-1', 1], { total: 0, items: [] })
    const { result } = renderHook(() => useCreateTracking(), { wrapper: Wrapper })

    result.current.mutate({
      batch_id: 'batch-1',
      tracking_date: '2026-10-08T14:35',
      temperature: 22.5,
    })

    await waitFor(() =>
      expect(appToast.success).toHaveBeenCalledWith('Tracking Created', expect.any(String)),
    )
    expect(body).toEqual({
      batch_id: 'batch-1',
      tracking_date: '2026-10-08T14:35',
      temperature: 22.5,
    })
    expect(queryClient.getQueryState(['trackings', 'batch-1', 1])?.isInvalidated).toBe(true)
  })

  it('shows the API’s reason when the batch does not exist', async () => {
    server.use(
      http.post(`${API}/v1/trackings`, () =>
        HttpResponse.json({ detail: 'Associated Batch not found' }, { status: 404 }),
      ),
    )
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateTracking(), { wrapper: Wrapper })

    result.current.mutate({ batch_id: 'gone' })

    await waitFor(() =>
      expect(appToast.error).toHaveBeenCalledWith(
        'Failed to Create Tracking',
        'Associated Batch not found',
      ),
    )
  })

  it('falls back to a generic message when the failure has no detail', async () => {
    server.use(http.post(`${API}/v1/trackings`, () => new HttpResponse(null, { status: 500 })))
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateTracking(), { wrapper: Wrapper })

    result.current.mutate({ batch_id: 'batch-1' })

    await waitFor(() =>
      expect(appToast.error).toHaveBeenCalledWith(
        'Failed to Create Tracking',
        'An unexpected error occurred.',
      ),
    )
  })
})
