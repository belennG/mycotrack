import { useMutation } from '@tanstack/react-query'
import { apiClient } from '../api/client'
import type { AskAssistantPayload, AssistantAnswer } from '../types/assistant'

/** Ask the assistant. In demo mode the API client answers from the recordings. */
export function useAskAssistant() {
  return useMutation({
    mutationFn: async (payload: AskAssistantPayload) => {
      const { data } = await apiClient.post<AssistantAnswer>('/v1/assistant/ask', payload)
      return data
    },
  })
}
