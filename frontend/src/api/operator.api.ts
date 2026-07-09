/**
 * Operator API client — dedicated axios instance.
 */
import axios from 'axios'
import { useOperatorAuthStore } from '../store/operatorAuthStore'
import type {
  OperatorDashboard,
  ConsumerLookupResult,
  ProductsResponse,
  RecordPurchasePayload,
  RecordPurchaseResponse,
  ShopHistoryResponse,
} from '../types/operator.types'

const operatorClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  withCredentials: true,
})

operatorClient.interceptors.request.use((config) => {
  const token = useOperatorAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

operatorClient.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      useOperatorAuthStore.getState().logout()
      window.location.href = '/shop/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const operatorAuthApi = {
  login: (shop_code: string, pin: string) =>
    axios.post('/api/v1/shop/auth/login', { shop_code, pin }, {
      baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
      withCredentials: true,
    }),
  logout: () =>
    axios.post('/api/v1/shop/auth/logout', {}, {
      baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
      withCredentials: true,
    }),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const operatorDashboardApi = {
  get: () => operatorClient.get<OperatorDashboard>('/api/v1/operator/dashboard'),
}

// ── Consumer lookup ───────────────────────────────────────────────────────────
export const operatorConsumerApi = {
  lookupByQR: (qr_payload: string) =>
    operatorClient.post<ConsumerLookupResult>('/api/v1/operator/consumer/lookup', { qr_payload }),
}

// ── Products ──────────────────────────────────────────────────────────────────
export const operatorProductsApi = {
  list: () => operatorClient.get<ProductsResponse>('/api/v1/operator/products'),
}

// ── Purchases ─────────────────────────────────────────────────────────────────
export const operatorPurchaseApi = {
  record: (data: RecordPurchasePayload) =>
    operatorClient.post<RecordPurchaseResponse>('/api/v1/operator/purchases', data),
  history: (params?: { skip?: number; limit?: number; date_filter?: string }) =>
    operatorClient.get<ShopHistoryResponse>('/api/v1/operator/purchases', { params }),
}
