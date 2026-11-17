import type { Tracking } from '../types/tracking'

/**
 * The alert rules, as a TypeScript copy of `backend/services/alerts.py` and
 * `backend/services/thresholds.py`, so the demo (which has no backend) raises the same alerts
 * the real app would. `backend/tests/alert_cases.json` is run against both copies, so they
 * cannot drift apart without a test failing.
 */
type Metric = 'temperature' | 'humidity' | 'ph_level' | 'moisture'
type Ranges = Record<Metric, { min: number; max: number }>

export interface AlertCandidate {
  alert_type: string
  severity: 'critical' | 'warning'
  message: string
}

const METRICS: Metric[] = ['temperature', 'humidity', 'ph_level', 'moisture']

const OYSTER: Ranges = {
  temperature: { min: 20, max: 25 },
  humidity: { min: 85, max: 95 },
  ph_level: { min: 6, max: 7.5 },
  moisture: { min: 75, max: 90 },
}
const SHIITAKE: Ranges = {
  temperature: { min: 12, max: 18 },
  humidity: { min: 80, max: 90 },
  ph_level: { min: 5.5, max: 6.5 },
  moisture: { min: 55, max: 65 },
}
const LIONS_MANE: Ranges = {
  temperature: { min: 15, max: 20 },
  humidity: { min: 85, max: 95 },
  ph_level: { min: 5.5, max: 6.5 },
  moisture: { min: 60, max: 70 },
}

const PRESETS: Array<[string[], Ranges]> = [
  [['shiitake'], SHIITAKE],
  [['lion', 'melena', 'hericium'], LIONS_MANE],
  [['oyster', 'ostra', 'pleurotus'], OYSTER],
]

export function thresholdsFor(cropType: string | null | undefined): Ranges {
  const text = (cropType ?? '').toLowerCase()
  for (const [words, ranges] of PRESETS) {
    if (words.some((word) => text.includes(word))) return ranges
  }
  return OYSTER
}

const THRESHOLD_TYPES: Record<Metric, string> = {
  temperature: 'temperature_out_of_range',
  humidity: 'humidity_deviation',
  ph_level: 'ph_level_anomaly',
  moisture: 'moisture_level_critical',
}

// Trend rule: this many readings in a row, all moving the same way, by at least this share of
// the range in total, crossing a limit within this many hours at that pace.
const TREND_WINDOW = 4
const MIN_MOVE_FRACTION = 0.05
const TREND_HORIZON_HOURS = 48

const label = (metric: Metric) =>
  metric
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

/** How Python prints a float: 20 -> "20.0", 7.5 -> "7.5". */
const asFloat = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n))
/** How Python's "{:g}" prints a number: 92 -> "92", 87.8 -> "87.8". */
const compact = (n: number) => String(Number(n.toPrecision(6)))

const time = (reading: Tracking) => new Date(reading.tracking_date).getTime()

function thresholdAlerts(latest: Tracking, ranges: Ranges): AlertCandidate[] {
  const found: AlertCandidate[] = []
  for (const metric of METRICS) {
    const value = latest[metric]
    if (value === null || value === undefined) continue // missing data is not saved
    const { min, max } = ranges[metric]
    if (value >= min && value <= max) continue
    found.push({
      alert_type: THRESHOLD_TYPES[metric],
      severity: 'critical',
      message:
        `${label(metric)} is too ${value < min ? 'low' : 'high'} (${value}). ` +
        `Safe range is ${asFloat(min)} to ${asFloat(max)}.`,
    })
  }
  return found
}

function trendAlerts(readings: Tracking[], ranges: Ranges): AlertCandidate[] {
  const ordered = [...readings].sort((a, b) => time(a) - time(b))
  const found: AlertCandidate[] = []

  for (const metric of METRICS) {
    const points = ordered
      .filter((reading) => reading[metric] !== null && reading[metric] !== undefined)
      .map((reading) => ({ at: time(reading), value: reading[metric] as number }))
      .slice(-TREND_WINDOW)
    if (points.length < TREND_WINDOW) continue

    const { min, max } = ranges[metric]
    const values = points.map((point) => point.value)
    const latest = values[values.length - 1]
    if (latest < min || latest > max) continue // already out of range: the threshold rule

    const steps = values.slice(1).map((value, i) => value - values[i])
    let direction: 'low' | 'high'
    let limit: number
    if (steps.every((step) => step < 0)) {
      direction = 'low'
      limit = min
    } else if (steps.every((step) => step > 0)) {
      direction = 'high'
      limit = max
    } else {
      continue
    }

    if (Math.abs(latest - values[0]) < MIN_MOVE_FRACTION * (max - min)) continue

    const spanHours = (points[points.length - 1].at - points[0].at) / 3_600_000
    if (spanHours <= 0) continue
    const rate = (latest - values[0]) / spanHours
    const hoursToLimit = (limit - latest) / rate
    if (hoursToLimit > TREND_HORIZON_HOURS) continue

    found.push({
      alert_type: `${metric}_trending_${direction}`,
      severity: 'warning',
      message:
        `${label(metric)} has ${direction === 'low' ? 'fallen' : 'risen'} on each of the last ` +
        `${TREND_WINDOW} readings (${compact(values[0])} to ${compact(latest)}). At this pace it ` +
        `would go ${direction === 'low' ? 'below' : 'above'} ${compact(limit)} in about ` +
        `${Math.round(Math.max(hoursToLimit, 0))} hours.`,
    })
  }
  return found
}

/** Every alert the rules raise for these readings of a batch of this crop. */
export function evaluateAlerts(
  readings: Tracking[],
  cropType: string | null | undefined,
): AlertCandidate[] {
  if (readings.length === 0) return []
  const ranges = thresholdsFor(cropType)
  const latest = readings.reduce((a, b) => (time(b) > time(a) ? b : a))
  return [...thresholdAlerts(latest, ranges), ...trendAlerts(readings, ranges)]
}
