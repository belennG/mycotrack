import { defineConfig, devices } from '@playwright/test'

const PORT = 4173

/**
 * End-to-end tests run a real browser against the production build, in demo mode: the
 * in-browser mock API means no backend, database or Auth0 login is needed, so they are fast and
 * deterministic. They are pinned to one locale and timezone so dates read the same everywhere.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Never pick up a developer's .env: no Auth0 (so the demo is the only way in), same-origin API.
    env: {
      VITE_API_BASE_URL: '/api',
      VITE_AUTH0_DOMAIN: '',
      VITE_AUTH0_CLIENT_ID: '',
      VITE_AUTH0_AUDIENCE: '',
      VITE_AUTH0_CALLBACK_URL: '',
      VITE_SENTRY_DSN: '',
    },
  },
})
