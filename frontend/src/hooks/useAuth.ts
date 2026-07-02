import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const { user, accessToken, isAuthenticated, login, logout, setAccessToken } = useAuthStore()

  const hasRole = (role: string): boolean => user?.role === role
  const hasAnyRole = (...roles: string[]): boolean => roles.some(r => user?.role === r)

  return { user, accessToken, isAuthenticated, login, logout, setAccessToken, hasRole, hasAnyRole }
}
