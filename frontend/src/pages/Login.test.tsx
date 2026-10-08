import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import Login from './Login'
import { renderWithProviders } from '../test/renderWithProviders'

const signedOut = { status: 'unauthenticated', user: null, mode: null } as const

const app = (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/dashboard" element={<div>dashboard page</div>} />
  </Routes>
)

describe('Login page', () => {
  it('offers both Auth0 login and the demo', () => {
    renderWithProviders(app, { route: '/login', auth: signedOut })

    expect(screen.getByRole('button', { name: 'Log in' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Try the demo' })).toBeEnabled()
  })

  it('starts Auth0 login, returning to the dashboard afterwards', async () => {
    const loginWithAuth0 = vi.fn()
    renderWithProviders(app, { route: '/login', auth: { ...signedOut, loginWithAuth0 } })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Log in' }))
    expect(loginWithAuth0).toHaveBeenCalledWith('/dashboard')
  })

  it('starts the demo and goes to the dashboard', async () => {
    const startDemo = vi.fn()
    renderWithProviders(app, { route: '/login', auth: { ...signedOut, startDemo } })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Try the demo' }))
    expect(startDemo).toHaveBeenCalledOnce()
    expect(await screen.findByText('dashboard page')).toBeInTheDocument()
  })

  it('disables login, but not the demo, when Auth0 is not configured', () => {
    renderWithProviders(app, { route: '/login', auth: { ...signedOut, auth0Available: false } })

    expect(screen.getByRole('button', { name: 'Log in' })).toBeDisabled()
    expect(screen.getByText('Login is not configured in this environment.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try the demo' })).toBeEnabled()
  })

  it('skips the page for someone who is already signed in', () => {
    renderWithProviders(app, { route: '/login' })
    expect(screen.getByText('dashboard page')).toBeInTheDocument()
  })

  it('waits while the session is loading instead of flashing the form', () => {
    renderWithProviders(app, { route: '/login', auth: { status: 'loading', user: null } })

    expect(screen.getByText('Checking your session…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument()
  })
})
