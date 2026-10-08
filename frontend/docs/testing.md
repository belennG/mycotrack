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

## End-to-end tests (Playwright)

```bash
npm run e2e        # builds the app, serves it, and runs the browser tests
npm run e2e:ui     # same, in Playwright's interactive UI
npx playwright install chromium   # once, to download the browser (~100 MB)
```

The specs in `e2e/` drive a real Chromium against the **production build**, in **demo mode**:
the in-browser mock API means no backend, database or Auth0 login is involved, so they are fast,
deterministic and run anywhere. They cover getting in without an account, the dashboard, adding
readings (date *and time*, ordering, validation, pagination), creating batches, and dark mode.

- The config pins the locale (`en-US`) and timezone (UTC) so dates read the same on every machine,
  and never picks up a developer's `.env` (no Auth0, same-origin API).
- Each test gets a fresh browser context, so demo data never leaks between tests.
- **Wait for data before reading it.** `readingTexts(page)` waits for the list to load; reading
  headings straight away sees an empty list, and a test on an empty list passes vacuously.
- In CI the `e2e` job runs after install, caches the browser, and uploads the HTML report (with
  screenshots, video and traces of failures) as an artifact when something fails.

## Known gaps

- The Auth0 SDK itself is mocked in the unit tests, and the end-to-end tests run in demo mode, so
  a **real Auth0 login is not covered automatically**. Doing that needs a dedicated test user and
  a deployed environment, and is a follow-up.
- There is no end-to-end test for **editing or deleting a reading**: the UI has no such action yet
  (only unused hooks exist).
- `src/pages/BatchForm.tsx`, `src/pages/Settings.tsx` and `ControlledSelect` are untested:
  `BatchForm` is not used anywhere (the drawer has its own copy of the form) and `Settings` is a
  stub (#45).
