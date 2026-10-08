import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import App from './App'
import { renderWithProviders } from './test/renderWithProviders'
import { server } from './test/msw/server'
import { API } from './test/msw/handlers'

const empty = { ACTIVE: [], COMPLETED: [], FAILED: [], ARCHIVED: [] }
const signedOut = { status: 'unauthenticated', user: null, mode: null } as const

describe('App routing', () => {
  it('sends the root to the dashboard for a signed-in user', async () => {
    server.use(http.get(`${API}/v1/batches/dashboard`, () => HttpResponse.json(empty)))
    renderWithProviders(<App />, { route: '/' })

    expect(
      await screen.findByRole('heading', { name: 'Cultivation Dashboard' }),
    ).toBeInTheDocument()
  })

  it('shows settings inside the app layout', () => {
    renderWithProviders(<App />, { route: '/settings' })

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument() // the header
  })

  it('keeps signed-out visitors out of every app page', () => {
    for (const path of ['/dashboard', '/settings', '/batches/abc/trackings']) {
      const { unmount } = renderWithProviders(<App />, { route: path, auth: signedOut })
      expect(screen.getByRole('button', { name: 'Try the demo' })).toBeInTheDocument()
      unmount()
    }
  })

  it('shows the login page without requiring a session', () => {
    renderWithProviders(<App />, { route: '/login', auth: signedOut })

    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
  })

  it('shows progress on the Auth0 callback route, and the error if the exchange failed', () => {
    const { unmount } = renderWithProviders(<App />, { route: '/callback', auth: signedOut })
    expect(screen.getByText('Signing you in…')).toBeInTheDocument()
    unmount()

    renderWithProviders(<App />, {
      route: '/callback',
      auth: { ...signedOut, error: new Error('invalid_grant') },
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in failed')
    expect(screen.getByText('invalid_grant')).toBeInTheDocument()
  })
})

describe('App layout', () => {
  it('flags demo mode and lets the visitor leave it', async () => {
    const logout = vi.fn()
    server.use(http.get(`${API}/v1/batches/dashboard`, () => HttpResponse.json(empty)))
    renderWithProviders(<App />, { route: '/dashboard', auth: { mode: 'demo', logout } })

    expect(screen.getByRole('status')).toHaveTextContent('Demo mode')
    const [banner] = screen.getAllByRole('button', { name: 'Exit demo' })
    await userEvent.setup().click(banner)
    expect(logout).toHaveBeenCalled()
  })

  it('shows no demo banner for a real session', async () => {
    server.use(http.get(`${API}/v1/batches/dashboard`, () => HttpResponse.json(empty)))
    renderWithProviders(<App />, { route: '/dashboard' })

    await screen.findByRole('heading', { name: 'Cultivation Dashboard' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
