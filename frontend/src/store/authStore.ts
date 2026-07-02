import { create } from 'zustand'
import { authApi } from '../api/auth.api'

interface UserMeta {
  id: string
  full_name: string
  email?: string
  role: string
}

interface AuthState {
  user: UserMeta | null
  isAuthenticated: boolean
  // Access token is kept in MEMORY ONLY — never persisted to localStorage/sessionStorage
  accessToken: string | null
  login: (user: UserMeta, accessToken: string) => void
  logout: () => void
  setAccessToken: (token: string) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  accessToken: null,

  login: (user, accessToken) =>
    set({ user, isAuthenticated: true, accessToken }),

  logout: async () => {
    try {
      await authApi.logout()
    } catch {
      // Ignore — proceed with local cleanup regardless
    }
    set({ user: null, isAuthenticated: false, accessToken: null })
  },

  setAccessToken: (token) => set({ accessToken: token }),
}))
