import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { Auth0ProviderWithNavigate } from './Auth0ProviderWithNavigate'
import { useAppAuth } from './AppAuthContext'
import { isDemoMode } from '../demo/demoMode'

// Auth0 is not configured under test (see vite.config.ts), so only the demo is available.
function Consumer() {
  const auth = useAppAuth()
  return (
    <div>
      <p data-testid="state">
        {auth.status}|{auth.mode ?? 'none'}|{auth.user?.name ?? 'nobody'}|
        {String(auth.auth0Available)}
      </p>
      <button onClick={auth.startDemo}>start</button>
      <button onClick={auth.logout}>logout</button>
    </div>
  )
}

function setup() {
  const queryClient = new QueryClient()
  queryClient.setQueryData(['batches'], { stale: true })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Auth0ProviderWithNavigate>
          <Consumer />
        </Auth0ProviderWithNavigate>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { queryClient, user: userEvent.setup() }
}

describe('auth without Auth0 configured', () => {
  it('starts signed out, with login unavailable', () => {
    setup()
    expect(screen.getByTestId('state')).toHaveTextContent('unauthenticated|none|nobody|false')
  })

  it('entering the demo signs in a demo user and empties the query cache', async () => {
    const { queryClient, user } = setup()

    await user.click(screen.getByText('start'))

    expect(screen.getByTestId('state')).toHaveTextContent('authenticated|demo|Demo User|false')
    expect(isDemoMode()).toBe(true)
    expect(queryClient.getQueryData(['batches'])).toBeUndefined()
  })

  it('exiting the demo signs out, forgets the demo data and empties the cache again', async () => {
    const { queryClient, user } = setup()
    await user.click(screen.getByText('start'))
    queryClient.setQueryData(['batches'], { demo: true })

    await user.click(screen.getByText('logout'))

    expect(screen.getByTestId('state')).toHaveTextContent('unauthenticated|none|nobody|false')
    expect(isDemoMode()).toBe(false)
    expect(sessionStorage.getItem('mycotrack-demo-db')).toBeNull()
    expect(queryClient.getQueryData(['batches'])).toBeUndefined()
  })

  it('picks the demo back up after a reload, because the flag is in sessionStorage', () => {
    sessionStorage.setItem('mycotrack-demo-mode', '1')
    setup()
    expect(screen.getByTestId('state')).toHaveTextContent('authenticated|demo|Demo User|false')
  })
})
