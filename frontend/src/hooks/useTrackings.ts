import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import type { Tracking, CreateTrackingPayload, PaginatedResponse } from '../types/tracking'

export function useTrackings(page: number = 1) {
  return useQuery({
    queryKey: ['trackings', page],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Tracking>>(`/trackings?page=${page}`)
      return data
    },
  })
}

export function useCreateTracking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newTracking: CreateTrackingPayload) => {
      const { data } = await apiClient.post<Tracking>('/trackings', newTracking)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackings'] })
    },
  })
}
