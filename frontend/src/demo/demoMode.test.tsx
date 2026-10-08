import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { enterDemoMode, exitDemoMode, isDemoMode, useDemoMode } from './demoMode'

describe('demo mode flag', () => {
  it('is off by default', () => {
    expect(isDemoMode()).toBe(false)
  })

  it('is stored in sessionStorage so a reload keeps it', () => {
    enterDemoMode()
    expect(sessionStorage.getItem('mycotrack-demo-mode')).toBe('1')
    expect(isDemoMode()).toBe(true)

    exitDemoMode()
    expect(sessionStorage.getItem('mycotrack-demo-mode')).toBeNull()
    expect(isDemoMode()).toBe(false)
  })

  it('notifies React subscribers when it changes', () => {
    const { result } = renderHook(() => useDemoMode())
    expect(result.current).toBe(false)

    act(() => enterDemoMode())
    expect(result.current).toBe(true)

    act(() => exitDemoMode())
    expect(result.current).toBe(false)
  })
})
