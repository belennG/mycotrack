export interface AssistantToolCall {
  name: string
  is_error: boolean
}

/** What POST /v1/assistant/ask returns. */
export interface AssistantAnswer {
  answer: string
  /** False when the answer was cut short by a limit. */
  completed: boolean
  tool_calls: AssistantToolCall[]
  input_tokens: number
  output_tokens: number
  /** Demo mode only: this answer is a recording of a real run, not a live reply. */
  recording?: { recorded_at: string; model: string }
}

/** One earlier message, sent back so the assistant can follow the conversation. */
export interface AssistantHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AskAssistantPayload {
  question: string
  history: AssistantHistoryMessage[]
}
