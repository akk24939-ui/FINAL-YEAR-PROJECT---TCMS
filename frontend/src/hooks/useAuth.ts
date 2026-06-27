import { useAuthStore } from '../store/authStore'
import type { Role } from '../types/user.types'

export function useAuth() {
  const { user, token, isAuthenticated, login, logout, setUser } = useAuthStore()

  const hasRole = (role: Role): boolean => user?.role === role

  const hasAnyRole = (...roles: Role[]): boolean =>
    roles.some((r) => user?.role === r)

  return { user, token, isAuthenticated, login, logout, setUser, hasRole, hasAnyRole }
}
