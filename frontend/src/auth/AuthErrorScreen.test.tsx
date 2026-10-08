import { afterEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthErrorScreen } from './AuthErrorScreen'
import { renderWithProviders } from '../test/renderWithProviders'

const realLocation = window.location

afterEach(() => {
  Object.defineProperty(window, 'location', { value: realLocation, configurable: true })
})

describe('AuthErrorScreen', () => {
  it('shows the title and message as an alert', () => {
    renderWithProviders(<AuthErrorScreen title="Sign-in failed" message="Access denied" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in failed')
    expect(screen.getByText('Access denied')).toBeInTheDocument()
  })

  it('goes back with a full page load, which clears the failed Auth0 state', async () => {
    const assign = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...realLocation, assign },
      configurable: true,
    })
    renderWithProviders(<AuthErrorScreen title="Sign-in failed" message="Access denied" />)

    await userEvent.setup().click(screen.getByRole('button', { name: 'Back to login' }))
    expect(assign).toHaveBeenCalledWith('/login')
  })
})
