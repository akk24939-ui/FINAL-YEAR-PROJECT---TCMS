import apiClient from './client'
import type {
  ConsumerProfile,
  ProfileUpdateRequest,
  ConsumerLimitsResponse,
  ConsumerLimitsUpdateRequest,
  SelfRestrictionData,
  DashboardResponse,
  PaginatedPurchases,
  QrResponse,
  NotificationItem,
  OcrExtractResponse,
  RegisterFinalRequest,
  LockRequest,
} from '../types/consumer.types'

export const consumerApi = {
  // ── Registration ────────────────────────────────────────────────────────────
  extractId: (formData: FormData) =>
    apiClient.post<OcrExtractResponse>('/api/v1/consumer/register/extract-id', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  register: (data: RegisterFinalRequest) =>
    apiClient.post<{ message: string; user_id: string }>('/api/v1/consumer/register', data),

  // ── Dashboard ────────────────────────────────────────────────────────────────
  getDashboard: () =>
    apiClient.get<DashboardResponse>('/api/v1/consumer/dashboard'),

  // ── Profile ─────────────────────────────────────────────────────────────────
  getProfile: () =>
    apiClient.get<ConsumerProfile>('/api/v1/consumer/profile'),

  updateProfile: (data: ProfileUpdateRequest) =>
    apiClient.put<ConsumerProfile>('/api/v1/consumer/profile', data),

  uploadPhoto: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiClient.post<{ message: string; path: string }>(
      '/api/v1/consumer/profile/photo',
      fd,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },

  // ── Limits (new ConsumerLimits table) ────────────────────────────────────────
  getLimits: () =>
    apiClient.get<ConsumerLimitsResponse>('/api/v1/consumer/limits'),

  updateLimits: (data: ConsumerLimitsUpdateRequest) =>
    apiClient.put<ConsumerLimitsResponse>('/api/v1/consumer/limits', data),

  // ── Self-Restriction (lock/unlock — SelfRestriction table) ───────────────────
  lockLimits: (data: LockRequest) =>
    apiClient.post<SelfRestrictionData>('/api/v1/consumer/limits/lock', data),

  confirmIncrease: () =>
    apiClient.post<SelfRestrictionData>('/api/v1/consumer/limits/confirm-increase'),

  // ── Teetotaler ──────────────────────────────────────────────────────────────
  enableTeetotaler: () =>
    apiClient.post<ConsumerProfile>('/api/v1/consumer/teetotaler/enable', { confirm: true }),

  disableTeetotaler: () =>
    apiClient.post<ConsumerProfile>('/api/v1/consumer/teetotaler/disable'),

  // ── Purchases ───────────────────────────────────────────────────────────────
  getPurchases: (params?: {
    skip?: number; limit?: number
    start_date?: string; end_date?: string; product_name?: string
  }) => apiClient.get<PaginatedPurchases>('/api/v1/consumer/purchases', { params }),

  // ── QR ──────────────────────────────────────────────────────────────────────
  generateQr: () =>
    apiClient.get<QrResponse>('/api/v1/consumer/qr'),

  // ── PDF ─────────────────────────────────────────────────────────────────────
  downloadPdf: (startDate: string, endDate: string) =>
    apiClient.get('/api/v1/consumer/pdf/report', {
      params: { start_date: startDate, end_date: endDate },
      responseType: 'blob',
    }),

  // ── Notifications ────────────────────────────────────────────────────────────
  getNotifications: () =>
    apiClient.get<NotificationItem[]>('/api/v1/consumer/notifications'),

  getUnreadCount: () =>
    apiClient.get<{ unread_count: number }>('/api/v1/consumer/notifications/unread-count'),

  markNotificationRead: (id: string) =>
    apiClient.patch<NotificationItem>(`/api/v1/consumer/notifications/${id}/read`),

  markAllRead: () =>
    apiClient.post('/api/v1/consumer/notifications/mark-all-read'),
}
