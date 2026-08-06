// src/types/tracking.ts

export interface Tracking {
  id: string; // UUID from BaseModel
  batch_id: string; // UUID
  tracking_date: string; // ISO Date string (YYYY-MM-DD)
  temperature: number | null;
  humidity: number | null;
  ph_level: number | null;
  moisture: number | null;
  notes: string | null;
  created_at: string; // ISO DateTime string
  updated_at: string; // ISO DateTime string
}

export interface CreateTrackingPayload {
  batch_id: string;
  tracking_date?: string; // Optional, defaults to today on backend
  temperature?: number;
  humidity?: number;
  ph_level?: number;
  moisture?: number;
  notes?: string;
}

export interface PaginatedResponse<T> {
  total: number;
  items: T[];
}
