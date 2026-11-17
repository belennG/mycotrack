import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import Assistant from './Assistant'
import { renderWithProviders } from '../test/renderWithProviders'
import { server } from '../test/msw/server'
import { API } from '../test/msw/handlers'
import { setDemoLatency } from '../demo/demoAdapter'
import { SUGGESTED_QUESTIONS } from '../demo/assistantReplay'
import { enterDemoMode } from '../demo/demoMode'
import type { AssistantAnswer, AskAssistantPayload } from '../types/assistant'

const answer = (over: Partial<AssistantAnswer> = {}): AssistantAnswer => ({
  answer: 'Oyster-Block-01 is **fine**.',
  completed: true,
  tool_calls: [{ name: 'list_batches', is_error: false }],
  input_tokens: 100,
  output_tokens: 20,
  ...over,
})

/** Serve the assistant endpoint, recording every request body it receives. */
function serveAssistant(
  respond: (body: AskAssistantPayload, call: number) => Response | AssistantAnswer,
) {
  const bodies: AskAssistantPayload[] = []
  server.use(
    http.post(`${API}/v1/assistant/ask`, async ({ request }) => {
      const body = (await request.json()) as AskAssistantPayload
      bodies.push(body)
      const result = respond(body, bodies.length)
      return result instanceof Response ? result : HttpResponse.json(result)
    }),
  )
  return bodies
}

async function ask(user: ReturnType<typeof userEvent.setup>, question: string) {
  await user.type(screen.getByRole('textbox', { name: 'Your question' }), `${question}{Enter}`)
}

