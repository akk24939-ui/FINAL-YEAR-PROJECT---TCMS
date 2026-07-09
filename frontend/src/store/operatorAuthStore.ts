/**
 * Operator auth store — sessionStorage (cleared on tab close).
 * Separate from admin and consumer stores.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ShopInfo } from '../types/operator.types'

interface OperatorAuthState {
  accessToken: string | null
  shop: ShopInfo | null
  isAuthenticated: boolean
  pinWarning: string | null
}

interface OperatorAuthActions {
  setAuth: (token: string, shop: ShopInfo, pinWarning: string | null) => void
  setToken: (token: string) => void
  logout: () => void
}

export const useOperatorAuthStore = create<OperatorAuthState & OperatorAuthActions>()(
  persist(
    (set) => ({
      accessToken: null,
      shop: null,
      isAuthenticated: false,
      pinWarning: null,

      setAuth: (accessToken, shop, pinWarning) =>
        set({ accessToken, shop, isAuthenticated: true, pinWarning }),

      setToken: (accessToken) => set({ accessToken }),

      logout: () =>
        set({ accessToken: null, shop: null, isAuthenticated: false, pinWarning: null }),
    }),
    {
      name: 'operator-auth',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
