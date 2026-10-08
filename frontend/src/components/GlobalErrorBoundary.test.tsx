import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GlobalErrorBoundary } from './GlobalErrorBoundary'
import { renderWithProviders } from '../test/renderWithProviders'

describe('GlobalErrorBoundary', () => {
  it('shows what went wrong and lets the user reload', async () => {
    const reset = vi.fn()
    renderWithProviders(
      <GlobalErrorBoundary error={new Error('boom')} resetErrorBoundary={reset} />,
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reload Application' }))
    expect(reset).toHaveBeenCalledOnce()
  })

  it('copes with a thrown value that is not an Error', () => {
    renderWithProviders(<GlobalErrorBoundary error="plain string" resetErrorBoundary={() => {}} />)
    expect(screen.getByText('plain string')).toBeInTheDocument()
  })
})
