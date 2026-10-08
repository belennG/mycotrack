# Frontend testing

Unit and component tests use **Vitest**, **Testing Library** and **MSW** (Mock Service Worker).

```bash
npm test                 # run once
npm run test:watch       # re-run on change
npm run test:coverage    # run once and enforce the coverage thresholds (what CI runs)
```

## How tests are written

- **Components are tested through what a user sees**: roles, text and placeholders, never
  implementation details.
- **The network is mocked, not the code.** MSW answers requests made by the real `apiClient`,
  so interceptors, error handling and query hooks all run for real. A request with no handler
  **fails the test** (`onUnhandledRequest: 'error'`), so an unexpected API call can't go unnoticed.
  Default handlers live in `src/test/msw/handlers.ts`; override per test with `server.use(...)`.
- **`renderWithProviders(ui, { route, auth })`** (`src/test/renderWithProviders.tsx`) wraps a
  component in Chakra, a fresh React Query client (retries off), a router and an auth context.
  `auth` overrides any field, e.g. `{ status: 'unauthenticated' }` or `{ mode: 'demo' }`.
  `createWrapper()` is the equivalent for `renderHook`.
- **Fixtures** (`batchFixture`, `trackingFixture`, `meFixture`) build valid objects; pass overrides
  for just the field a test cares about.
- **The demo mock API is tested through the real `apiClient`** (`src/demo/demoAdapter.test.ts`),
  exactly as the app uses it in demo mode.

## The suite is hermetic

- `vite.config.ts` pins `VITE_*` values for tests, so a developer's local `.env` (API address,
  Auth0, Sentry) can't change the results.
- `src/test/setup.ts` replaces `localStorage`/`sessionStorage` when the runtime's global one is
  unusable (Node 25 ships an experimental one with no working methods).
- Run it in other timezones when touching dates: `TZ=America/Los_Angeles npm test`.

## Coverage

`npm run test:coverage` fails if coverage falls below the floor in `vite.config.ts`
(statements/lines 80%, functions 75%, branches 65%). It is a floor, not a target: raise it as
coverage grows. An HTML report is written to `coverage/`.

## Known gaps

- The Auth0 SDK itself is mocked; only the app's use of it is covered. Real login is exercised by
  the Playwright end-to-end tests (#29).
- `src/pages/BatchForm.tsx`, `src/pages/Settings.tsx` and `ControlledSelect` are untested:
  `BatchForm` is not used anywhere (the drawer has its own copy of the form) and `Settings` is a
  stub (#45).
