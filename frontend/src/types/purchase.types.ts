export interface Purchase {
  id: string
  consumerId: string
  shopCode: string
  shopName: string
  district: string
  product: string
  category: 'BEER' | 'WINE' | 'SPIRITS' | 'TODDY'
  quantity: number
  unit: 'ML' | 'L'
  price: number
  purchasedAt: string
  operatorId: string
}

export interface PurchaseStats {
  today: number
  todaySpend: number
  thisWeek: number
  weekSpend: number
  thisMonth: number
  monthSpend: number
  dailyLimit: number
  weeklyLimit: number
  monthlyLimit: number
  dailyUsedPercent: number
  weeklyUsedPercent: number
  monthlyUsedPercent: number
}

export interface PurchaseHistory {
  purchases: Purchase[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface DailyConsumption {
  date: string
  amount: number
  spend: number
  count: number
}
