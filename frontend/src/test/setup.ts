import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './msw/server'

// Node 25+ ships its own experimental `localStorage` that shadows jsdom's and has no working
// methods without a file path. Use a small in-memory Storage when the global one is unusable,
// so the suite behaves the same on any Node version.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() {
    return this.store.size
  }
  clear() {
    this.store.clear()
  }
  getItem(key: string) {
    return this.store.get(key) ?? null
  }
  key(index: number) {
    return [...this.store.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.store.delete(key)
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value))
  }
}
for (const name of ['localStorage', 'sessionStorage'] as const) {
  let usable = false
  try {
    usable = typeof globalThis[name]?.clear === 'function'
  } catch {
    usable = false
  }
  if (!usable) {
    Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true })
    Object.defineProperty(window, name, { value: globalThis[name], configurable: true })
  }
}

// jsdom lacks a few browser APIs that Chakra UI relies on.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList
}
window.HTMLElement.prototype.scrollIntoView ??= vi.fn()

// The API is mocked at the network level; any request without a handler is a test bug.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  cleanup()
  server.resetHandlers()
  sessionStorage.clear()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})
afterAll(() => server.close())
