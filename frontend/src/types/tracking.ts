export type BatchStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'ARCHIVED'
export interface Tracking {
  id: string;
  batch_name: string;
  crop_type: string;
  status: BatchStatus;
  start_date: string;
  expected_harvest_date: string;
  actual_harvest_date?: string | null;
  location: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateTrackingPayload = Omit<
  Tracking,
  'id' | 'created_at' | 'updated_at' | 'actual_harvest_date'
>;

// Generic type for paginated API responses
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  totalPages: number;
}
