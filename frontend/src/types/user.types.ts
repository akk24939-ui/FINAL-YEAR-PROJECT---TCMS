export type Role = 'CONSUMER' | 'OPERATOR' | 'ADMIN' | 'DOCTOR' | 'CARETAKER'

export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: Role
  aadhaarLast4: string
  district: string
  age: number
  isVerified: boolean
  createdAt: string
}

export interface ConsumerProfile extends User {
  dailyLimit: number
  weeklyLimit: number
  monthlyLimit: number
  isTeetotaler: boolean
  qrCode: string
  linkedCaretakerId?: string
  totalPurchasesThisMonth: number
  totalPurchasesThisWeek: number
  totalPurchasesToday: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  logout: () => void
  setUser: (user: User) => void
}
