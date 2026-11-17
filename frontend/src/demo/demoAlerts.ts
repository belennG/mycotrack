import type { Alert } from '../types/alert'
import type { Batch } from '../types/batch'
import type { Tracking } from '../types/tracking'
import { evaluateAlerts } from './alertRules'

/** The store the demo keeps its alerts in (a subset of DemoDb, to avoid a circular import). */
interface Store {
  batches: Batch[]
  trackings: Tracking[]
  alerts: Alert[]
}

// The backend looks at this many of the latest readings.
const LATEST_READINGS = 8

let counter = 0
const newAlertId = () => `demo-alert-${Date.now().toString(36)}-${counter++}`

/**
 * Evaluate a batch's readings and add the alerts that should be raised, as the real backend does
 * when a reading is saved: a kind of alert still unacknowledged for the batch is not raised twice.
 */
export function raiseAlerts(store: Store, batch: Batch, now: string): Alert[] {
  const readings = store.trackings
    .filter((reading) => reading.batch_id === batch.id)
    .sort((a, b) => b.tracking_date.localeCompare(a.tracking_date))
    .slice(0, LATEST_READINGS)

  const open = new Set(
    store.alerts
      .filter((alert) => alert.batch_id === batch.id && !alert.is_acknowledged)
      .map((alert) => alert.alert_type),
  )

  const created: Alert[] = []
  for (const candidate of evaluateAlerts(readings, batch.crop_type)) {
    if (open.has(candidate.alert_type)) continue
    open.add(candidate.alert_type)
    created.push({
      id: newAlertId(),
      batch_id: batch.id,
      batch_name: batch.batch_name,
      ...candidate,
      is_acknowledged: false,
      acknowledged_at: null,
      created_at: now,
    })
  }
  store.alerts.push(...created)
  return created
}

/** Alerts for the sample data: what the rules say about each batch's readings as they stand. */
export function seedAlerts(batches: Batch[], trackings: Tracking[]): Alert[] {
  const store: Store = { batches, trackings, alerts: [] }
  for (const batch of batches) {
    const latest = trackings
      .filter((reading) => reading.batch_id === batch.id)
      .map((reading) => reading.tracking_date)
      .sort()
      .pop()
    raiseAlerts(store, batch, latest ?? batch.updated_at)
  }
  return store.alerts
}
