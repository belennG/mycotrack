import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from './theme.ts'
import { Toaster } from './components/ui/toaster'
import { ErrorBoundary } from 'react-error-boundary'
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary'
import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <ErrorBoundary
        FallbackComponent={GlobalErrorBoundary}
        onReset={() => window.location.reload()}
      >
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
            <Toaster />
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </ChakraProvider>
  </StrictMode>,
)
