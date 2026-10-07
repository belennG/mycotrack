import { useSyncExternalStore } from 'react'

/**
 * Demo mode lets visitors explore the app without an account. While active, every
 * API call is answered by an in-browser mock (see demoAdapter.ts) — nothing is sent
 * to the backend. The flag lives in sessionStorage so a refresh keeps the demo, but
 * closing the tab ends it.
 */
const STORAGE_KEY = 'mycotrack-demo-mode'

const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function write(value: boolean) {
  try {
    if (value) sessionStorage.setItem(STORAGE_KEY, '1')
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable (private mode, etc.) — demo simply won't survive a reload.
  }
  listeners.forEach((listener) => listener())
}

export const isDemoMode = read

export function enterDemoMode() {
  write(true)
}

export function exitDemoMode() {
  write(false)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDemoMode(): boolean {
  return useSyncExternalStore(subscribe, read, () => false)
}
