export type AlertSeverity = 'critical' | 'warning'

export interface Alert {
  id: string
  batch_id: string
  batch_name: string
  /** e.g. "humidity_deviation" (out of range) or "humidity_trending_low" (heading there) */
  alert_type: string
  severity: AlertSeverity | string
  message: string
  is_acknowledged: boolean
  acknowledged_at: string | null
  created_at: string
}

export interface AlertList {
  total: number
  items: Alert[]
}
