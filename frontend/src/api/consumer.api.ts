import apiClient from './client'
import type {
  ConsumerProfile, SelfRestrictionData, PaginatedPurchases,
  QrResponse, NotificationItem, OcrExtractResponse,
  RegisterFinalRequest, LimitUpdateRequest, LockRequest
} from '../types/consumer.types'

export const consumerApi = {
  // ── Registration ────────────────────────────────────────────────────────────
  extractId: (formData: FormData) =>
    apiClient.post<OcrExtractResponse>('/api/v1/consumer/register/extract-id', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  register: (data: RegisterFinalRequest) =>
    apiClient.post<{ message: string; user_id: string }>('/api/v1/consumer/register', data),

  // ── Profile ─────────────────────────────────────────────────────────────────
  getProfile: () => apiClient.get<ConsumerProfile>('/api/v1/consumer/profile'),

  updateProfile: (data: Partial<ConsumerProfile>) =>
    apiClient.put<ConsumerProfile>('/api/v1/consumer/profile', data),

  uploadPhoto: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiClient.post<{ photo_path: string }>('/api/v1/consumer/profile/photo', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  // ── Limits ──────────────────────────────────────────────────────────────────
  getLimits: () => apiClient.get<SelfRestrictionData>('/api/v1/consumer/limits'),

  updateLimits: (data: LimitUpdateRequest) =>
    apiClient.put<SelfRestrictionData>('/api/v1/consumer/limits', data),

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
    skip?: number; limit?: number;
    start_date?: string; end_date?: string; product_name?: string
  }) => apiClient.get<PaginatedPurchases>('/api/v1/consumer/purchases', { params }),

  // ── QR ──────────────────────────────────────────────────────────────────────
  generateQr: () => apiClient.get<QrResponse>('/api/v1/consumer/qr'),

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
}
