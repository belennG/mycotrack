import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import { appToast } from '../utils/appToast'
import type { Tracking, CreateTrackingPayload } from '../types/tracking'

export function useCreateTracking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newTracking: CreateTrackingPayload) => {
      const { data } = await apiClient.post<Tracking>('/v1/trackings', newTracking)
      return data
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['trackings'] })
      appToast.success('Tracking Created', 'Tracking for batch has been saved.')
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.detail || 'An unexpected error occurred.'
      appToast.error('Failed to Create Tracking', errorMessage)
    },
  })
}
