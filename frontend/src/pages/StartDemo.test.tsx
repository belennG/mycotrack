import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import StartDemo from './StartDemo'
import { renderWithProviders } from '../test/renderWithProviders'

const signedOut = { status: 'unauthenticated', user: null, mode: null } as const

const app = (
  <Routes>
    <Route path="/demo" element={<StartDemo />} />
    <Route path="/dashboard" element={<div>dashboard page</div>} />
  </Routes>
)

describe('/demo', () => {
  it('starts the demo exactly once, even though StrictMode runs effects twice', () => {
    const startDemo = vi.fn()
    renderWithProviders(<StrictMode>{app}</StrictMode>, {
      route: '/demo',
      auth: { ...signedOut, startDemo },
    })

    expect(startDemo).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Opening the demo…')).toBeInTheDocument()
  })

  it('goes to the dashboard once the demo is running', () => {
    renderWithProviders(app, { route: '/demo', auth: { mode: 'demo' } })

    expect(screen.getByText('dashboard page')).toBeInTheDocument()
  })

  it('does not treat an ordinary signed-in session as the demo', () => {
    const startDemo = vi.fn()
    renderWithProviders(app, { route: '/demo', auth: { mode: 'auth0', startDemo } })

    expect(startDemo).toHaveBeenCalledTimes(1) // asks for the demo...
    expect(screen.queryByText('dashboard page')).not.toBeInTheDocument() // ...but waits for it
  })
})
