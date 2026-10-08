import {
  AxiosError,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import type { Batch, BatchStatus, DashboardBatch, DashboardResponse } from '../types/batch'
import type { Tracking } from '../types/tracking'
import { createSeed, type DemoDb } from './demoData'

/**
 * An axios adapter that answers the MycoTrack API from an in-browser store, so the
 * UI can run end-to-end without a backend or an account. It mirrors the contract of
 * the real FastAPI routes (pagination, 404s, duplicate-name 400, ordering).
 *
 * The store is mirrored to sessionStorage: reloads keep your changes, closing the tab
 * discards them.
 */
const STORAGE_KEY = 'mycotrack-demo-db'
const LATENCY_MS = 150

let db: DemoDb | null = null

function load(): DemoDb {
  if (db) return db
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      db = JSON.parse(raw) as DemoDb
      return db
    }
  } catch {
    // fall through to a fresh seed
  }
  db = createSeed()
  persist()
  return db
}

function persist() {
  try {
    if (db) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // ignore — the in-memory copy still works for this page load
  }
}

/** Discard demo data (called when the visitor leaves the demo). */
export function resetDemoDb() {
  db = null
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `demo-${Math.random().toString(36).slice(2)}`

/** Newest reading first by when it was taken, then by when it was entered (as the API does). */
const byReadingTimeDesc = (a: Tracking, b: Tracking) =>
  b.tracking_date.localeCompare(a.tracking_date) || b.created_at.localeCompare(a.created_at)

function respond<T>(config: InternalAxiosRequestConfig, status: number, data: T): AxiosResponse<T> {
  return { data, status, statusText: String(status), headers: {}, config }
}

function fail(config: InternalAxiosRequestConfig, status: number, detail: string): never {
  const response = respond(config, status, { detail })
  throw new AxiosError(detail, String(status), config, null, response)
}

function body<T>(config: InternalAxiosRequestConfig): T {
  const { data } = config
  if (typeof data === 'string' && data) return JSON.parse(data) as T
  return (data ?? {}) as T
}

function route(config: InternalAxiosRequestConfig): AxiosResponse {
  const store = load()
  const method = (config.method ?? 'get').toLowerCase()
  const url = new URL(config.url ?? '', 'http://demo.local')
  const path = url.pathname.replace(/\/+$/, '')
  const params = url.searchParams

  // ---- batches ----------------------------------------------------------
  if (path === '/v1/batches/dashboard' && method === 'get') {
    const grouped: DashboardResponse = { ACTIVE: [], COMPLETED: [], FAILED: [], ARCHIVED: [] }
    const sorted = [...store.batches].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    for (const batch of sorted) {
      const latest =
        store.trackings
          .filter((t) => t.batch_id === batch.id)
          .sort((a, b) => b.tracking_date.localeCompare(a.tracking_date))[0] ?? null
      const entry: DashboardBatch = { ...batch, latest_tracking: latest }
      grouped[batch.status as BatchStatus].push(entry)
    }
    return respond(config, 200, grouped)
  }

  if (path === '/v1/batches' && method === 'get') {
    const page = Number(params.get('page') ?? 1)
    const limit = Number(params.get('limit') ?? 10)
    const sorted = [...store.batches].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    return respond(config, 200, {
      total: sorted.length,
      items: sorted.slice((page - 1) * limit, page * limit),
    })
  }

  if (path === '/v1/batches' && method === 'post') {
    const payload = body<Partial<Batch>>(config)
    if (store.batches.some((b) => b.batch_name === payload.batch_name)) {
      fail(config, 400, 'Batch name already exists')
    }
    const now = new Date().toISOString()
    const created = {
      ...payload,
      id: newId(),
      actual_harvest_date: null,
      created_at: now,
      updated_at: now,
    } as Batch
    store.batches.push(created)
    persist()
    return respond(config, 201, created)
  }

  const batchMatch = path.match(/^\/v1\/batches\/([^/]+)$/)
  if (batchMatch) {
    const batch = store.batches.find((b) => b.id === batchMatch[1])
    if (!batch) fail(config, 404, 'Batch not found')

    if (method === 'get') return respond(config, 200, batch)

    if (method === 'put') {
      const payload = body<Partial<Batch>>(config)
      if (
        payload.batch_name &&
        payload.batch_name !== batch.batch_name &&
        store.batches.some((b) => b.batch_name === payload.batch_name)
      ) {
        fail(config, 400, 'Batch name already exists')
      }
      Object.assign(batch, payload, { updated_at: new Date().toISOString() })
      persist()
      return respond(config, 200, batch)
    }
  }

  // ---- trackings --------------------------------------------------------
  if (path === '/v1/trackings' && method === 'get') {
    const batchId = params.get('batch_id')
    const skip = Number(params.get('skip') ?? 0)
    const limit = Number(params.get('limit') ?? 10)
    const from = params.get('date_from')
    const to = params.get('date_to')
    const filtered = store.trackings
      .filter((t) => !batchId || t.batch_id === batchId)
      .filter((t) => !from || t.tracking_date.slice(0, 10) >= from)
      .filter((t) => !to || t.tracking_date.slice(0, 10) <= to)
      .sort(byReadingTimeDesc)
    return respond(config, 200, {
      total: filtered.length,
      items: filtered.slice(skip, skip + limit),
    })
  }

  if (path === '/v1/trackings' && method === 'post') {
    const payload = body<Partial<Tracking>>(config)
    const batch = store.batches.find((b) => b.id === payload.batch_id)
    if (!batch) fail(config, 404, 'Associated Batch not found')
    const now = new Date().toISOString()
    const created: Tracking = {
      temperature: null,
      humidity: null,
      ph_level: null,
      moisture: null,
      notes: null,
      ...payload,
      id: newId(),
      batch_id: batch.id,
      tracking_date: payload.tracking_date ? new Date(payload.tracking_date).toISOString() : now,
      created_at: now,
      updated_at: now,
    }
    store.trackings.push(created)
    batch.updated_at = now
    persist()
    return respond(config, 201, created)
  }

  const trackingMatch = path.match(/^\/v1\/trackings\/([^/]+)$/)
  if (trackingMatch) {
    const index = store.trackings.findIndex((t) => t.id === trackingMatch[1])
    if (index === -1) fail(config, 404, 'tracking not found')
    const tracking = store.trackings[index]

    if (method === 'get') return respond(config, 200, tracking)

    if (method === 'put') {
      Object.assign(tracking, body<Partial<Tracking>>(config), {
        updated_at: new Date().toISOString(),
      })
      persist()
      return respond(config, 200, tracking)
    }

    if (method === 'delete') {
      store.trackings.splice(index, 1)
      persist()
      return respond(config, 204, null)
    }
  }

  return fail(config, 404, `Demo mode: no mock for ${method.toUpperCase()} ${path}`)
}

export const demoAdapter: AxiosAdapter = (config) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(route(config))
      } catch (error) {
        reject(error)
      }
    }, LATENCY_MS)
  })
