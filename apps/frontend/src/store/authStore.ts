// FILE: src/store/authStore.ts
// PURPOSE: Global auth state — user object, access token, actions.
// Persists to localStorage so users stay logged in across reloads.

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
        localStorage.removeItem('access_token')
        set({ user: null, token: null, isAuthenticated: false })
      },

      setUser: (user) => set({ user }),

      setToken: (token) => {
        localStorage.setItem('access_token', token)
        set({ token })
      },
    }),
    {
      name: 'safeapply-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)