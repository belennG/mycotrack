export interface Tracking {
  id: string;
  name: string;
  status: string;
  lastUpdated: string;
}

export type CreateTrackingPayload = Omit<Tracking, 'id' | 'createdAt'>;

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  totalPages: number;
}
