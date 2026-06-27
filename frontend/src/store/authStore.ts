import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserRole = 'CONSUMER' | 'OPERATOR' | 'ADMIN' | 'DOCTOR' | 'CARETAKER'

export interface AuthUser {
  id: string
  full_name: string
  email: string
  role: UserRole
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  login: (user: AuthUser, token: string, refreshToken: string) => void
  logout: () => void
  setUser: (user: AuthUser) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      login: (user, token, refreshToken) =>
        set({ user, token, refreshToken, isAuthenticated: true }),
      logout: () =>
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false }),
      setUser: (user) => set({ user }),
    }),
    { name: 'tasmac-auth' }
  )
)
