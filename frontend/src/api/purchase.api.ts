import apiClient from './client'
import type { Purchase, PurchaseHistory } from '../types/purchase.types'

interface RecordPurchasePayload {
  consumerId: string
  product: string
  category: 'BEER' | 'WINE' | 'SPIRITS' | 'TODDY'
  quantity: number
  unit: 'ML' | 'L'
  price: number
}

interface HistoryParams {
  page?: number
  pageSize?: number
  startDate?: string
  endDate?: string
  consumerId?: string
}

export const purchaseApi = {
  recordPurchase: async (payload: RecordPurchasePayload): Promise<Purchase> => {
    const { data } = await apiClient.post<Purchase>('/purchases', payload)
    return data
  },

  getPurchaseHistory: async (params: HistoryParams = {}): Promise<PurchaseHistory> => {
    const { data } = await apiClient.get<PurchaseHistory>('/purchases/history', { params })
    return data
  },

  downloadPDF: async (consumerId?: string): Promise<Blob> => {
    const { data } = await apiClient.get('/purchases/pdf', {
      params: consumerId ? { consumerId } : {},
      responseType: 'blob',
    })
    return data
  },
}
