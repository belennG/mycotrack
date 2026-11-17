import { isAxiosError } from 'axios'

/** Turn a failed assistant request into a sentence for the person who asked. */
export function assistantErrorMessage(error: unknown): string {
  if (!isAxiosError(error)) return 'Something went wrong. Please try again.'

  const status = error.response?.status
  if (status === undefined)
    return 'Could not reach the server. Check your connection and try again.'

  if (status === 429) {
    const seconds = Number(error.response?.headers?.['retry-after'])
    const detail = error.response?.data?.detail
    const wait = Number.isFinite(seconds) && seconds > 0 ? formatWait(seconds) : 'a while'
    return `${typeof detail === 'string' ? detail : 'Too many questions.'} You can ask again in ${wait}.`
  }
  if (status === 502 || status === 503) {
    return 'The assistant is not available right now. Try again in a moment.'
  }
  if (status === 422) return 'That question could not be sent. Try shortening it.'

  return 'Something went wrong. Please try again.'
}

function formatWait(seconds: number): string {
  if (seconds < 90) return `${Math.ceil(seconds)} seconds`
  return `${Math.ceil(seconds / 60)} minutes`
}
