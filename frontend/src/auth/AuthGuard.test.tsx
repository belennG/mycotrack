import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AuthGuard } from './AuthGuard'
import { renderWithProviders } from '../test/renderWithProviders'

function LoginProbe() {
  const location = useLocation()
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo
  return <div>login page (returnTo: {returnTo})</div>
}

const app = (
  <Routes>
    <Route path="/login" element={<LoginProbe />} />
    <Route element={<AuthGuard />}>
      <Route path="/dashboard" element={<div>secret dashboard</div>} />
    </Route>
  </Routes>
)

describe('AuthGuard', () => {
  it('renders the protected route for a signed-in user', () => {
    renderWithProviders(app, { route: '/dashboard' })
    expect(screen.getByText('secret dashboard')).toBeInTheDocument()
  })

  it('renders the protected route for a demo visitor', () => {
    renderWithProviders(app, { route: '/dashboard', auth: { mode: 'demo' } })
    expect(screen.getByText('secret dashboard')).toBeInTheDocument()
  })

  it('sends a signed-out visitor to /login, remembering where they were headed', () => {
    renderWithProviders(app, {
      route: '/dashboard?tab=1',
      auth: { status: 'unauthenticated', user: null, mode: null },
    })

    expect(screen.getByText(/login page/)).toHaveTextContent('returnTo: /dashboard?tab=1')
    expect(screen.queryByText('secret dashboard')).not.toBeInTheDocument()
  })

  it('shows a spinner, not the page or a redirect, while the session is loading', () => {
    renderWithProviders(app, { route: '/dashboard', auth: { status: 'loading', user: null } })

    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
    expect(screen.queryByText('secret dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText(/login page/)).not.toBeInTheDocument()
  })

  it('shows the authentication error with a way back', () => {
    renderWithProviders(app, {
      route: '/dashboard',
      auth: { status: 'unauthenticated', error: new Error('Client is not authorized') },
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Authentication error')
    expect(screen.getByText('Client is not authorized')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to login' })).toBeInTheDocument()
  })
})
