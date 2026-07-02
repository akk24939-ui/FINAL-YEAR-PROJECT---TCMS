// Consumer Module TypeScript types

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY'
export type BeveragePreference = 'BEER' | 'WINE' | 'SPIRITS' | 'MIXED' | 'NONE'
export type NotificationType = 'INFO' | 'WARN' | 'DANGER' | 'SUCCESS'
export type NotificationCategory =
  | 'LIMIT_WARNING'
  | 'LIMIT_EXCEEDED'
  | 'TEETOTALER'
  | 'SELF_RESTRICTION'
  | 'SYSTEM'

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
  photo_path?: string
  beverage_preference: BeveragePreference
  is_teetotaler: boolean
  teetotaler_set_at?: string
  restrictions?: SelfRestrictionData
}

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

export interface QrResponse {
  qr_image_base64: string
  expires_at: string
  issued_at: string
}

export interface LimitUpdateRequest {
  daily_limit_sd: number
  weekly_limit_sd: number
  monthly_limit_sd: number
}

export interface LockRequest {
  lock_days: number
  lock_reason?: string
}
