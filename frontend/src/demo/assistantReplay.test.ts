import { describe, expect, it } from 'vitest'
import { createSeed } from './demoData'
import { seedAlerts } from './demoAlerts'
import { NO_RECORDING_ANSWER, replayAssistant, SUGGESTED_QUESTIONS } from './assistantReplay'

/** Average of one batch's readings for a metric, rounded like the backend does (2 places). */
function average(batchName: string, metric: 'temperature') {
  const db = createSeed()
  const batch = db.batches.find((b) => b.batch_name === batchName)!
  const values = db.trackings
    .filter((t) => t.batch_id === batch.id)
    .map((t) => t[metric])
    .filter((v): v is number => v !== null && v !== undefined)
  return (values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2)
}

describe('replayAssistant', () => {
  it('offers the recorded questions as suggestions', () => {
    expect(SUGGESTED_QUESTIONS.length).toBeGreaterThanOrEqual(5)
    expect(SUGGESTED_QUESTIONS).toContain('Which of my batches need attention?')
  })

  it.each(SUGGESTED_QUESTIONS)('has a labelled recording for "%s"', (question) => {
    const reply = replayAssistant(question)

    expect(reply.answer.length).toBeGreaterThan(20)
    expect(reply.answer).not.toBe(NO_RECORDING_ANSWER)
    expect(reply.completed).toBe(true)
    // Never passed off as live: always carries when and by which model it was recorded.
    expect(reply.recording?.model).toMatch(/^claude-/)
    expect(new Date(reply.recording!.recorded_at).getFullYear()).toBeGreaterThanOrEqual(2026)
  })

  it('matches questions regardless of case and spacing', () => {
    const reply = replayAssistant('  how IS   oyster-block-01   doing?  ')
    expect(reply.recording).toBeDefined()
    expect(reply.answer).toContain('Oyster-Block-01')
  })

  it('says plainly that it only has recordings when asked something else', () => {
    const reply = replayAssistant('What is the weather tomorrow?')

    expect(reply.answer).toBe(NO_RECORDING_ANSWER)
    expect(reply.recording).toBeUndefined()
    expect(reply.tool_calls).toEqual([])
  })

  it('records the refusal to write, with no tools used', () => {
    const reply = replayAssistant('Add a reading of 23 °C to Oyster-Block-01.')
    expect(reply.tool_calls).toEqual([])
    expect(reply.answer).toMatch(/can't add|cannot add|read-only/i)
  })

  it('reports which tools the real run used', () => {
    const reply = replayAssistant('Compare the average temperature of my active batches.')
    expect(reply.tool_calls.map((c) => c.name)).toEqual([
      'list_batches',
      'get_batch_summary',
      'get_batch_summary',
    ])
  })
})

describe('the recordings match the demo sample data', () => {
  // The recordings were made on the sample data of demoData.ts. If that data changes, they go
  // stale: these tests fail, and `python -m scripts.record_demo_answers` (in backend/) redoes them.

  it('only mention batches that exist in the sample data', () => {
    const names = createSeed().batches.map((b) => b.batch_name)
    for (const question of SUGGESTED_QUESTIONS) {
      for (const mentioned of question.match(/[A-Za-z]+-[A-Za-z0-9-]+/g) ?? []) {
        expect(names, `"${question}" mentions ${mentioned}`).toContain(mentioned)
      }
    }
  })

  it('quote averages that the sample data really produces', () => {
    const answer = replayAssistant('Compare the average temperature of my active batches.').answer

    expect(answer).toContain(average('Oyster-Block-01', 'temperature'))
    expect(answer).toContain(average('Shiitake-Log-07', 'temperature'))
  })

  it('explain an alert that the sample data really raises', () => {
    const seed = createSeed()
    const batch = seed.batches.find((b) => b.batch_name === 'Oyster-Block-01')!
    const raised = seedAlerts(seed.batches, seed.trackings).filter((a) => a.batch_id === batch.id)
    expect(raised.map((a) => a.alert_type)).toEqual(['humidity_trending_low'])

    const reply = replayAssistant('Why is there an alert on Oyster-Block-01?')

    expect(reply.tool_calls.map((c) => c.name)).toContain('list_alerts')
    expect(reply.answer).toContain('humidity_trending_low')
    expect(reply.answer).toContain('87.3')
  })
})
