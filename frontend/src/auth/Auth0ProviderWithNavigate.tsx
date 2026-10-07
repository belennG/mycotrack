import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Auth0Provider, useAuth0, type AppState } from '@auth0/auth0-react'
import { auth0Config, isAuth0Configured, redirectUri } from './auth0Config'
import { AppAuthContext, type AppAuth } from './AppAuthContext'
import { AccessTokenBridge } from './AccessTokenBridge'
import { enterDemoMode, exitDemoMode, useDemoMode } from '../demo/demoMode'
import { resetDemoDb } from '../demo/demoAdapter'

const DEMO_USER = { name: 'Demo User' }

/** Switching between demo and real data must never show the other's cached results. */
function useDemoControls() {
  const queryClient = useQueryClient()
  return {
    start: () => {
      queryClient.clear()
      resetDemoDb()
      enterDemoMode()
    },
    exit: () => {
      queryClient.clear()
      resetDemoDb()
      exitDemoMode()
    },
  }
}

/** Auth0 is configured: merge its state with demo state. Demo wins while active. */
function Auth0AuthAdapter({ children }: { children: ReactNode }) {
  const auth0 = useAuth0()
  const isDemo = useDemoMode()
  const demo = useDemoControls()

  const value = useMemo<AppAuth>(() => {
    const base = {
      auth0Available: true,
      loginWithAuth0: (returnTo?: string) => {
        void auth0.loginWithRedirect({ appState: { returnTo: returnTo ?? '/dashboard' } })
      },
      startDemo: demo.start,
    }

    if (isDemo) {
      return {
        ...base,
        status: 'authenticated',
        mode: 'demo',
        user: DEMO_USER,
        logout: demo.exit,
      }
    }

    return {
      ...base,
      status: auth0.isLoading
        ? 'loading'
        : auth0.isAuthenticated
          ? 'authenticated'
          : 'unauthenticated',
      mode: auth0.isAuthenticated ? 'auth0' : null,
      user: auth0.user
        ? { name: auth0.user.name, email: auth0.user.email, picture: auth0.user.picture }
        : null,
      error: auth0.error,
      logout: () => {
        void auth0.logout({ logoutParams: { returnTo: window.location.origin } })
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth0.isLoading, auth0.isAuthenticated, auth0.user, auth0.error, isDemo])

  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>
}

/** Auth0 is not configured: only the demo is available. */
function DemoOnlyAdapter({ children }: { children: ReactNode }) {
  const isDemo = useDemoMode()
  const demo = useDemoControls()

  const value = useMemo<AppAuth>(
    () => ({
      status: isDemo ? 'authenticated' : 'unauthenticated',
      mode: isDemo ? 'demo' : null,
      user: isDemo ? DEMO_USER : null,
      auth0Available: false,
      loginWithAuth0: () => {},
      startDemo: demo.start,
      logout: demo.exit,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDemo],
  )

  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>
}

/**
 * Wraps the app in Auth0Provider (when configured) and exposes a unified `useAppAuth`.
 * Must render inside the Router (post-login redirect navigates) and QueryClientProvider.
 */
export function Auth0ProviderWithNavigate({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  if (!isAuth0Configured) {
    return <DemoOnlyAdapter>{children}</DemoOnlyAdapter>
  }

  const onRedirectCallback = (appState?: AppState) => {
    navigate(appState?.returnTo ?? '/dashboard', { replace: true })
  }

  return (
    <Auth0Provider
      domain={auth0Config.domain as string}
      clientId={auth0Config.clientId as string}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience: auth0Config.audience,
        scope: 'openid profile email',
      }}
      onRedirectCallback={onRedirectCallback}
      useRefreshTokens
      // localStorage keeps sessions alive on static hosting (S3/CloudFront)
      // where silent-auth iframes are often blocked by cookie policies.
      cacheLocation="localstorage"
    >
      <AccessTokenBridge />
      <Auth0AuthAdapter>{children}</Auth0AuthAdapter>
    </Auth0Provider>
  )
}
