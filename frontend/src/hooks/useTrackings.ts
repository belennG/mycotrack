import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import type { Tracking, CreateTrackingPayload, PaginatedResponse } from '../types/tracking'
import { appToast } from '../utils/appToast'

export function useTrackings(batchId: string, page: number = 1, limit: number = 10) {
  return useQuery({
    queryKey: ['trackings', batchId, page],
    queryFn: async () => {
      const skip = (page - 1) * limit
      const { data } = await apiClient.get<PaginatedResponse<Tracking>>(
        `/v1/trackings/?batch_id=${batchId}&skip=${skip}&limit=${limit}`,
      )
      return data
    },
    enabled: !!batchId,
  })
}

export function useTracking(id?: string) {
  return useQuery({
    queryKey: ['tracking', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Tracking>(`/v1/trackings/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateTracking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newTracking: CreateTrackingPayload) => {
      const { data } = await apiClient.post<Tracking>('/v1/trackings/', newTracking)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trackings', data.batch_id] })
      appToast.success('Tracking added', 'Tracking entry saved successfully.')
    },
    onError: (error: any) => {
      const errorMessage =
        error.response?.data?.detail || 'An unexpected error occurred while saving.'
      appToast.error('Failed to Add Tracking', errorMessage)
    },
  })
}

export function useUpdateTracking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Tracking> }) => {
      const { data } = await apiClient.put<Tracking>(`/v1/trackings/${id}`, payload)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tracking', data.id] })
      queryClient.invalidateQueries({ queryKey: ['trackings', data.batch_id] })
      appToast.success('Log Updated', 'Tracking entry updated successfully.')
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.detail || 'An unexpected error occurred.'
      appToast.error('Failed to Update Log', errorMessage)
    },
  })
}

export function useDeleteTracking() {
  const queryClient = useQueryClient()

  return useMutation({
    // Passing both tracking ID and batch ID so we can strictly invalidate the correct list
    mutationFn: async ({ id }: { id: string; batchId: string }) => {
      await apiClient.delete(`/v1/trackings/${id}`)
      return id
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trackings', variables.batchId] })
      appToast.success('Log Deleted', 'Tracking entry removed successfully.')
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.detail || 'Could not delete entry.'
      appToast.error('Delete Failed', errorMessage)
    },
  })
}
