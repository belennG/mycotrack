import { describe, expect, it } from 'vitest'
import cases from '../../../backend/tests/alert_cases.json'
import type { Tracking } from '../types/tracking'
import { evaluateAlerts, thresholdsFor } from './alertRules'

interface Row {
  hours: number
  temperature?: number
  humidity?: number
  ph_level?: number
  moisture?: number
}

const START = Date.UTC(2026, 10, 10, 8, 0)

const toReadings = (rows: Row[]): Tracking[] =>
  rows.map((row, i) => ({
    id: `r${i}`,
    batch_id: 'b',
    tracking_date: new Date(START + row.hours * 3_600_000).toISOString(),
    temperature: row.temperature ?? null,
    humidity: row.humidity ?? null,
    ph_level: row.ph_level ?? null,
    moisture: row.moisture ?? null,
    notes: null,
    created_at: '',
    updated_at: '',
  }))

describe('the demo copy of the alert rules', () => {
  // The same cases the Python rules pass (backend/tests/test_alert_cases.py).
  it.each(cases.cases)('$name', (testCase) => {
    const found = evaluateAlerts(toReadings(testCase.readings as Row[]), testCase.crop)
      .map((alert) => alert.alert_type)
      .sort()

    expect(found).toEqual(testCase.expected)
  })

  it('writes the same message as the backend for a falling trend', () => {
    const rows = [92.0, 90.6, 89.2, 87.8].map((humidity, i) => ({
      hours: 12 * i,
      humidity,
      temperature: 22,
      ph_level: 6.8,
      moisture: 80,
    }))

    const [alert] = evaluateAlerts(toReadings(rows), 'Oyster Mushroom')

    expect(alert.severity).toBe('warning')
    expect(alert.message).toBe(
      'Humidity has fallen on each of the last 4 readings (92 to 87.8). ' +
        'At this pace it would go below 85 in about 24 hours.',
    )
  })

  it('writes the same message as the backend for an out-of-range value', () => {
    const [alert] = evaluateAlerts(toReadings([{ hours: 0, temperature: 30.5 }]), 'Oyster')

    expect(alert).toMatchObject({ alert_type: 'temperature_out_of_range', severity: 'critical' })
    expect(alert.message).toBe('Temperature is too high (30.5). Safe range is 20.0 to 25.0.')
  })

  it('falls back to the oyster ranges for a crop it does not know', () => {
    expect(thresholdsFor('Reishi')).toEqual(thresholdsFor('Oyster'))
    expect(thresholdsFor(null)).toEqual(thresholdsFor('Oyster'))
  })
})
