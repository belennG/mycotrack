import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import { appToast } from '../utils/appToast'
import type { Alert, AlertList } from '../types/alert'

export type AlertFilter = 'open' | 'acknowledged'

/** The most the API returns in one page. */
export const ALERTS_PAGE = 100

export function useAlerts(filter: AlertFilter) {
  return useQuery({
    queryKey: ['alerts', filter],
    queryFn: async () => {
      const acknowledged = filter === 'acknowledged'
      const { data } = await apiClient.get<AlertList>(
        `/v1/alerts?is_acknowledged=${acknowledged}&limit=${ALERTS_PAGE}`,
      )
      return data
    },
  })
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<Alert>(`/v1/alerts/${id}/acknowledge`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'An unexpected error occurred.'
      appToast.error('Could not acknowledge the alert', message)
    },
  })
}
