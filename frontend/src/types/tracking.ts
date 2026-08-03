export interface Tracking {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

export type CreateTrackingPayload = Omit<Tracking, 'id' | 'createdAt'>;
