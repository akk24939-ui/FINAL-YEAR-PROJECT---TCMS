/**
 * Doctor auth store — separate from consumer/admin/operator stores.
 * Persists in sessionStorage (cleared on tab close).
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface DoctorProfile {
  id: string
  full_name: string
  email: string
  medical_reg_number: string
  hospital_name: string
  specialization: string
}

interface DoctorAuthState {
  doctor: DoctorProfile | null
  accessToken: string | null
  isAuthenticated: boolean
  mustChangePassword: boolean
}

interface DoctorAuthActions {
  setAuth: (doctor: DoctorProfile, token: string, mustChange: boolean) => void
  setToken: (token: string) => void
  clearMustChange: () => void
  logout: () => void
}

export const useDoctorAuthStore = create<DoctorAuthState & DoctorAuthActions>()(
  persist(
    (set) => ({
      doctor: null,
      accessToken: null,
      isAuthenticated: false,
      mustChangePassword: false,

      setAuth: (doctor, accessToken, mustChangePassword) =>
        set({ doctor, accessToken, isAuthenticated: true, mustChangePassword }),

      setToken: (accessToken) => set({ accessToken }),

      clearMustChange: () => set({ mustChangePassword: false }),

      logout: () =>
        set({ doctor: null, accessToken: null, isAuthenticated: false, mustChangePassword: false }),
    }),
    {
      name: 'doctor-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        doctor: s.doctor,
        accessToken: s.accessToken,
        isAuthenticated: s.isAuthenticated,
        mustChangePassword: s.mustChangePassword,
      }),
    }
  )
)