describe('Assistant (live)', () => {
  it('suggests questions and explains what the assistant is and is not allowed to do', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Assistant />)

    expect(
      screen.getByRole('button', { name: 'Which of my batches need attention?' }),
    ).toBeVisible()
    await user.click(screen.getByText('About this assistant'))
    expect(screen.getByText(/never change it: it has no tool that writes/)).toBeVisible()
    expect(screen.getByText(/Limited to 20 questions per hour/)).toBeVisible()
    expect(screen.getByText(/sent to Anthropic/)).toBeVisible()
    expect(screen.queryByText(/demo mode/i)).not.toBeInTheDocument()
  })

  it('sends the question, shows the formatted answer and which tools it used', async () => {
    const user = userEvent.setup()
    const bodies = serveAssistant(() =>
      answer({
        tool_calls: [
          { name: 'list_batches', is_error: false },
          { name: 'get_batch_summary', is_error: false },
          { name: 'get_batch_summary', is_error: false },
        ],
      }),
    )
    renderWithProviders(<Assistant />)

    await ask(user, 'How is Oyster-Block-01?')

    const fine = await screen.findByText('fine')
    expect(fine.tagName).toBe('STRONG')
    expect(screen.getByText('How is Oyster-Block-01?')).toBeInTheDocument()
    expect(screen.getByText('Looked at: list_batches, get_batch_summary ×2')).toBeInTheDocument()
    expect(bodies).toEqual([{ question: 'How is Oyster-Block-01?', history: [] }])
    expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveValue('')
  })

  it('shows that it is working while it waits', async () => {
    const user = userEvent.setup()
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    server.use(
      http.post(`${API}/v1/assistant/ask`, async () => {
        await gate
        return HttpResponse.json(answer())
      }),
    )
    renderWithProviders(<Assistant />)

    await ask(user, 'first question')
    expect(await screen.findByRole('status')).toHaveTextContent('Thinking…')

    // Can't send a second question until the first is answered.
    await user.type(screen.getByRole('textbox', { name: 'Your question' }), 'second')
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled()

    release()
    await screen.findByText('fine')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask' })).toBeEnabled()
  })

  it('asks a suggestion straight away when it is clicked', async () => {
    const user = userEvent.setup()
    const bodies = serveAssistant(() => answer())
    renderWithProviders(<Assistant />)

    await user.click(screen.getByRole('button', { name: 'How are my active batches doing?' }))

    await screen.findByText('fine')
    expect(bodies[0].question).toBe('How are my active batches doing?')
    // Suggestions only make sense for an empty conversation.
    expect(screen.queryByRole('button', { name: 'How are my active batches doing?' })).toBeNull()
  })

  it('only offers suggestions to start a conversation, and can clear it', async () => {
    const user = userEvent.setup()
    serveAssistant(() => answer())
    renderWithProviders(<Assistant />)

    await user.click(screen.getByRole('button', { name: 'How are my active batches doing?' }))
    await screen.findByText('fine')
    expect(screen.queryByText('Try asking:')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear conversation' }))
    expect(screen.queryByText('fine')).not.toBeInTheDocument()
    expect(screen.getByText('Try asking:')).toBeVisible()
  })

  it('does not send a blank question', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Assistant />)

    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Your question' }), '   ')
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled()
  })

  describe('conversation', () => {
    it('sends the earlier questions and answers so a follow-up makes sense', async () => {
      const user = userEvent.setup()
      const bodies = serveAssistant((_, call) => answer({ answer: `Answer ${call}` }))
      renderWithProviders(<Assistant />)

      await ask(user, 'Question 1')
      await screen.findByText('Answer 1')
      await ask(user, 'Question 2')
      await screen.findByText('Answer 2')

      expect(bodies[1].history).toEqual([
        { role: 'user', content: 'Question 1' },
        { role: 'assistant', content: 'Answer 1' },
      ])
    })

    it('sends only the last three exchanges, the most the API accepts', async () => {
      const user = userEvent.setup()
      const bodies = serveAssistant((_, call) => answer({ answer: `Answer ${call}` }))
      renderWithProviders(<Assistant />)

      for (let n = 1; n <= 4; n++) {
        await ask(user, `Question ${n}`)
        await screen.findByText(`Answer ${n}`)
      }
      await ask(user, 'Question 5')
      await screen.findByText('Answer 5')

      const { history } = bodies[4]
      expect(history).toHaveLength(6)
      expect(history[0]).toEqual({ role: 'user', content: 'Question 2' })
      expect(history[5]).toEqual({ role: 'assistant', content: 'Answer 4' })
    })

    it('cuts a very long answer to what the API accepts when sending it back', async () => {
      const user = userEvent.setup()
      const bodies = serveAssistant((_, call) =>
        answer({ answer: call === 1 ? 'x'.repeat(9000) : 'ok' }),
      )
      renderWithProviders(<Assistant />)

      await ask(user, 'long one')
      await waitFor(() => expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled())
      await ask(user, 'next')
      await waitFor(() => expect(bodies).toHaveLength(2))

      expect(bodies[1].history[1].content).toHaveLength(6000)
    })
  })

  describe('when something goes wrong', () => {
    it('says so, keeps the question to retry, and does not count it as history', async () => {
      const user = userEvent.setup()
      const bodies = serveAssistant((_, call) =>
        call === 1 ? new HttpResponse(null, { status: 502 }) : answer(),
      )
      renderWithProviders(<Assistant />)

      await ask(user, 'will fail')
      expect(await screen.findByRole('alert')).toHaveTextContent('not available')
      expect(screen.getByRole('textbox', { name: 'Your question' })).toHaveValue('will fail')

      await user.click(screen.getByRole('button', { name: 'Ask' }))
      await screen.findByText('fine')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      // The failed question was never answered, so it is not part of the conversation.
      expect(bodies[1].history).toEqual([])
    })

    it('tells the person how long to wait when they have asked too much', async () => {
      const user = userEvent.setup()
      serveAssistant(
        () =>
          new HttpResponse(
            JSON.stringify({ detail: 'You have asked too many questions. Try again later.' }),
            { status: 429, headers: { 'Retry-After': '120', 'Content-Type': 'application/json' } },
          ),
      )
      renderWithProviders(<Assistant />)

      await ask(user, 'one too many')

      expect(await screen.findByRole('alert')).toHaveTextContent('You can ask again in 2 minutes')
    })

    it('warns when an answer was cut short', async () => {
      const user = userEvent.setup()
      serveAssistant(() => answer({ completed: false }))
      renderWithProviders(<Assistant />)

      await ask(user, 'a long question')

      expect(await screen.findByText('This answer may be cut short.')).toBeInTheDocument()
    })
  })
})

