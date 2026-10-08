import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { enterDemoMode } from '../demo/demoMode'

// Pretend Auth0 is configured, and control what the Auth0 SDK reports.
const auth0 = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  loginWithRedirect: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('./auth0Config', () => ({
  auth0Config: { domain: 'tenant.example.com', clientId: 'client', audience: 'https://api' },
  isAuth0Configured: true,
  redirectUri: 'http://localhost/callback',
}))
vi.mock('@auth0/auth0-react', () => ({
  Auth0Provider: ({ children }: { children: React.ReactNode }) => children,
  useAuth0: () => ({
    isLoading: false,
    isAuthenticated: false,
    user: undefined,
    error: undefined,
    loginWithRedirect: auth0.loginWithRedirect,
    logout: auth0.logout,
    ...auth0.state,
  }),
}))
vi.mock('./AccessTokenBridge', () => ({ AccessTokenBridge: () => null }))

import { Auth0ProviderWithNavigate } from './Auth0ProviderWithNavigate'
import { useAppAuth } from './AppAuthContext'

function Consumer() {
  const auth = useAppAuth()
  return (
    <div>
      <p data-testid="state">
        {auth.status}|{auth.mode ?? 'none'}|{auth.user?.name ?? 'nobody'}|{auth.user?.email ?? '-'}
      </p>
      <p data-testid="error">{auth.error?.message ?? 'no error'}</p>
      <button onClick={() => auth.loginWithAuth0('/trackings')}>login</button>
      <button onClick={auth.startDemo}>demo</button>
      <button onClick={auth.logout}>logout</button>
    </div>
  )
}

function setup() {
  const queryClient = new QueryClient()
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Auth0ProviderWithNavigate>
          <Consumer />
        </Auth0ProviderWithNavigate>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return userEvent.setup()
}

beforeEach(() => {
  auth0.state = {}
  auth0.loginWithRedirect.mockReset()
  auth0.logout.mockReset()
})

describe('auth with Auth0 configured', () => {
  it('reports "loading" while Auth0 restores the session', () => {
    auth0.state = { isLoading: true }
    setup()
    expect(screen.getByTestId('state')).toHaveTextContent('loading|none')
  })

  it('reports signed out when there is no session', () => {
    setup()
    expect(screen.getByTestId('state')).toHaveTextContent('unauthenticated|none|nobody')
  })

  it('maps the Auth0 user for a signed-in session', () => {
    auth0.state = { isAuthenticated: true, user: { name: 'Belén', email: 'b@example.com' } }
    setup()
    expect(screen.getByTestId('state')).toHaveTextContent('authenticated|auth0|Belén|b@example.com')
  })

  it('surfaces an Auth0 error', () => {
    auth0.state = { error: new Error('access_denied') }
    setup()
    expect(screen.getByTestId('error')).toHaveTextContent('access_denied')
  })

  it('starts Auth0 login and remembers where to return', async () => {
    const user = setup()
    await user.click(screen.getByText('login'))

    expect(auth0.loginWithRedirect).toHaveBeenCalledWith({ appState: { returnTo: '/trackings' } })
  })

  it('logs out through Auth0, returning to the site root', async () => {
    auth0.state = { isAuthenticated: true, user: { name: 'Belén' } }
    const user = setup()
    await user.click(screen.getByText('logout'))

    expect(auth0.logout).toHaveBeenCalledWith({
      logoutParams: { returnTo: window.location.origin },
    })
  })

  it('lets the demo take over, even for a signed-out visitor', async () => {
    const user = setup()
    await user.click(screen.getByText('demo'))

    expect(screen.getByTestId('state')).toHaveTextContent('authenticated|demo|Demo User')
  })

  it('treats the demo as signed in even while Auth0 is still loading', () => {
    auth0.state = { isLoading: true }
    enterDemoMode()
    setup()

    expect(screen.getByTestId('state')).toHaveTextContent('authenticated|demo|Demo User')
  })

  it('leaves the demo without touching Auth0', async () => {
    enterDemoMode()
    const user = setup()
    await user.click(screen.getByText('logout'))

    expect(auth0.logout).not.toHaveBeenCalled()
    expect(screen.getByTestId('state')).toHaveTextContent('unauthenticated|none')
  })
})
