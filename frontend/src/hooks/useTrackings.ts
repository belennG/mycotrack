import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import type { Tracking, CreateTrackingPayload, PaginatedResponse } from '../types/tracking'
import { appToast } from '../utils/appToast'

export function useTrackings(page: number = 1) {
  return useQuery({
    queryKey: ['batches', page],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Tracking>>(`/batches?page=${page}`)
      return data
    },
  })
}

export function useCreateTracking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newTracking: CreateTrackingPayload) => {
      const { data } = await apiClient.post<Tracking>('/batches', newTracking)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      appToast.success('Batch Created', 'Your new cultivation batch has been saved.')
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.detail || 'An unexpected error occurred while saving.'
      appToast.error('Failed to Create Batch', errorMessage)
    }
  })
}

// --- GET SINGLE Hook (For Edit Mode) ---
export function useTracking(id?: string) {
  return useQuery({
    queryKey: ['batches', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Tracking>(`/batches/${id}`)
      return data
    },
    enabled: !!id, // Only execute if an ID is provided
  })
}

// --- PUT Hook (Update existing tracking) ---
export function useUpdateTracking() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Tracking> }) => {
      const { data } = await apiClient.put<Tracking>(`/batches/${id}`, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
    },
  })
}