describe('Assistant (demo mode)', () => {
  beforeEach(() => {
    setDemoLatency(0)
    enterDemoMode()
  })
  afterEach(() => setDemoLatency(150))

  it('says that nothing here is a live model', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Assistant />, { auth: { mode: 'demo' } })

    await user.click(screen.getByText('About this assistant'))
    expect(screen.getByText(/no AI model is called/)).toBeVisible()
    expect(screen.getByText('Try one of these recorded questions:')).toBeVisible()
    expect(screen.queryByText(/Limited to 20 questions/)).not.toBeInTheDocument()
  })

  it('replays a recording, clearly labelled, without calling any API', async () => {
    const user = userEvent.setup()
    // No MSW handler exists for the assistant: a network call would fail the test.
    renderWithProviders(<Assistant />, { auth: { mode: 'demo' } })

    await user.click(screen.getByRole('button', { name: 'How is Oyster-Block-01 doing?' }))

    expect(await screen.findByText(/^Recorded answer · /)).toHaveTextContent('claude-haiku-5-5')
    expect(screen.getByText(/Looked at: list_batches, get_batch_summary/)).toBeInTheDocument()
  })

  it('keeps the other recorded questions on offer after one is asked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Assistant />, { auth: { mode: 'demo' } })
    const button = (name: string) => screen.queryByRole('button', { name })

    await user.click(screen.getByRole('button', { name: 'How is Oyster-Block-01 doing?' }))
    await screen.findByText(/^Recorded answer · /)

    // The one just asked is gone; every other recorded question can still be chosen.
    expect(button('How is Oyster-Block-01 doing?')).toBeNull()
    expect(screen.getByText('More recorded questions:')).toBeVisible()
    for (const other of SUGGESTED_QUESTIONS.filter((q) => q !== 'How is Oyster-Block-01 doing?')) {
      expect(button(other)).toBeEnabled()
    }

    await user.click(screen.getByRole('button', { name: 'Why did KingOyster-Trial-02 fail?' }))
    await waitFor(() => expect(screen.getAllByText(/^Recorded answer · /)).toHaveLength(2))
  })

  it('stops offering suggestions once every recorded question has been asked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Assistant />, { auth: { mode: 'demo' } })

    for (const [index, question] of SUGGESTED_QUESTIONS.entries()) {
      await user.click(screen.getByRole('button', { name: question }))
      await waitFor(() =>
        expect(screen.getAllByText(/^Recorded answer · /)).toHaveLength(index + 1),
      )
    }

    expect(screen.queryByText('More recorded questions:')).not.toBeInTheDocument()
  })

  it('can clear the conversation and start over with every question available again', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Assistant />, { auth: { mode: 'demo' } })

    await user.click(screen.getByRole('button', { name: 'How is Oyster-Block-01 doing?' }))
    await screen.findByText(/^Recorded answer · /)
    await user.click(screen.getByRole('button', { name: 'Clear conversation' }))

    expect(screen.queryByText(/^Recorded answer · /)).not.toBeInTheDocument()
    expect(screen.getByText('Try one of these recorded questions:')).toBeVisible()
    expect(screen.getByRole('button', { name: 'How is Oyster-Block-01 doing?' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Clear conversation' })).not.toBeInTheDocument()
  })

  it('says so when asked something that was not recorded', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Assistant />, { auth: { mode: 'demo' } })

    await ask(user, 'What is the weather tomorrow?')

    expect(await screen.findByText(/I can only replay recorded answers/)).toBeInTheDocument()
    expect(screen.queryByText(/^Recorded answer · /)).not.toBeInTheDocument()
  })
})
