import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { apiClient } from './client'
import { AccessTokenBridge } from '../auth/AccessTokenBridge'
import { server } from '../test/msw/server'
import { API, meFixture } from '../test/msw/handlers'
import { enterDemoMode } from '../demo/demoMode'
import { setDemoLatency } from '../demo/demoAdapter'

const auth0 = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  getAccessTokenSilently: vi.fn(),
  loginWithRedirect: vi.fn(),
}))
const sentry = vi.hoisted(() => ({ setUser: vi.fn() }))

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    isLoading: false,
    isAuthenticated: true,
    user: { sub: 'auth0|123', email: 'b@example.com' },
    getAccessTokenSilently: auth0.getAccessTokenSilently,
    loginWithRedirect: auth0.loginWithRedirect,
    ...auth0.state,
  }),
}))
vi.mock('@sentry/react', () => sentry)

let lastAuthorization: string | null | undefined

beforeEach(() => {
  auth0.state = {}
  auth0.getAccessTokenSilently.mockReset().mockResolvedValue('token-abc')
  auth0.loginWithRedirect.mockReset()
  sentry.setUser.mockReset()
  lastAuthorization = undefined
  server.use(
    http.get(`${API}/v1/me`, ({ request }) => {
      lastAuthorization = request.headers.get('authorization')
      return HttpResponse.json(meFixture())
    }),
  )
})

describe('API client token handling', () => {
  it('attaches the Auth0 access token as a bearer token', async () => {
    render(<AccessTokenBridge />)
    await apiClient.get('/v1/me')

    expect(lastAuthorization).toBe('Bearer token-abc')
  })

  it('sends no Authorization header when signed out', async () => {
    auth0.state = { isAuthenticated: false, user: undefined }
    render(<AccessTokenBridge />)
    await apiClient.get('/v1/me')

    expect(lastAuthorization).toBeNull()
    expect(auth0.getAccessTokenSilently).not.toHaveBeenCalled()
  })

  it('still sends the request, unauthenticated, if the token cannot be fetched', async () => {
    auth0.getAccessTokenSilently.mockRejectedValue(new Error('login_required'))
    render(<AccessTokenBridge />)
    await apiClient.get('/v1/me')

    expect(lastAuthorization).toBeNull()
  })

  it('sends people back through Auth0 login when the API answers 401', async () => {
    server.use(http.get(`${API}/v1/me`, () => new HttpResponse(null, { status: 401 })))
    render(<AccessTokenBridge />)

    await expect(apiClient.get('/v1/me')).rejects.toMatchObject({ response: { status: 401 } })
    expect(auth0.loginWithRedirect).toHaveBeenCalledWith({
      appState: { returnTo: window.location.pathname + window.location.search },
    })
  })

  it('does not trigger login for other errors', async () => {
    server.use(http.get(`${API}/v1/me`, () => new HttpResponse(null, { status: 500 })))
    render(<AccessTokenBridge />)

    await expect(apiClient.get('/v1/me')).rejects.toMatchObject({ response: { status: 500 } })
    expect(auth0.loginWithRedirect).not.toHaveBeenCalled()
  })

  it('stops supplying tokens once the bridge unmounts', async () => {
    const { unmount } = render(<AccessTokenBridge />)
    unmount()
    await apiClient.get('/v1/me')

    expect(lastAuthorization).toBeNull()
  })

  it('answers from the in-browser demo and never calls the network or Auth0 in demo mode', async () => {
    setDemoLatency(0)
    enterDemoMode()
    render(<AccessTokenBridge />)

    const { data } = await apiClient.get('/v1/me')

    expect(data.organization.name).toBe('Demo Farm')
    expect(lastAuthorization).toBeUndefined() // the MSW handler was never hit
    expect(auth0.getAccessTokenSilently).not.toHaveBeenCalled()
  })
})

describe('Sentry user context', () => {
  it('identifies the signed-in user by id and email only', () => {
    render(<AccessTokenBridge />)
    expect(sentry.setUser).toHaveBeenCalledWith({ id: 'auth0|123', email: 'b@example.com' })
  })

  it('clears it when signed out', () => {
    auth0.state = { isAuthenticated: false, user: undefined }
    render(<AccessTokenBridge />)
    expect(sentry.setUser).toHaveBeenCalledWith(null)
  })

  it('does nothing while Auth0 is still loading', () => {
    auth0.state = { isLoading: true }
    render(<AccessTokenBridge />)
    expect(sentry.setUser).not.toHaveBeenCalled()
  })
})
