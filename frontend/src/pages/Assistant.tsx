import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Badge, Box, Button, Flex, Heading, HStack, Input, Text, VStack } from '@chakra-ui/react'
import { useAppAuth } from '../auth/AppAuthContext'
import AssistantMarkdown from '../components/AssistantMarkdown'
import { SUGGESTED_QUESTIONS } from '../demo/assistantReplay'
import { useAskAssistant } from '../hooks/useAskAssistant'
import type { AssistantAnswer, AssistantToolCall } from '../types/assistant'
import { assistantErrorMessage } from '../utils/assistantErrors'

const MAX_QUESTION_CHARS = 1000 // the API's limit
const MAX_HISTORY_TURNS = 3 // the API accepts up to 6 messages, i.e. 3 question/answer pairs
const MAX_HISTORY_MESSAGE_CHARS = 6000 // the API's limit per message

/** Starters for the live assistant. In demo mode only the recorded questions can be answered. */
const LIVE_SUGGESTIONS = [
  'Which of my batches need attention?',
  'How are my active batches doing?',
  'Compare the average temperature of my active batches.',
  '¿Cómo van mis lotes activos?',
]

interface Turn {
  question: string
  reply: AssistantAnswer
}

/** "list_batches, get_batch_summary ×2" */
function toolSummary(calls: AssistantToolCall[]): string {
  const counts = new Map<string, number>()
  for (const call of calls) counts.set(call.name, (counts.get(call.name) ?? 0) + 1)
  return [...counts].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join(', ')
}

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

function About({ demo }: { demo: boolean }) {
  return (
    <Box as="details" borderWidth="1px" rounded="lg" p={3} fontSize="sm">
      <Box as="summary" cursor="pointer" fontWeight="semibold">
        About this assistant
      </Box>
      <VStack align="start" gap={2} mt={3}>
        {demo ? (
          <>
            <Text>
              You are in demo mode, so <strong>no AI model is called</strong>. The answers here are{' '}
              <strong>recordings</strong> of the real assistant (Claude Haiku 5.5) running on this
              same sample data. Pick a suggested question to replay one.
            </Text>
            <Text>
              Log in to ask the live assistant anything about your own batches. Dates inside a
              recording refer to the day it was made.
            </Text>
          </>
        ) : (
          <>
            <Text>
              Powered by Claude Haiku 5.5. It answers only from your organization&apos;s batches and
              readings.
            </Text>
            <Box as="ul" pl={5}>
              <li>It can read your data but never change it: it has no tool that writes.</li>
              <li>It sees only your active organization, never anyone else&apos;s.</li>
              <li>Names and notes you type are treated as data, never as instructions.</li>
              <li>Limited to 20 questions per hour.</li>
              <li>
                Your question and the data needed to answer it are sent to Anthropic&apos;s API.
              </li>
            </Box>
          </>
        )}
        <Text>
          Built from scratch, with no agent framework:{' '}
          <a
            href="https://github.com/belennG/mycotrack/blob/main/docs/agent.md"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'underline' }}
          >
            how it works and how it is kept safe
          </a>
          .
        </Text>
      </VStack>
    </Box>
  )
}

function UserBubble({ children }: { children: string }) {
  return (
    <Box alignSelf="flex-end" maxW="85%" bg="teal.600" color="white" px={4} py={2} rounded="xl">
      <Text whiteSpace="pre-wrap">{children}</Text>
    </Box>
  )
}

function AssistantBubble({ reply }: { reply: AssistantAnswer }) {
  return (
    <Box alignSelf="flex-start" maxW="95%" bg="bg.muted" px={4} py={3} rounded="xl">
      <AssistantMarkdown>{reply.answer}</AssistantMarkdown>
      {!reply.completed && (
        <Text mt={2} fontSize="sm" color="orange.500">
          This answer may be cut short.
        </Text>
      )}
      <HStack mt={3} gap={2} wrap="wrap" fontSize="xs" color="fg.muted">
        {reply.recording && (
          <Badge colorPalette="purple">
            Recorded answer · {formatDay(reply.recording.recorded_at)} · {reply.recording.model}
          </Badge>
        )}
        {reply.tool_calls.length > 0 && <Text>Looked at: {toolSummary(reply.tool_calls)}</Text>}
      </HStack>
    </Box>
  )
}

