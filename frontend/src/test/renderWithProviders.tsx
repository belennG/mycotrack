import type { ReactElement, ReactNode } from 'react'
import { render, type RenderResult } from '@testing-library/react'
import { ChakraProvider } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { system } from '../theme'
import { AppAuthContext, type AppAuth } from '../auth/AppAuthContext'

/** A signed-in user by default; override any field per test. */
export const authFixture = (over: Partial<AppAuth> = {}): AppAuth => ({
  status: 'authenticated',
  mode: 'auth0',
  user: { name: 'Belén', email: 'belen@example.com' },
  auth0Available: true,
  loginWithAuth0: () => {},
  startDemo: () => {},
  logout: () => {},
  ...over,
})

export interface RenderOptions {
  route?: string
  auth?: Partial<AppAuth>
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', auth }: RenderOptions = {},
): RenderResult & { queryClient: QueryClient } {
  // A fresh client per test, with retries off so failures surface immediately.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  const result = render(
    <ChakraProvider value={system}>
      <QueryClientProvider client={queryClient}>
        <AppAuthContext.Provider value={authFixture(auth)}>
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </AppAuthContext.Provider>
      </QueryClientProvider>
    </ChakraProvider>,
  )
  return Object.assign(result, { queryClient })
}

/** Wrapper for renderHook: providers without a UI, returning the QueryClient for assertions. */
export function createWrapper(auth?: Partial<AppAuth>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AppAuthContext.Provider value={authFixture(auth)}>
          <MemoryRouter>{children}</MemoryRouter>
        </AppAuthContext.Provider>
      </QueryClientProvider>
    )
  }
  return { Wrapper, queryClient }
}
