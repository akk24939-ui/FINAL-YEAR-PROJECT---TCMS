import apiClient from './client'

export interface LoginData { email: string; password: string }
export interface RegisterData {
  full_name: string; email: string; password: string
  phone?: string; role: string; aadhaar_number?: string; district?: string
}

export const authApi = {
  login: (data: LoginData) => apiClient.post('/api/v1/auth/login', data),
  register: (data: RegisterData) => apiClient.post('/api/v1/auth/register', data),
  refresh: (refresh_token: string) => apiClient.post('/api/v1/auth/refresh', { refresh_token }),
  logout: () => apiClient.post('/api/v1/auth/logout'),
}
