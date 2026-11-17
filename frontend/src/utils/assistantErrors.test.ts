import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { assistantErrorMessage } from './assistantErrors'

function failure(status?: number, data: unknown = {}, headers: Record<string, string> = {}) {
  const config = { headers: new AxiosHeaders() }
  const response =
    status === undefined ? undefined : { status, data, headers, statusText: '', config }
  return new AxiosError('failed', undefined, config, null, response)
}

describe('assistantErrorMessage', () => {
  it('tells the person how long to wait when rate limited', () => {
    const message = assistantErrorMessage(
      failure(
        429,
        { detail: 'You have asked too many questions. Try again later.' },
        { 'retry-after': '45' },
      ),
    )
    expect(message).toContain('too many questions')
    expect(message).toContain('45 seconds')
  })

  it('switches to minutes for long waits', () => {
    expect(assistantErrorMessage(failure(429, {}, { 'retry-after': '1800' }))).toContain(
      '30 minutes',
    )
  })

  it('still answers when the wait is unknown', () => {
    expect(assistantErrorMessage(failure(429))).toContain('a while')
  })

  it.each([502, 503])('says the assistant is unavailable on a %s', (status) => {
    expect(assistantErrorMessage(failure(status))).toContain('not available')
  })

  it('suggests shortening when the question was rejected', () => {
    expect(assistantErrorMessage(failure(422))).toContain('shortening')
  })

  it('says the server could not be reached when there was no response', () => {
    expect(assistantErrorMessage(failure(undefined))).toContain('Could not reach the server')
  })

  it('does not expose server details for other failures', () => {
    const message = assistantErrorMessage(failure(500, { detail: 'secret internals' }))
    expect(message).not.toContain('secret')
    expect(assistantErrorMessage(new Error('boom'))).not.toContain('boom')
  })
})
