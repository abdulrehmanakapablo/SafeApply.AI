// FILE: src/lib/axios.ts
// PURPOSE: Axios instance with JWT injection, auto-refresh on 401,
//          and free-limit redirect on 403. `apiError()` turns any thrown
//          error into a human sentence for the UI.

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { clearUserData } from './session'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api'),
  timeout: 30_000,
  withCredentials: true,
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let refreshQueue: Array<(token: string | null) => void> = []

function onRefreshDone(token: string | null) {
  refreshQueue.forEach((cb) => cb(token))
  refreshQueue = []
}

// Public endpoints that legitimately return 401 (bad password etc.)
// must never trigger the refresh-and-redirect flow.
const NO_REFRESH = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password']

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    const status = error.response?.status
    const data = error.response?.data as { code?: string; error?: string } | undefined

    if ((status === 403 && data?.code === 'FREE_LIMIT_REACHED') || (status === 503 && data?.code === 'BUDGET_PAUSED')) {
      try {
        const { default: toast } = await import('react-hot-toast')
        toast.error(data.error || 'Free limit reached', { id: data.code })
      } catch {
        /* toast unavailable */
      }
      // Limit reached: show the upgrade page. Budget pause: just explain.
      if (data.code === 'FREE_LIMIT_REACHED' && typeof window !== 'undefined' && !window.location.pathname.startsWith('/billing')) {
        window.location.assign('/billing/checkout')
      }
      return Promise.reject(error)
    }

    const skip = original?.url && NO_REFRESH.some((p) => original.url?.includes(p))

    if (status === 401 && original && !original._retry && !skip) {
      original._retry = true

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            if (!token) {
              reject(error)
              return
            }
            original.headers = original.headers || {}
            original.headers.Authorization = `Bearer ${token}`
            resolve(api(original))
          })
        })
      }

      isRefreshing = true
      try {
        const res = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true })
        const newToken = res.data?.data?.accessToken as string | undefined
        if (!newToken) throw new Error('No token in refresh response')

        localStorage.setItem('access_token', newToken)
        onRefreshDone(newToken)

        original.headers = original.headers || {}
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch (refreshErr) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('safeapply-auth')
        clearUserData()
        onRefreshDone(null)
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          const from = encodeURIComponent(window.location.pathname + window.location.search)
          window.location.href = `/login?from=${from}`
        }
        return Promise.reject(refreshErr)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

/** Best human-readable message for any API failure. */
export function apiError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(err)) {
    // Always return a string: an error object rendered as a React child crashes the page.
    const data = err.response?.data as { error?: unknown; message?: unknown; errors?: Array<{ message?: unknown }> } | undefined
    const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v : '')
    const list = Array.isArray(data?.errors) ? data.errors.map((e) => text(e?.message)).filter(Boolean) : []
    if (list.length) return list.join('. ')
    const e = data?.error
    const msg = text(e) || (e && typeof e === 'object' ? text((e as { message?: unknown }).message) : '') || text(data?.message)
    if (msg) return msg
    if (err.response?.status === 404) return 'That service isn’t available right now. Please try again later.'
    if (err.code === 'ECONNABORTED') return 'The request took too long. Please try again.'
    if (!err.response) return 'Can’t reach the server. Check your connection.'
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export default api
