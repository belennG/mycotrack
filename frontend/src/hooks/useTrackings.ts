import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import type { Tracking, CreateTrackingPayload } from '../types/tracking'

export function useTrackings() {
  return useQuery({
    queryKey: ['trackings'],
    queryFn: async () => {
      const { data } = await apiClient.get<Tracking[]>('/trackings')
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
