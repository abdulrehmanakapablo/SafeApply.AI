// FILE: src/store/authStore.ts
// PURPOSE: Global auth state — user object, access token, actions.
// Persists to localStorage so users stay logged in across reloads.
//
// NOTE: The persist key is 'safeapply-auth'. That's the key Zustand
// writes to localStorage. When logging out, we don't need to remove it
// manually — persist automatically rewrites it with the new (empty)
// state after set() runs.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  email: string
  full_name: string
  role: string
  plan: string
  avatar_url?: string
  job_title?: string
  location?: string
  bio?: string
  email_verified?: boolean
  created_at?: string
  notification_prefs?: {
    weekly_summary: boolean
    product_updates: boolean
    saved_company_reviews: boolean
  }
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  logout: () => void
  setUser: (user: User) => void
  setToken: (token: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) => {
        localStorage.setItem('access_token', token)
        set({ user, token, isAuthenticated: true })
      },

      logout: () => {
        // Clear the raw token
        localStorage.removeItem('access_token')
        // Reset store state. persist will rewrite 'safeapply-auth' with
        // this empty state automatically — no manual removeItem needed.
        set({ user: null, token: null, isAuthenticated: false })
      },

      setUser: (user) => set({ user }),

      setToken: (token) => {
        localStorage.setItem('access_token', token)
        set({ token, isAuthenticated: true })
      },
    }),
    {
      name: 'safeapply-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // Note: token is intentionally NOT persisted. The real token
        // lives in localStorage as 'access_token' — the store's `token`
        // field is just a mirror for components that want it in memory.
      }),
    }
  )
)