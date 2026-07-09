// ── Admin types ──────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string
  full_name: string
  email: string
}

export interface AdminAuthState {
  admin: AdminUser | null
  accessToken: string | null
  isAuthenticated: boolean
  mustChangePassword: boolean
}

// ── Overview ──────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  event_type: string
  description: string | null
  user_id: string | null
  actor_id: string | null
  ip_address: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface AdminOverview {
  total_consumers: number
  total_operators: number
  total_doctors: number
  total_shops: number
  suspended_shops: number
  today_purchases: number
  recent_audit: AuditLogEntry[]
}

// ── Shops ─────────────────────────────────────────────────────────────────────

export interface ShopRecord {
  id: string
  shop_code: string
  name: string
  district: string
  address: string
  license_number: string | null
  operator_name: string | null
  operator_phone: string | null
  is_active: boolean
  suspended_at: string | null
  suspension_reason: string | null
  pin_rotation_due_at: string | null
  pin_overdue: boolean
  created_at: string
}

export interface ShopsResponse {
  total: number
  shops: ShopRecord[]
}

export interface CreateShopPayload {
  name: string
  district: string
  address: string
  license_number?: string
  operator_name: string
  operator_phone: string
}

export interface CreateShopResponse {
  shop: ShopRecord
  operator_email: string
  initial_pin: string
  message: string
}

export interface ResetPinResponse {
  shop_code: string
  new_pin: string
  message: string
}

// ── Doctors ───────────────────────────────────────────────────────────────────

export interface DoctorProfileRecord {
  medical_reg_number: string
  specialization: string | null
  contact_phone: string | null
  hospital_name: string | null
  is_active: boolean
  activated_at: string | null
  deactivated_at: string | null
  deactivation_reason: string | null
}

export interface DoctorRecord {
  user_id: string
  email: string
  full_name: string
  is_active: boolean
  must_change_password: boolean
  last_login_at: string | null
  created_at: string
  profile: DoctorProfileRecord
}

export interface DoctorsResponse {
  total: number
  doctors: DoctorRecord[]
}

export interface CreateDoctorPayload {
  full_name: string
  specialization?: string
  contact_phone?: string
  hospital_name?: string
}

export interface CreateDoctorResponse {
  doctor: DoctorRecord
  temp_password: string
  login_email: string
  message: string
}

// ── Consumers ─────────────────────────────────────────────────────────────────

export interface ConsumerRecord {
  user_id: string
  full_name: string
  email: string
  mobile_number: string | null
  is_active: boolean
  created_at: string
  last_login_at: string | null
  aadhaar_masked: string | null
  district: string | null
  is_teetotaler: boolean
  is_self_restricted: boolean
  restriction_until: string | null
}

export interface ConsumersResponse {
  total: number
  consumers: ConsumerRecord[]
}

// ── Global Limits ─────────────────────────────────────────────────────────────

export interface GlobalLimits {
  daily_limit_sd: number
  weekly_limit_sd: number
  monthly_limit_sd: number
  note?: string
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export interface AuditLogsResponse {
  total: number
  logs: AuditLogEntry[]
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface DistrictStat {
  district: string
  code: string
  shop_count: number
  total_purchases: number
  total_revenue: number
}

export interface DistrictStatsResponse {
  districts: DistrictStat[]
}

export interface SummaryReport {
  total_consumers: number
  total_active_shops: number
  total_purchases: number
  total_revenue: number
}