export default function Assistant() {
  const { mode } = useAppAuth()
  const demo = mode === 'demo'
  const ask = useAskAssistant()

  const [turns, setTurns] = useState<Turn[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [turns, pending, error])

  const send = (raw: string) => {
    const question = raw.trim()
    if (!question || pending !== null) return

    // Only answered turns go back as history: the API wants strictly alternating messages.
    const history = turns.slice(-MAX_HISTORY_TURNS).flatMap((turn) => [
      { role: 'user' as const, content: turn.question.slice(0, MAX_HISTORY_MESSAGE_CHARS) },
      {
        role: 'assistant' as const,
        content: turn.reply.answer.slice(0, MAX_HISTORY_MESSAGE_CHARS),
      },
    ])

    setPending(question)
    setError(null)
    setInput('')
    ask.mutate(
      { question, history },
      {
        onSuccess: (reply) => {
          setTurns((previous) => [...previous, { question, reply }])
          setPending(null)
        },
        onError: (failure) => {
          setError(assistantErrorMessage(failure))
          setInput(question) // let them retry without retyping
          setPending(null)
        },
      },
    )
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    send(input)
  }

  const clear = () => {
    setTurns([])
    setError(null)
  }

  const isEmpty = turns.length === 0 && pending === null
  // In the demo only the recorded questions have answers, so the ones not asked yet stay on offer
  // for the whole conversation. With the live assistant, suggestions only help start one.
  const asked = new Set([...turns.map((turn) => turn.question), ...(pending ? [pending] : [])])
  const suggestions = demo
    ? SUGGESTED_QUESTIONS.filter((question) => !asked.has(question))
    : isEmpty
      ? LIVE_SUGGESTIONS
      : []

  return (
    <Box maxW="3xl" mx="auto">
      <Heading mb={1}>Assistant</Heading>
      <Text color="fg.muted" mb={4}>
        Ask about your batches and readings. It can read your data, but it cannot change anything.
      </Text>

      <About demo={demo} />

      <VStack
        align="stretch"
        gap={3}
        mt={4}
        minH="40vh"
        role="log"
        aria-label="Conversation"
        aria-live="polite"
      >
        {turns.map((turn, index) => (
          <VStack key={index} align="stretch" gap={3}>
            <UserBubble>{turn.question}</UserBubble>
            <AssistantBubble reply={turn.reply} />
          </VStack>
        ))}

        {pending !== null && (
          <VStack align="stretch" gap={3}>
            <UserBubble>{pending}</UserBubble>
            <Box alignSelf="flex-start" bg="bg.muted" px={4} py={2} rounded="xl">
              <Text role="status" color="fg.muted">
                Thinking…
              </Text>
            </Box>
          </VStack>
        )}

        {error && (
          <Box
            role="alert"
            borderWidth="1px"
            borderColor="red.500"
            color="red.500"
            rounded="lg"
            p={3}
          >
            {error}
          </Box>
        )}
        <div ref={endRef} />
      </VStack>

      {suggestions.length > 0 && (
        <Box mt={4}>
          <Text mb={2} color="fg.muted">
            {!demo
              ? 'Try asking:'
              : isEmpty
                ? 'Try one of these recorded questions:'
                : 'More recorded questions:'}
          </Text>
          <HStack wrap="wrap" gap={2}>
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                size="sm"
                variant="outline"
                disabled={pending !== null}
                onClick={() => send(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </HStack>
        </Box>
      )}

      {turns.length > 0 && (
        <Flex justify="flex-end" mt={2}>
          <Button size="xs" variant="ghost" disabled={pending !== null} onClick={clear}>
            Clear conversation
          </Button>
        </Flex>
      )}

      <Box as="form" onSubmit={handleSubmit} mt={4}>
        <HStack>
          <Input
            aria-label="Your question"
            placeholder="Ask about your batches…"
            value={input}
            maxLength={MAX_QUESTION_CHARS}
            onChange={(event) => setInput(event.target.value)}
          />
          <Button type="submit" colorPalette="teal" disabled={!input.trim() || pending !== null}>
            Ask
          </Button>
        </HStack>
        {demo && (
          <Text mt={2} fontSize="xs" color="fg.muted">
            Demo mode: only the suggested questions have a recorded answer.
          </Text>
        )}
      </Box>
    </Box>
  )
}
