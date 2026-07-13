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

let _opRefreshing = false
let _opWaiters: Array<(token: string) => void> = []
let _opFailWaiters: Array<(err: unknown) => void> = []

operatorClient.interceptors.response.use(
  (r) => r,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      if (_opRefreshing) {
        return new Promise((resolve, reject) => {
          _opWaiters.push((token) => {
            original.headers.Authorization = `Bearer ${token}`
            resolve(operatorClient(original))
          })
          _opFailWaiters.push(reject)
        })
      }
      _opRefreshing = true
      try {
        const res = await axios.post(
          '/api/v1/shop/auth/refresh',
          {},
          { baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000', withCredentials: true }
        )
        const newToken: string = res.data.access_token
        useOperatorAuthStore.getState().setToken(newToken)
        _opWaiters.forEach(cb => cb(newToken))
        _opWaiters = []; _opFailWaiters = []; _opRefreshing = false
        original.headers.Authorization = `Bearer ${newToken}`
        return operatorClient(original)
      } catch (refreshErr) {
        _opFailWaiters.forEach(cb => cb(refreshErr))
        _opWaiters = []; _opFailWaiters = []; _opRefreshing = false
        useOperatorAuthStore.getState().logout()
        window.location.href = '/login/shop'
        return Promise.reject(refreshErr)
      }
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
  changePassword: (current_password: string, new_password: string, confirm_password: string) =>
    operatorClient.post('/api/v1/shop/auth/change-password', {
      current_password, new_password, confirm_password,
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
