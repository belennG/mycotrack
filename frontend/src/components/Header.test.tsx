import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import Header from './Header'
import { renderWithProviders } from '../test/renderWithProviders'
import { server } from '../test/msw/server'
import { API, alertFixture, meFixture } from '../test/msw/handlers'

describe('Header: theme', () => {
  it('toggles dark mode on the page and remembers it', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Header />)

    await user.click(screen.getByRole('button', { name: /dark/i }))
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('theme')).toBe('dark')

    await user.click(screen.getByRole('button', { name: /light/i }))
    expect(document.documentElement).not.toHaveClass('dark')
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('restores a saved dark preference on load', () => {
    localStorage.setItem('theme', 'dark')
    renderWithProviders(<Header />)

    expect(document.documentElement).toHaveClass('dark')
    expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument()
  })
})

describe('Header: navigation', () => {
  // The menu is hidden below the medium breakpoint (jsdom applies no media queries), hence `hidden`.
  it('links to the dashboard and the assistant', () => {
    renderWithProviders(<Header />)

    expect(screen.getByRole('link', { name: 'Dashboard', hidden: true })).toHaveAttribute(
      'href',
      '/dashboard',
    )
    expect(screen.getByRole('link', { name: 'Assistant', hidden: true })).toHaveAttribute(
      'href',
      '/assistant',
    )
  })
})

describe('Header: alerts', () => {
  it('links to the alerts page without a count when nothing is open', async () => {
    renderWithProviders(<Header />)

    const link = screen.getByRole('link', { name: 'Alerts', hidden: true })
    expect(link).toHaveAttribute('href', '/alerts')
    expect(link).not.toHaveTextContent(/\d/)
  })

  it('shows how many alerts are open', async () => {
    server.use(
      http.get(`${API}/v1/alerts`, () =>
        HttpResponse.json({ total: 3, items: [alertFixture(), alertFixture(), alertFixture()] }),
      ),
    )
    renderWithProviders(<Header />)

    expect(await screen.findByLabelText('3 open')).toHaveTextContent('3')
  })
})

describe('Header: session', () => {
  it('shows the user and their organization with role', async () => {
    renderWithProviders(<Header />)

    expect(screen.getByText('Belén')).toBeInTheDocument()
    expect(await screen.findByTestId('organization')).toHaveTextContent('Legacy · Owner')
  })

  it('capitalizes whichever role the API returns', async () => {
    server.use(
      http.get(`${API}/v1/me`, () =>
        HttpResponse.json(
          meFixture({
            organization: { id: 'o', name: 'North Farm', slug: 'north', role: 'VIEWER' },
          }),
        ),
      ),
    )
    renderWithProviders(<Header />)

    expect(await screen.findByTestId('organization')).toHaveTextContent('North Farm · Viewer')
  })

  it('still renders the user when the organization cannot be loaded', async () => {
    server.use(http.get(`${API}/v1/me`, () => new HttpResponse(null, { status: 500 })))
    renderWithProviders(<Header />)

    expect(screen.getByText('Belén')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByTestId('organization')).not.toBeInTheDocument())
  })

  it('offers "Log out" for a signed-in user and calls logout', async () => {
    const logout = vi.fn()
    renderWithProviders(<Header />, { auth: { logout } })

    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }))
    expect(logout).toHaveBeenCalledOnce()
  })

  it('offers "Exit demo" in demo mode', () => {
    renderWithProviders(<Header />, { auth: { mode: 'demo', user: { name: 'Demo User' } } })

    expect(screen.getByRole('button', { name: 'Exit demo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
  })

  it('shows no account controls, and requests no profile, when signed out', () => {
    renderWithProviders(<Header />, { auth: { status: 'unauthenticated', user: null, mode: null } })

    expect(screen.queryByRole('button', { name: /log out|exit demo/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('organization')).not.toBeInTheDocument()
  })
})
