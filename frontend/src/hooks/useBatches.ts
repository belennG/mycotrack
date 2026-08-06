import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import { appToast } from '../utils/appToast'
import type { Batch, CreateBatchPayload, PaginatedResponse } from '../types/batch'

export function useBatches(page: number = 1) {
  return useQuery({
    queryKey: ['batches', page],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Batch>>(`/v1/batches?page=${page}`)
      return data
    },
  })
}

export function useBatch(id?: string) {
  return useQuery({
    queryKey: ['batch', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Batch>(`/v1/batches/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCreateBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newBatch: CreateBatchPayload) => {
      const { data } = await apiClient.post<Batch>('/v1/batches', newBatch)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      appToast.success('Batch Created', 'Your new cultivation batch has been saved.')
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.detail || 'An unexpected error occurred.'
      appToast.error('Failed to Create Batch', errorMessage)
    },
  })
}

export function useUpdateBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Batch> }) => {
      const { data } = await apiClient.put<Batch>(`/v1/batches/${id}`, payload)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['batch', data.id] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      appToast.success('Batch Updated', 'Batch details saved successfully.')
    },
  })
}
