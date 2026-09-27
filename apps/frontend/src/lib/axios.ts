// FILE: src/lib/axios.ts
// PURPOSE: Axios instance — base URL, auth headers, token refresh interceptor
// DEV MODE: skips the /login redirect on 401 so dashboard pages can render
//           with demo fallback data while the database is empty.
//           Production builds always enforce the redirect.

import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor — attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor — handle 401 and refresh token automatically
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const res = await axios.post(
          '/api/auth/refresh',
          {},
          { withCredentials: true }
        )

        const newToken = res.data.data?.accessToken
        if (newToken) {
          localStorage.setItem('access_token', newToken)
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        }
      } catch {
        // DEV: don't redirect — just clear the token and let the caller
        // see the error. Page-level try/catch falls back to demo data.
        if (import.meta.env.DEV) {
          localStorage.removeItem('access_token')
          return Promise.reject(error)
        }

        // PRODUCTION: clear and redirect to login
        localStorage.removeItem('access_token')
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api