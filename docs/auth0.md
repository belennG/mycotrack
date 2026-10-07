# Auth0 setup

MycoTrack uses Auth0 for **authentication only**. Auth0 proves who a caller is
and issues an RS256 access token; the API validates that token on every request
and creates a local `users` row on first sight of an Auth0 `sub`. Authorization
and multi-tenancy (organizations, roles) are modelled in our own database
(issue #70), not in Auth0.

## 1. Tenant

Create an Auth0 tenant per environment, e.g. `mycotrack-dev` (and later
`mycotrack-prod`). Region `eu` is fine.

## 2. Application (SPA)

**Applications → Create Application → Single Page Application.**

| Setting | Value |
| --- | --- |
| Allowed Callback URLs | `http://localhost:5173/callback`, `https://<prod-frontend-domain>/callback` |
| Allowed Logout URLs | `http://localhost:5173`, `https://<prod-frontend-domain>` |
| Allowed Web Origins | `http://localhost:5173`, `https://<prod-frontend-domain>` |

Copy **Domain** and **Client ID** into the frontend env (step 5).

### `<prod-frontend-domain>` — the URL the deployed SPA is served from

For **local dev you don't need this** — `http://localhost:5173` is enough to log
in.

For the **deployed** app it's whatever host serves `frontend/dist`. Today that is
the S3 static-website bucket `mycotrack-frontend-prod-2026` in `eu-north-1`:

```
mycotrack-frontend-prod-2026.s3-website.eu-north-1.amazonaws.com
```

**But Auth0 rejects non-HTTPS callback URLs for any host other than
`localhost`**, and the S3 website endpoint is `http://` only. So logging in on
the deployed site does **not** work until the frontend is served over HTTPS —
i.e. behind CloudFront (or an ALB / custom domain). That's issue #31; once
CloudFront is in front of the bucket, use its domain
(`https://d1234abcd.cloudfront.net`, or your custom domain) here.

Until then: develop and demo Auth0 against `localhost`.

## 3. API

**APIs → Create API.**

| Setting | Value |
| --- | --- |
| Name | MycoTrack API |
| Identifier (audience) | `https://api.mycotrack.app` (any stable URI; it does not need to resolve) |
| Signing Algorithm | **RS256** |

The Identifier is the token **audience** — it goes in both the frontend and
backend env as `*_AUDIENCE`.

## 4. Post-Login Action — copy profile claims into the access token

Access tokens do **not** carry `email` / `name` / `picture` by default. Add a
custom Action so the API can provision users without a second `/userinfo` call.

**Actions → Library → Create Action → "Add profile claims to access token"**
(Login / Post Login trigger):

```js
exports.onExecutePostLogin = async (event, api) => {
  const ns = 'https://mycotrack.app/'
  api.accessToken.setCustomClaim(ns + 'email', event.user.email)
  api.accessToken.setCustomClaim(ns + 'name', event.user.name)
  api.accessToken.setCustomClaim(ns + 'picture', event.user.picture)
}
```

Deploy it and drag it into the **Login** flow. The namespace here must match
`AUTH0_CLAIM_NAMESPACE` / the frontend expectation (`https://mycotrack.app/`).

## 5. Connections

- **Database**: enable `Username-Password-Authentication` for the SPA.
- **Social**: add Google (optional but nice for the demo).
- Create one dedicated **test user** in the database connection for automated
  tests (issue #29).

## 6. Environment variables

**`backend/.env`**

```
AUTH0_DOMAIN=mycotrack-dev.eu.auth0.com
AUTH0_API_AUDIENCE=https://api.mycotrack.app
AUTH0_CLAIM_NAMESPACE=https://mycotrack.app/
# AUTH0_ISSUER / AUTH0_ALGORITHMS have sensible defaults
```

**`frontend/.env`**

```
VITE_AUTH0_DOMAIN=mycotrack-dev.eu.auth0.com
VITE_AUTH0_CLIENT_ID=<spa client id>
VITE_AUTH0_AUDIENCE=https://api.mycotrack.app
```

Restart both dev servers after changing env.

## 7. Run the DB migration

```bash
cd backend
alembic upgrade head   # creates the users table
```

## How it works

```
Browser ──(1) loginWithRedirect──▶ Auth0 Universal Login
   ▲                                     │
   │  (2) redirect to /callback with code│
   │                                     ▼
Auth0Provider ──(3) exchange code──▶ access token (RS256, aud=API)
   │
   │  (4) axios request interceptor attaches: Authorization: Bearer <token>
   ▼
FastAPI  ──(5) auth.get_current_user:
             - fetch + cache Auth0 JWKS
             - verify signature, iss, aud, exp
             - upsert users row (JIT provisioning)
             - refresh email/name/picture + last_login_at
```

- Token validation: `backend/auth/verify.py`
- JWKS cache: `backend/auth/jwks.py` (1h TTL, refetch on unknown `kid`)
- Route gating: every `/api/v1/*` router has `dependencies=[Depends(get_current_user)]`
  except `GET /api/v1/me`, which uses it directly and returns the profile.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Frontend shows "Auth0 is not configured" | `VITE_AUTH0_*` not set / dev server not restarted |
| 401 on every call, token looks valid | `audience` mismatch between SPA request and API Identifier |
| 401 with "Missing claim 'email'" style errors | Post-Login Action not deployed / not in the Login flow / namespace mismatch |
| `RuntimeError: AUTH0_DOMAIN is not set` | backend `.env` missing `AUTH0_DOMAIN` |
| Login loops back to login | callback URL not in "Allowed Callback URLs" |

## Demo mode (no account)

`/login` offers **Log in** (Auth0) and **Try the demo**. The demo lets anyone — e.g.
someone reviewing the code or the deployed site — explore the full UI without an
account:

- `frontend/src/demo/demoAdapter.ts` is an axios adapter that answers every
  `/v1/*` call from an in-browser store, mirroring the real API contract
  (pagination, 404s, duplicate batch names).
- `frontend/src/demo/demoData.ts` seeds 5 batches with ~2 weeks of readings,
  including an out-of-range excursion.
- Data lives in `sessionStorage`: survives a reload, discarded on **Exit demo** or
  when the tab closes. Nothing is sent to the backend or to Auth0.
- Components use `useAppAuth()` (`frontend/src/auth/AppAuthContext.tsx`), which
  merges Auth0 and demo state, so the app also runs with **no `VITE_AUTH0_*` set**
  (login disabled, demo available). That makes the deployed S3 site usable before
  HTTPS/CloudFront exists.
