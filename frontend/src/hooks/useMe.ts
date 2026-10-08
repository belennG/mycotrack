import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import { useAppAuth } from '../auth/AppAuthContext'
import type { Me } from '../types/me'

/** The signed-in user's profile and active organization (also served by the demo mock). */
export function useMe() {
  const { status } = useAppAuth()

  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await apiClient.get<Me>('/v1/me')
      return data
    },
    enabled: status === 'authenticated',
    // Rarely changes; the header shouldn't refetch on every navigation.
    staleTime: 10 * 60 * 1000,
  })
}
