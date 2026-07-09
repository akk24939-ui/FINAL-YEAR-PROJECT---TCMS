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

adminClient.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      useAdminAuthStore.getState().logout()
      window.location.href = '/admin/login'
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
  suspend: (shopId: string, reason: string) =>
    adminClient.post(`/api/v1/admin/shops/${shopId}/suspend`, { reason }),
  reactivate: (shopId: string) =>
    adminClient.post(`/api/v1/admin/shops/${shopId}/reactivate`),
}

export const adminDoctorsApi = {
  list: (params?: { is_active?: boolean; skip?: number; limit?: number }) =>
    adminClient.get<DoctorsResponse>('/api/v1/admin/doctors', { params }),
  create: (data: CreateDoctorPayload) =>
    adminClient.post<CreateDoctorResponse>('/api/v1/admin/doctors', data),
  activate: (doctorUserId: string) =>
    adminClient.post(`/api/v1/admin/doctors/${doctorUserId}/activate`),
  deactivate: (doctorUserId: string, reason: string, revoke_tokens = true) =>
    adminClient.post(`/api/v1/admin/doctors/${doctorUserId}/deactivate`, { reason, revoke_tokens }),
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
