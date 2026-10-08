import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Playwright's specs live in e2e/ and run with `npm run e2e`, not here.
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Hermetic: never pick up a developer's local .env (API address, Auth0, Sentry).
    env: {
      VITE_API_BASE_URL: 'http://localhost:8000/api',
      VITE_AUTH0_DOMAIN: '',
      VITE_AUTH0_CLIENT_ID: '',
      VITE_AUTH0_AUDIENCE: '',
      VITE_AUTH0_CALLBACK_URL: '',
      VITE_SENTRY_DSN: '',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}', 'src/main.tsx', 'src/types/**'],
      reporter: ['text', 'html'],
      // A floor, not a target: a few points under the current numbers so a real drop fails CI.
      thresholds: { statements: 80, branches: 65, functions: 75, lines: 80 },
    },
  },
})
