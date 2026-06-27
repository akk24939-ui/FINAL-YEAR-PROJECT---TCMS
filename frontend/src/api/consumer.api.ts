import apiClient from './client'
import type { ConsumerProfile } from '../types/user.types'
import type { PurchaseHistory, PurchaseStats } from '../types/purchase.types'

interface LimitsPayload {
  dailyLimit: number
  weeklyLimit: number
  monthlyLimit: number
}

export const consumerApi = {
  getProfile: async (): Promise<ConsumerProfile> => {
    const { data } = await apiClient.get<ConsumerProfile>('/consumer/profile')
    return data
  },

  updateLimits: async (payload: LimitsPayload): Promise<ConsumerProfile> => {
    const { data } = await apiClient.put<ConsumerProfile>('/consumer/limits', payload)
    return data
  },

  getPurchaseHistory: async (page = 1, pageSize = 10): Promise<PurchaseHistory> => {
    const { data } = await apiClient.get<PurchaseHistory>('/consumer/purchases', {
      params: { page, pageSize },
    })
    return data
  },

  getStats: async (): Promise<PurchaseStats> => {
    const { data } = await apiClient.get<PurchaseStats>('/consumer/stats')
    return data
  },

  getQR: async (): Promise<{ qrCode: string; consumerId: string }> => {
    const { data } = await apiClient.get<{ qrCode: string; consumerId: string }>('/consumer/qr')
    return data
  },

  toggleTeetotaler: async (): Promise<{ isTeetotaler: boolean }> => {
    const { data } = await apiClient.post<{ isTeetotaler: boolean }>('/consumer/teetotaler/toggle')
    return data
  },
}
