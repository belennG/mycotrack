import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from './theme.ts'

createRoot(document.getElementById('root')!).render(
  <ChakraProvider value={system}>
    <StrictMode>
      <App />
    </StrictMode>,
  </ChakraProvider>
)
