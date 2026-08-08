import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // @TODO expand this to trigger a Chakra UI toast notification
    console.error('Global API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  },
)
