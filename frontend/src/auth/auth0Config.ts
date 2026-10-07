/**
 * Auth0 configuration, read from Vite env vars at build time.
 * See frontend/.env.example and docs/auth0.md.
 */
export const auth0Config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN as string | undefined,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID as string | undefined,
  audience: import.meta.env.VITE_AUTH0_AUDIENCE as string | undefined,
  callbackUrl: (import.meta.env.VITE_AUTH0_CALLBACK_URL as string | undefined) ?? undefined,
}

export const isAuth0Configured = Boolean(
  auth0Config.domain && auth0Config.clientId && auth0Config.audience,
)

export const redirectUri = auth0Config.callbackUrl ?? `${window.location.origin}/callback`
