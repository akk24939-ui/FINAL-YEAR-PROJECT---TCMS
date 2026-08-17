/**
 * Doctor API client — all calls to /api/v1/doctor/* and /api/v1/doctor/auth/*
 */
import axios from 'axios'
import { useDoctorAuthStore } from '../store/doctorAuthStore'

const BASE = 'http://127.0.0.1:8000/api/v1'

const doctorClient = axios.create({ baseURL: BASE, withCredentials: true })

// Attach token from doctor store
doctorClient.interceptors.request.use((config) => {
  const token = useDoctorAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Auth ─────────────────────────────────────────────────────────────────────
export const doctorAuthApi = {
  login: (email: string, password: string) =>
    doctorClient.post('/doctor/auth/login', { email, password }),

  changePassword: (currentPassword: string, newPassword: string) =>
    doctorClient.post('/doctor/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    }),

  logout: () => doctorClient.post('/doctor/auth/logout'),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const doctorDashboardApi = {
  get: () => doctorClient.get('/doctor/dashboard'),
}

// ── Patient search ─────────────────────────────────────────────────────────────
export const doctorPatientApi = {
  search: (query: string) =>
    doctorClient.get('/doctor/patients/search', { params: { query } }),

  getDetail: (patientUserId: string) =>
    doctorClient.get(`/doctor/patients/${patientUserId}`),
}

// ── Restrictions ─────────────────────────────────────────────────────────────
export const doctorRestrictionApi = {
  issue: (
    patientUserId: string,
    data: {
      reason: string
      reason_category: string
      restriction_type: string
      duration_days?: number
    }
  ) => doctorClient.post(`/doctor/patients/${patientUserId}/restrictions`, data),

  cancel: (restrictionId: string, cancellation_reason: string) =>
    doctorClient.patch(`/doctor/restrictions/${restrictionId}/cancel`, {
      cancellation_reason,
    }),

  get: (restrictionId: string) =>
    doctorClient.get(`/doctor/restrictions/${restrictionId}`),
}
