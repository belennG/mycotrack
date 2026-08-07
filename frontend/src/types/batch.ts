import type { Tracking } from './tracking'

export type BatchStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ARCHIVED'
export interface Batch {
  id: string
  batch_name: string
  crop_type: string
  status: BatchStatus
  start_date: string
  expected_harvest_date: string
  actual_harvest_date?: string | null
  location: string
  notes?: string | null
  created_at: string
  updated_at: string
}

export type CreateBatchPayload = Omit<
  Batch,
  'id' | 'created_at' | 'updated_at' | 'actual_harvest_date'
>

// Generic type for paginated API responses
export interface PaginatedResponse<T> {
  items: T[]
  total: number
}

export interface DashboardBatch extends Batch {
  latest_tracking: Tracking | null
}

export interface DashboardResponse {
  ACTIVE: DashboardBatch[]
  COMPLETED: DashboardBatch[]
  FAILED: DashboardBatch[]
  ARCHIVED: DashboardBatch[]
}
