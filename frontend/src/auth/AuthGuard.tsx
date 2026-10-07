import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FullPageSpinner } from '../components/FullPageSpinner'
import { useAppAuth } from './AppAuthContext'

/**
 * Route guard: renders the nested routes for a signed-in user or a demo visitor,
 * otherwise sends them to /login (remembering where they were headed).
 */
export function AuthGuard() {
  const { status, error } = useAppAuth()
  const location = useLocation()

  if (error) {
    return <FullPageSpinner label={`Authentication error: ${error.message}`} />
  }

  if (status === 'loading') {
    return <FullPageSpinner label="Checking your session…" />
  }

  if (status === 'unauthenticated') {
    return (
      <Navigate to="/login" replace state={{ returnTo: location.pathname + location.search }} />
    )
  }

  return <Outlet />
}
