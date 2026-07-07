// Consumer Module TypeScript types — extended for Dashboard module

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'
export type BeveragePreference = 'BEER' | 'WINE' | 'SPIRITS' | 'MIXED' | 'NONE'
export type BeverageChoice = 'BEER' | 'WINE' | 'SPIRITS' | 'MIXED'
export type NotificationType = 'INFO' | 'WARN' | 'DANGER' | 'SUCCESS'
export type NotificationCategory =
  | 'LIMIT_WARNING'
  | 'LIMIT_EXCEEDED'
  | 'TEETOTALER'
  | 'SELF_RESTRICTION'
  | 'SYSTEM'

// ── OCR / Registration ───────────────────────────────────────────────────────
export interface OcrConfidence {
  full_name: number
  dob: number
  gender: number
  aadhaar_number: number
  address: number
}

export interface OcrExtractResponse {
  full_name?: string
  dob?: string
  gender?: Gender
  aadhaar_number?: string
  address?: string
  district?: string
  confidence: OcrConfidence
}

export interface RegisterFinalRequest {
  email: string
  mobile_number: string
  password: string
  full_name: string
  dob: string
  gender: Gender
  aadhaar_number: string
  district: string
  address?: string
}

// ── Self-Restriction (lock/unlock) ───────────────────────────────────────────
export interface SelfRestrictionData {
  daily_limit_sd: number
  weekly_limit_sd: number
  monthly_limit_sd: number
  pending_daily_limit_sd?: number
  pending_weekly_limit_sd?: number
  pending_monthly_limit_sd?: number
  lock_requested_at?: string
  is_locked: boolean
  locked_until?: string
  lock_reason?: string
}

// ── Consumer Limits (dedicated table) ────────────────────────────────────────
export interface ConsumerLimitsResponse {
  id: string
  consumer_id: string
  daily_limit_sd: number
  weekly_limit_sd: number
  monthly_limit_sd: number
  beverage_preference: BeverageChoice[]
  warn_weekly_vs_daily: boolean
  warn_monthly_vs_weekly: boolean
  is_locked: boolean
  locked_until?: string
  updated_at: string
}

export interface ConsumerLimitsUpdateRequest {
  daily_limit_sd: number
  weekly_limit_sd: number
  monthly_limit_sd: number
  beverage_preference: BeverageChoice[]
}

// ── Profile (extended) ────────────────────────────────────────────────────────
export interface ConsumerProfile {
  id: string
  user_id: string
  full_name: string
  email: string
  mobile_number?: string
  aadhaar_masked: string
  dob?: string
  gender?: Gender
  district?: string
  address?: string
  blood_group?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  photo_path?: string
  beverage_preference: BeveragePreference
  is_teetotaler: boolean
  teetotaler_set_at?: string
  member_since?: string
  is_self_restricted: boolean
  restriction_locked_until?: string
  // Legacy field kept for register flow compatibility
  restrictions?: SelfRestrictionData
}

export interface ProfileUpdateRequest {
  full_name?: string
  mobile_number?: string
  gender?: Gender
  district?: string
  address?: string
  blood_group?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  beverage_preference?: BeveragePreference
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export interface ConsumptionSummary {
  consumed_sd: number
  limit_sd: number
  percent_used: number
  status: 'safe' | 'warn' | 'exceeded'
  consumed_beer_ml?: number
  consumed_wine_ml?: number
  consumed_spirits_ml?: number
}

export interface DailyChartPoint {
  label: string   // "Mon"
  date: string    // "2026-07-04"
  consumed_sd: number
  limit_sd: number
}

export interface WeeklyChartPoint {
  label: string      // "Week 1"
  week_start: string // ISO date
  consumed_sd: number
  limit_sd: number
}

export interface DashboardResponse {
  consumer_name: string
  aadhaar_masked: string
  member_since?: string
  is_teetotaler: boolean
  is_self_restricted: boolean
  restriction_locked_until?: string
  today: ConsumptionSummary
  this_week: ConsumptionSummary
  this_month: ConsumptionSummary
  daily_chart: DailyChartPoint[]
  weekly_chart: WeeklyChartPoint[]
  who_daily_advisory: number
  who_weekly_advisory: number
  alert_type?: string
  alert_message?: string
}

// ── Notifications ─────────────────────────────────────────────────────────────
export interface NotificationItem {
  id: string
  notification_type: NotificationType
  category: NotificationCategory
  title: string
  message: string
  is_read: boolean
  read_at?: string
  created_at: string
}

// ── Purchases ─────────────────────────────────────────────────────────────────
export interface Purchase {
  id: string
  shop_name?: string
  product_name: string
  quantity_ml: number
  standard_drinks?: number
  price: number
  purchased_at: string
}

export interface PaginatedPurchases {
  items: Purchase[]
  total: number
  skip: number
  limit: number
}

// ── QR ────────────────────────────────────────────────────────────────────────
export interface QrResponse {
  qr_image_base64: string
  expires_at: string
  issued_at: string
}

// ── Legacy limit types (used by SelfRestriction routes) ───────────────────────
export interface LimitUpdateRequest {
  daily_limit_sd: number
  weekly_limit_sd: number
  monthly_limit_sd: number
}

export interface LockRequest {
  lock_days: number
  lock_reason?: string
}
