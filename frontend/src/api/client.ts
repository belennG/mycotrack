import axios from 'axios'
import { demoAdapter } from '../demo/demoAdapter'
import { isDemoMode } from '../demo/demoMode'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * Auth wiring. `AccessTokenBridge` (rendered inside Auth0Provider) registers a
 * token getter and an unauthorized handler here, since axios lives outside React
 * and cannot use the useAuth0 hook directly.
 */
type TokenProvider = () => Promise<string | null>

let getAccessToken: TokenProvider | null = null
let onUnauthorized: (() => void) | null = null

export function setAccessTokenProvider(provider: TokenProvider | null) {
  getAccessToken = provider
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

apiClient.interceptors.request.use(async (config) => {
  // Demo mode: answer from the in-browser mock, never touch the network or Auth0.
  if (isDemoMode()) {
    config.adapter = demoAdapter
    return config
  }

  if (getAccessToken) {
    try {
      const token = await getAccessToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch {
      // No valid session yet — let the request go out unauthenticated and be
      // rejected by the API, which triggers the 401 handler below.
    }
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && onUnauthorized) {
      onUnauthorized()
    }
    console.error('Global API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  },
)
