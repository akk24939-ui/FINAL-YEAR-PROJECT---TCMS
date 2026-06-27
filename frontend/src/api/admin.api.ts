import apiClient from './client'

interface DistrictStat {
  district: string
  shops: number
  consumers: number
  revenue: number
  avgDailyPurchase: number
  riskHighCount: number
}

interface RevenueReport {
  month: string
  revenue: number
  transactions: number
}

interface ShopStat {
  shopCode: string
  shopName: string
  district: string
  dailySales: number
  monthlySales: number
  isActive: boolean
}

export const adminApi = {
  getDistrictStats: async (): Promise<DistrictStat[]> => {
    const { data } = await apiClient.get<DistrictStat[]>('/admin/districts')
    return data
  },

  getRevenueReport: async (months = 12): Promise<RevenueReport[]> => {
    const { data } = await apiClient.get<RevenueReport[]>('/admin/revenue', {
      params: { months },
    })
    return data
  },

  getShopsStats: async (district?: string): Promise<ShopStat[]> => {
    const { data } = await apiClient.get<ShopStat[]>('/admin/shops', {
      params: district ? { district } : {},
    })
    return data
  },

  getUserCountByRole: async (): Promise<Record<string, number>> => {
    const { data } = await apiClient.get<Record<string, number>>('/admin/users/count')
    return data
  },
}
