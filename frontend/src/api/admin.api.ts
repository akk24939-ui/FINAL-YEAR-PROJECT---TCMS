/**
 * Admin API client — uses dedicated axios instance with admin token injection.
 */
import axios from 'axios'
import { useAdminAuthStore } from '../store/adminAuthStore'
import type {
  AdminOverview, ShopsResponse, CreateShopPayload, CreateShopResponse,
  ResetPinResponse, DoctorsResponse, CreateDoctorPayload, CreateDoctorResponse,
  ConsumersResponse, GlobalLimits, AuditLogsResponse, DistrictStatsResponse, SummaryReport,
} from '../types/admin.types'

const adminClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  withCredentials: true,
})

adminClient.interceptors.request.use((config) => {
  const token = useAdminAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Track in-flight refresh to prevent multiple simultaneous refresh calls
let _refreshing = false
let _refreshWaiters: Array<(token: string) => void> = []
let _refreshFailWaiters: Array<(err: unknown) => void> = []

const ADMIN_AUTH_BYPASS = [
  '/api/v1/admin/auth/login',
  '/api/v1/admin/auth/refresh',
  '/api/v1/admin/auth/logout',
  '/api/v1/admin/auth/change-password',
]
const isAdminAuthUrl = (url?: string) =>
  ADMIN_AUTH_BYPASS.some((b) => url?.includes(b))

adminClient.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config

    // Never intercept auth endpoints
    if (isAdminAuthUrl(original?.url)) return Promise.reject(err)

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true

      if (_refreshing) {
        return new Promise((resolve, reject) => {
          _refreshWaiters.push((token) => {
            original.headers.Authorization = `Bearer ${token}`
            resolve(adminClient(original))
          })
          _refreshFailWaiters.push(reject)
        })
      }

      _refreshing = true
      try {
        const res = await axios.post(
          '/api/v1/admin/auth/refresh',
          {},
          { baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000', withCredentials: true }
        )
        const newToken: string = res.data.access_token
        useAdminAuthStore.getState().setToken(newToken)
        _refreshWaiters.forEach(cb => cb(newToken))
        _refreshWaiters = []
        _refreshFailWaiters = []
        _refreshing = false
        original.headers.Authorization = `Bearer ${newToken}`
        return adminClient(original)
      } catch (refreshErr) {
        _refreshFailWaiters.forEach(cb => cb(refreshErr))
        _refreshWaiters = []
        _refreshFailWaiters = []
        _refreshing = false
        useAdminAuthStore.getState().logout()
        window.location.href = '/login/admin'
        return Promise.reject(refreshErr)
      }
    }
    return Promise.reject(err)
  }
)

export const adminAuthApi = {
  login: (username: string, password: string) =>
    adminClient.post('/api/v1/admin/auth/login', { username, password }),
  changePassword: (current_password: string, new_password: string) =>
    adminClient.post('/api/v1/admin/auth/change-password', { current_password, new_password }),
  refresh: () => adminClient.post('/api/v1/admin/auth/refresh'),
  logout: () => adminClient.post('/api/v1/admin/auth/logout'),
}

export const adminOverviewApi = {
  get: () => adminClient.get<AdminOverview>('/api/v1/admin/overview'),
}

export const adminShopsApi = {
  list: (params?: { district?: string; is_active?: boolean; skip?: number; limit?: number }) =>
    adminClient.get<ShopsResponse>('/api/v1/admin/shops', { params }),
  create: (data: CreateShopPayload) =>
    adminClient.post<CreateShopResponse>('/api/v1/admin/shops', data),
  resetPin: (shopId: string) =>
    adminClient.post<ResetPinResponse>(`/api/v1/admin/shops/${shopId}/reset-pin`),
  tempPassword: (shopId: string) =>
    adminClient.post(`/api/v1/admin/shops/${shopId}/temp-password`),
  suspend: (shopId: string, reason: string) =>
    adminClient.post(`/api/v1/admin/shops/${shopId}/suspend`, { reason }),
  reactivate: (shopId: string) =>
    adminClient.post(`/api/v1/admin/shops/${shopId}/reactivate`),
}

export const adminDoctorsApi = {
  list: (params?: { is_active?: boolean; skip?: number; limit?: number }) =>
    adminClient.get<DoctorsResponse>('/api/v1/admin/doctors', { params }),
  create: (data: CreateDoctorPayload & { initial_password?: string }) =>
    adminClient.post<CreateDoctorResponse>('/api/v1/admin/doctors', data),
  activate: (doctorUserId: string) =>
    adminClient.post(`/api/v1/admin/doctors/${doctorUserId}/activate`),
  deactivate: (doctorUserId: string, reason: string, revoke_tokens = true) =>
    adminClient.post(`/api/v1/admin/doctors/${doctorUserId}/deactivate`, { reason, revoke_tokens }),
  resetPassword: (doctorUserId: string, new_password: string) =>
    adminClient.post(`/api/v1/admin/doctors/${doctorUserId}/reset-password`, { new_password }),
}

export const adminConsumersApi = {
  list: (params?: { search?: string; skip?: number; limit?: number }) =>
    adminClient.get<ConsumersResponse>('/api/v1/admin/consumers', { params }),
}

export const adminConfigApi = {
  getLimits: () => adminClient.get<GlobalLimits>('/api/v1/admin/config/limits'),
  updateLimits: (data: { daily_limit_sd: number; weekly_limit_sd: number; monthly_limit_sd: number }) =>
    adminClient.put<GlobalLimits>('/api/v1/admin/config/limits', data),
}

export const adminAuditApi = {
  list: (params?: { event_type?: string; actor_id?: string; date_from?: string; date_to?: string; skip?: number; limit?: number }) =>
    adminClient.get<AuditLogsResponse>('/api/v1/admin/audit', { params }),
}

export const adminReportsApi = {
  districtStats: () => adminClient.get<DistrictStatsResponse>('/api/v1/admin/reports/district-stats'),
  summary: () => adminClient.get<SummaryReport>('/api/v1/admin/reports/summary'),
}
