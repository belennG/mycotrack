import { createContext, useContext } from 'react'

/**
 * App-level auth abstraction. Components depend on this instead of Auth0 directly,
 * which lets the app run in three situations through one interface:
 *  - signed in with Auth0
 *  - exploring the demo (no account, mock data)
 *  - Auth0 not configured (demo is still available)
 */
export type AuthMode = 'auth0' | 'demo'

export interface AppUser {
  name?: string
  email?: string
  picture?: string
}

export interface AppAuth {
  status: 'loading' | 'authenticated' | 'unauthenticated'
  mode: AuthMode | null
  user: AppUser | null
  error?: Error
  /** False when VITE_AUTH0_* are not set — the login button is disabled. */
  auth0Available: boolean
  loginWithAuth0: (returnTo?: string) => void
  startDemo: () => void
  logout: () => void
}

export const AppAuthContext = createContext<AppAuth | null>(null)

export function useAppAuth(): AppAuth {
  const value = useContext(AppAuthContext)
  if (!value) throw new Error('useAppAuth must be used inside <AuthProvider>')
  return value
}
