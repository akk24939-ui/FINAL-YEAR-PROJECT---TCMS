import apiClient from './client'

interface LoginResponse {
  access_token: string
  token_type: string
  user_id: string
  role: string
  full_name: string
}

export const authApi = {
  login: (identifier: string, password: string) =>
    apiClient.post<LoginResponse>('/api/v1/auth/login', { identifier, password }),

  logout: () => apiClient.post('/api/v1/auth/logout'),

  refresh: () => apiClient.post<{ access_token: string }>('/api/v1/auth/refresh'),

  sendOtp: (mobile_number: string) =>
    apiClient.post('/api/v1/otp/send', { mobile_number }),

  verifyOtp: (mobile_number: string, otp_code: string) =>
    apiClient.post<{ verified: boolean }>('/api/v1/otp/verify', { mobile_number, otp_code }),

  // ── Forgot Password ────────────────────────────────────────────────────────
  forgotPassword: (mobile_number: string) =>
    apiClient.post('/api/v1/auth/forgot-password', { mobile_number }),

  verifyResetOtp: (mobile_number: string, otp_code: string) =>
    apiClient.post<{ reset_token: string }>('/api/v1/auth/verify-reset-otp', { mobile_number, otp_code }),

  resetPassword: (reset_token: string, new_password: string) =>
    apiClient.post('/api/v1/auth/reset-password', { reset_token, new_password }),
}

