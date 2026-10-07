import { useAppAuth } from '../auth/AppAuthContext'
import { FullPageSpinner } from '../components/FullPageSpinner'

/**
 * Landing route for the Auth0 redirect. Auth0Provider processes the `code` in
 * the URL and `onRedirectCallback` navigates onward, so this only needs to show
 * a spinner (or an error if the exchange failed).
 */
export default function Callback() {
  const { error } = useAppAuth()

  if (error) {
    return <FullPageSpinner label={`Sign-in failed: ${error.message}`} />
  }

  return <FullPageSpinner label="Signing you in…" />
}
