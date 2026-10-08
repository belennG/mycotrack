import type { Batch, BatchStatus } from '../types/batch'
import type { Tracking } from '../types/tracking'

export interface DemoDb {
  batches: Batch[]
  trackings: Tracking[]
}

const DAY = 24 * 60 * 60 * 1000

// Small deterministic PRNG so the demo data looks the same on every visit.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface BatchSeed {
  batch_name: string
  crop_type: string
  status: BatchStatus
  location: string
  notes: string
  startedDaysAgo: number
  harvestInDays: number
  trackingDays: number
  // Baselines the daily readings drift around
  base: { temperature: number; humidity: number; ph_level: number; moisture: number }
  // Index (days ago) of a reading pushed out of range, to show alerts-worthy data
  excursionDaysAgo?: number
}

const SEEDS: BatchSeed[] = [
  {
    batch_name: 'Oyster-Block-01',
    crop_type: 'Oyster Mushroom',
    status: 'ACTIVE',
    location: 'Greenhouse Room A',
    notes: 'Inoculated on rye grain substrate. Fruiting expected next week.',
    startedDaysAgo: 18,
    harvestInDays: 6,
    trackingDays: 14,
    base: { temperature: 22.5, humidity: 90, ph_level: 6.8, moisture: 82 },
    excursionDaysAgo: 4,
  },
  {
    batch_name: 'Shiitake-Log-07',
    crop_type: 'Shiitake',
    status: 'ACTIVE',
    location: 'Cold Room B',
    notes: 'Oak logs, cold-shocked on day 40.',
    startedDaysAgo: 30,
    harvestInDays: 12,
    trackingDays: 14,
    base: { temperature: 21, humidity: 88, ph_level: 6.5, moisture: 80 },
  },
  {
    batch_name: 'LionsMane-Bag-03',
    crop_type: "Lion's Mane",
    status: 'COMPLETED',
    location: 'Greenhouse Room A',
    notes: 'Strong first flush, 1.4 kg total.',
    startedDaysAgo: 52,
    harvestInDays: -10,
    trackingDays: 10,
    base: { temperature: 23, humidity: 91, ph_level: 6.9, moisture: 84 },
  },
  {
    batch_name: 'KingOyster-Trial-02',
    crop_type: 'King Oyster',
    status: 'FAILED',
    location: 'Tent C',
    notes: 'Green mould detected on day 12 — contaminated substrate.',
    startedDaysAgo: 40,
    harvestInDays: -20,
    trackingDays: 8,
    base: { temperature: 24.5, humidity: 78, ph_level: 7.4, moisture: 70 },
    excursionDaysAgo: 0,
  },
  {
    batch_name: 'Reishi-Archive-2025',
    crop_type: 'Reishi',
    status: 'ARCHIVED',
    location: 'Storage Shelf 2',
    notes: 'Archived after harvest. Kept for reference.',
    startedDaysAgo: 120,
    harvestInDays: -60,
    trackingDays: 6,
    base: { temperature: 25, humidity: 86, ph_level: 6.2, moisture: 78 },
  },
]

const round = (n: number, digits = 1) => Number(n.toFixed(digits))

export function createSeed(): DemoDb {
  const now = Date.now()
  const rand = mulberry32(20260907)
  const batches: Batch[] = []
  const trackings: Tracking[] = []

  SEEDS.forEach((seed, batchIndex) => {
    const start = new Date(now - seed.startedDaysAgo * DAY)
    const batchId = `demo-batch-${batchIndex + 1}`
    const lastTrackingDaysAgo = seed.status === 'ACTIVE' ? 0 : Math.max(seed.startedDaysAgo - 20, 5)

    batches.push({
      id: batchId,
      batch_name: seed.batch_name,
      crop_type: seed.crop_type,
      status: seed.status,
      start_date: start.toISOString(),
      expected_harvest_date: new Date(now + seed.harvestInDays * DAY).toISOString(),
      actual_harvest_date:
        seed.status === 'COMPLETED' ? new Date(now + seed.harvestInDays * DAY).toISOString() : null,
      location: seed.location,
      notes: seed.notes,
      created_at: start.toISOString(),
      updated_at: new Date(now - lastTrackingDaysAgo * DAY).toISOString(),
    })

    for (let i = 0; i < seed.trackingDays; i++) {
      const daysAgo = lastTrackingDaysAgo + (seed.trackingDays - 1 - i)
      const date = new Date(now - daysAgo * DAY)
      const spike =
        seed.excursionDaysAgo !== undefined &&
        daysAgo - lastTrackingDaysAgo === seed.excursionDaysAgo
      const jitter = (amount: number) => (rand() - 0.5) * 2 * amount

      trackings.push({
        id: `demo-tracking-${batchIndex + 1}-${i + 1}`,
        batch_id: batchId,
        tracking_date: date.toISOString(),
        temperature: round(seed.base.temperature + jitter(1.2) + (spike ? 6 : 0)),
        humidity: round(Math.min(100, seed.base.humidity + jitter(3) - (spike ? 15 : 0))),
        ph_level: round(seed.base.ph_level + jitter(0.2), 2),
        moisture: round(Math.min(100, seed.base.moisture + jitter(2))),
        notes: spike
          ? 'Ventilation fault — readings out of range.'
          : i % 5 === 0
            ? 'Routine check.'
            : null,
        created_at: date.toISOString(),
        updated_at: date.toISOString(),
      })
    }
  })

  // Active batches get a second, earlier reading on their last few days, so the demo shows
  // several readings per day with their times.
  SEEDS.forEach((seed, batchIndex) => {
    if (seed.status !== 'ACTIVE') return
    for (let daysAgo = 0; daysAgo < 3; daysAgo++) {
      const date = new Date(now - daysAgo * DAY - 9 * 60 * 60 * 1000)
      trackings.push({
        id: `demo-tracking-${batchIndex + 1}-morning-${daysAgo}`,
        batch_id: `demo-batch-${batchIndex + 1}`,
        tracking_date: date.toISOString(),
        temperature: round(seed.base.temperature - 0.8 + (rand() - 0.5)),
        humidity: round(Math.min(100, seed.base.humidity + 1 + (rand() - 0.5) * 2)),
        ph_level: round(seed.base.ph_level + (rand() - 0.5) * 0.2, 2),
        moisture: round(Math.min(100, seed.base.moisture + (rand() - 0.5) * 2)),
        notes: null,
        created_at: date.toISOString(),
        updated_at: date.toISOString(),
      })
    }
  })

  return { batches, trackings }
}
