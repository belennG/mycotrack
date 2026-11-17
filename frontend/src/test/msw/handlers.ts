import { http, HttpResponse } from 'msw'
import type { Batch } from '../../types/batch'
import type { Tracking } from '../../types/tracking'
import type { Me } from '../../types/me'
import type { Alert } from '../../types/alert'

/** Matches apiClient's default base URL (VITE_API_BASE_URL is unset under test). */
export const API = 'http://localhost:8000/api'

export const batchFixture = (over: Partial<Batch> = {}): Batch => ({
  id: 'batch-1',
  batch_name: 'Oyster-Block-01',
  crop_type: 'Oyster Mushroom',
  status: 'ACTIVE',
  start_date: '2026-10-01T00:00:00',
  expected_harvest_date: '2026-11-01T00:00:00',
  actual_harvest_date: null,
  location: 'Greenhouse A',
  notes: null,
  created_at: '2026-10-01T00:00:00',
  updated_at: '2026-10-01T00:00:00',
  ...over,
})

export const trackingFixture = (over: Partial<Tracking> = {}): Tracking => ({
  id: 'tracking-1',
  batch_id: 'batch-1',
  tracking_date: '2026-10-08T14:35:00',
  temperature: 22.5,
  humidity: 90,
  ph_level: 6.8,
  moisture: 82,
  notes: null,
  created_at: '2026-10-08T14:36:00',
  updated_at: '2026-10-08T14:36:00',
  ...over,
})

export const alertFixture = (over: Partial<Alert> = {}): Alert => ({
  id: 'alert-1',
  batch_id: 'batch-1',
  batch_name: 'Oyster-Block-01',
  alert_type: 'humidity_trending_low',
  severity: 'warning',
  message:
    'Humidity has fallen on each of the last 4 readings (91.2 to 87.3). ' +
    'At this pace it would go below 85 in about 19 hours.',
  is_acknowledged: false,
  acknowledged_at: null,
  created_at: '2026-11-17T08:00:00',
  ...over,
})

export const meFixture = (over: Partial<Me> = {}): Me => ({
  id: 'user-1',
  email: 'belen@example.com',
  name: 'Belén',
  picture: null,
  created_at: '2026-10-01T00:00:00',
  last_login_at: '2026-10-08T00:00:00',
  organization: { id: 'org-1', name: 'Legacy', slug: 'legacy', role: 'OWNER' },
  organizations: [{ id: 'org-1', name: 'Legacy', slug: 'legacy', role: 'OWNER' }],
  ...over,
})

/** Default happy-path handlers; individual tests override them with server.use(...). */
export const handlers = [
  http.get(`${API}/v1/me`, () => HttpResponse.json(meFixture())),
  http.get(`${API}/v1/alerts`, () => HttpResponse.json({ total: 0, items: [] })),
  http.get(`${API}/v1/batches`, () => HttpResponse.json({ total: 1, items: [batchFixture()] })),
  http.get(`${API}/v1/trackings/`, () =>
    HttpResponse.json({ total: 1, items: [trackingFixture()] }),
  ),
]
