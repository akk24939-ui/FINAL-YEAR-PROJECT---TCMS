// ── Shop Operator TypeScript types ────────────────────────────────────────────

export interface ShopInfo {
  id: string
  shop_code: string
  name: string
  district: string
  address: string
  license_number: string | null
  pin_rotation_due_at: string | null
}

export interface OperatorDashboard {
  shop: ShopInfo
  today_purchases_count: number
  today_revenue: number
  recent_transactions: OperatorPurchaseRecord[]
  pin_rotation_warning: string | null
}

export interface OperatorPurchaseRecord {
  id: string
  product_name: string
  quantity_ml: number
  price: number
  standard_drinks: number | null
  remaining_daily_limit: number | null
  purchased_at: string
}

// ── Consumer lookup (operator view — no PII beyond name/masked Aadhaar) ───────

export interface ConsumerLookupResult {
  consumer_user_id: string
  full_name: string
  aadhaar_masked: string | null
  district: string | null
  is_teetotaler: boolean
  daily_limit_ml: number
  weekly_limit_ml: number
  today_consumed_ml: number
  week_consumed_ml: number
  remaining_daily_ml: number
  remaining_weekly_ml: number
  daily_pct_used: number
  can_purchase: boolean
}

// ── Products ──────────────────────────────────────────────────────────────────

export interface Product {
  id: string
  name: string
  category: string
  volume_ml: number
  price: number
  alcohol_pct: number
}

export interface ProductsResponse {
  products: Product[]
}

// ── Purchase recording ────────────────────────────────────────────────────────

export interface RecordPurchasePayload {
  consumer_user_id: string
  product_name: string
  quantity_ml: number
  price: number
  alcohol_pct: number
  product_id?: string
  notes?: string
}

export interface RecordPurchaseResponse {
  message: string
  purchase_id: string
  standard_drinks: number
  remaining_daily_ml: number
  remaining_daily_sd: number
  approaching_limit: boolean
}

// ── Shop history ──────────────────────────────────────────────────────────────

export interface ShopHistoryResponse {
  shop_code: string
  total: number
  total_revenue: number
  purchases: OperatorPurchaseRecord[]
}

// ── Operator auth (reuses shop_auth service) ──────────────────────────────────

export interface OperatorAuthState {
  accessToken: string | null
  shop: ShopInfo | null
  isAuthenticated: boolean
  pinWarning: string | null
}
