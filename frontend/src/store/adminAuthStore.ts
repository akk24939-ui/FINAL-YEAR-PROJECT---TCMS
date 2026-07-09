/**
 * Admin auth store — separate from consumer authStore.
 * Persists access token in memory (not localStorage for security).
 * Persists admin identity in sessionStorage.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { AdminUser } from '../types/admin.types'

interface AdminAuthState {
  admin: AdminUser | null
  accessToken: string | null
  isAuthenticated: boolean
  mustChangePassword: boolean
}

interface AdminAuthActions {
  setAuth: (admin: AdminUser, token: string, mustChange: boolean) => void
  setToken: (token: string) => void
  clearMustChange: () => void
  logout: () => void
}

export const useAdminAuthStore = create<AdminAuthState & AdminAuthActions>()(
  persist(
    (set) => ({
      admin: null,
      accessToken: null,
      isAuthenticated: false,
      mustChangePassword: false,

      setAuth: (admin, accessToken, mustChangePassword) =>
        set({ admin, accessToken, isAuthenticated: true, mustChangePassword }),

      setToken: (accessToken) => set({ accessToken }),

      clearMustChange: () => set({ mustChangePassword: false }),

      logout: () =>
        set({ admin: null, accessToken: null, isAuthenticated: false, mustChangePassword: false }),
    }),
    {
      name: 'admin-auth',
      storage: createJSONStorage(() => sessionStorage), // sessionStorage: cleared on tab close
      partialize: (s) => ({
        admin: s.admin,
        accessToken: s.accessToken,
        isAuthenticated: s.isAuthenticated,
        mustChangePassword: s.mustChangePassword,
      }),
    }
  )
)
