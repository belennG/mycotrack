import type { AssistantAnswer } from '../types/assistant'
import recordings from './assistantRecordings.json'

/**
 * Demo mode has no backend, so it cannot call the assistant. These answers are recordings of
 * the real assistant (a real model) running on this same sample data, made by
 * `backend/scripts/record_demo_answers.py`. They are replayed, and always labelled as
 * recordings: nothing here pretends to be a live reply.
 */
export const SUGGESTED_QUESTIONS: string[] = recordings.answers.map((entry) => entry.question)

const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase()

export const NO_RECORDING_ANSWER =
  'In demo mode I can only replay recorded answers to the suggested questions. ' +
  'Log in to ask the live assistant anything about your own batches.'

export function replayAssistant(question: string): AssistantAnswer {
  const wanted = normalize(question)
  const entry = recordings.answers.find((candidate) => normalize(candidate.question) === wanted)

  if (!entry) {
    return {
      answer: NO_RECORDING_ANSWER,
      completed: true,
      tool_calls: [],
      input_tokens: 0,
      output_tokens: 0,
    }
  }

  return {
    answer: entry.answer,
    completed: true,
    tool_calls: entry.tools.map((name) => ({ name, is_error: false })),
    input_tokens: entry.input_tokens,
    output_tokens: entry.output_tokens,
    recording: { recorded_at: recordings.recorded_at, model: recordings.model },
  }
}
