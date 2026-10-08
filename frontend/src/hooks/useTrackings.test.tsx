import { describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useTrackings } from './useTrackings'
import { createWrapper } from '../test/renderWithProviders'
import { server } from '../test/msw/server'
import { API, trackingFixture } from '../test/msw/handlers'

describe('useTrackings', () => {
  it('does nothing without a batch id', () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useTrackings(''), { wrapper: Wrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })

  it('loads the readings of a batch', async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useTrackings('batch-1'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.items[0].tracking_date).toBe('2026-10-08T14:35:00')
  })

  it('turns the page number into skip/limit for the API', async () => {
    const seen: Record<string, string | null> = {}
    server.use(
      http.get(`${API}/v1/trackings/`, ({ request }) => {
        const params = new URL(request.url).searchParams
        for (const key of ['batch_id', 'skip', 'limit']) seen[key] = params.get(key)
        return HttpResponse.json({ total: 25, items: [trackingFixture()] })
      }),
    )
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useTrackings('batch-1', 3, 10), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(seen).toEqual({ batch_id: 'batch-1', skip: '20', limit: '10' })
  })

  it('keeps each page and batch in its own cache entry', async () => {
    const { Wrapper, queryClient } = createWrapper()
    const { result } = renderHook(() => useTrackings('batch-1', 2), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(['trackings', 'batch-1', 2])).toBeDefined()
    expect(queryClient.getQueryData(['trackings', 'batch-1', 1])).toBeUndefined()
  })

  it('reports an error when the API fails', async () => {
    server.use(http.get(`${API}/v1/trackings/`, () => new HttpResponse(null, { status: 500 })))
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useTrackings('batch-1'), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
