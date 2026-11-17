import { useEffect } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import * as Sentry from '@sentry/react'
import { setAccessTokenProvider, setUnauthorizedHandler } from '../api/client'

/**
 * Bridges Auth0 state into the non-React axios client:
 *  - supplies access tokens to the request interceptor
 *  - redirects to login on a 401
 *  - keeps Sentry's user context in sync
 *
 * Renders nothing. Must be mounted inside Auth0Provider.
 */
export function AccessTokenBridge() {
  const { isAuthenticated, isLoading, user, getAccessTokenSilently, loginWithRedirect } = useAuth0()

  useEffect(() => {
    setAccessTokenProvider(async () => {
      if (!isAuthenticated) return null
      // Since auth0-react 2.30 this can also resolve to undefined; the provider type says null.
      return (await getAccessTokenSilently()) ?? null
    })
    return () => setAccessTokenProvider(null)
  }, [isAuthenticated, getAccessTokenSilently])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void loginWithRedirect({
        appState: { returnTo: window.location.pathname + window.location.search },
      })
    })
    return () => setUnauthorizedHandler(null)
  }, [loginWithRedirect])

  useEffect(() => {
    if (isLoading) return
    if (isAuthenticated && user) {
      Sentry.setUser({ id: user.sub, email: user.email })
    } else {
      Sentry.setUser(null)
    }
  }, [isAuthenticated, isLoading, user])

  return null
}
