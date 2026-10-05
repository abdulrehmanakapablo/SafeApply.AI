// FILE: src/store/authStore.ts
// PURPOSE: Global auth state. Persisted under 'safeapply-auth'.
//          The raw access token lives in localStorage as 'access_token';
//          the store keeps a mirror for components that want it.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Portal } from '../lib/roles'
import { clearUserData } from '../lib/session'

export interface User {
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
  /** Admins only: the one portal they're locked into. Ignored for other roles. */
  adminPortal: Portal | null
  setAdminPortal: (p: Portal | null) => void
  login: (user: User, token: string) => void
  logout: () => void
  setUser: (user: User) => void
  setToken: (token: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      adminPortal: null,

      setAdminPortal: (adminPortal) => set({ adminPortal }),

      login: (user, token) => {
        // A different account on this browser: drop the previous one's data.
        if (get().user?.id !== user.id) clearUserData()
        localStorage.setItem('access_token', token)
        set({ user, token, isAuthenticated: true })
      },

      logout: () => {
        localStorage.removeItem('access_token')
        clearUserData()
        set({ user: null, token: null, isAuthenticated: false, adminPortal: null })
      },

      setUser: (user) => set({ user }),

      setToken: (token) => {
        localStorage.setItem('access_token', token)
        set({ token, isAuthenticated: true })
      },
    }),
    {
      name: 'safeapply-auth',
      partialize: (state: AuthState) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        adminPortal: state.adminPortal,
      }),
    },
  ),
)

/** True only when the store flag AND a real token exist. The flag alone can be stale. */
export function useIsAuthed(): boolean {
  const flag = useAuthStore((s) => s.isAuthenticated)
  if (!flag || typeof window === 'undefined') return false
  return Boolean(localStorage.getItem('access_token'))
}
