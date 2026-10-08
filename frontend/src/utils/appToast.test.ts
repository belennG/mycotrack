import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appToast } from './appToast'

const create = vi.hoisted(() => vi.fn())
vi.mock('../components/ui/toaster', () => ({ toaster: { create } }))

beforeEach(() => create.mockClear())

describe('appToast', () => {
  it('shows success toasts for 4 seconds', () => {
    appToast.success('Saved', 'All good')
    expect(create).toHaveBeenCalledWith({
      title: 'Saved',
      description: 'All good',
      type: 'success',
      duration: 4000,
    })
  })

  it('keeps error toasts up longer so they can be read', () => {
    appToast.error('Failed')
    expect(create).toHaveBeenCalledWith({
      title: 'Failed',
      description: undefined,
      type: 'error',
      duration: 6000,
    })
  })

  it('has an info variant', () => {
    appToast.info('FYI', 'Details')
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ type: 'info', duration: 4000 }))
  })
})
