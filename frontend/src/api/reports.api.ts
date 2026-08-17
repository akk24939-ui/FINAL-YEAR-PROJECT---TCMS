/**
 * Reports API client — extends the existing adminClient pattern.
 * All endpoints require gov_admin role (enforced server-side).
 */
import axios from 'axios'
import { useAdminAuthStore } from '../store/adminAuthStore'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReportSummary {
    total_active_shops: number
    total_consumers: number
    total_purchases: number
    total_revenue: number
    total_drinks: number
    districts_covered: number
    restricted_consumers: number
}

export interface DistrictSalesRow {
    district: string
    total_purchases: number
    total_revenue: number
    total_drinks: number
    unique_consumers: number
}

export interface DistrictSalesResponse {
    page: number
    page_size: number
    total: number
    data: DistrictSalesRow[]
}

export interface AgeGroupRow {
    age_bracket: string
    consumer_count: number
    total_drinks: number
}

export interface AgeGroupResponse {
    data: AgeGroupRow[]
}

export interface DailyTrendRow {
    purchase_date: string
    district: string
    total_purchases: number
    total_drinks: number
}

export interface DailyTrendResponse {
    data: DailyTrendRow[]
}

export interface ShopRevenueRow {
    shop_id: string
    shop_name: string
    district: string
    year_month: string
    transactions: number
    revenue: number
}

export interface ShopRevenueResponse {
    page: number
    page_size: number
    total: number
    data: ShopRevenueRow[]
}

export interface RestrictionAdoptionRow {
    district: string
    total_consumers: number
    restricted_count: number
    adoption_rate_pct: number
}

export interface RestrictionAdoptionResponse {
    data: RestrictionAdoptionRow[]
}

export interface PowerBIManifestFile {
    filename: string
    view_name: string
    row_count: number
    generated_at: string
}

export interface PowerBIManifestResponse {
    generated_at: string
    files: PowerBIManifestFile[]
    instructions: string
}

export interface ReportFilters {
    district?: string
    from_date?: string
    to_date?: string
    page?: number
    page_size?: number
    sort_by?: string
}

// ── Axios client (reuses admin token injection) ───────────────────────────────

const reportsClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
    withCredentials: true,
})

reportsClient.interceptors.request.use((config) => {
    const token = useAdminAuthStore.getState().accessToken
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

// ── API helpers ───────────────────────────────────────────────────────────────

const BASE = '/api/v1/admin/reports'

export const reportsApi = {
    summary: () =>
        reportsClient.get<ReportSummary>(`${BASE}/summary`),

    districtSales: (filters: ReportFilters = {}) =>
        reportsClient.get<DistrictSalesResponse>(`${BASE}/district-sales`, { params: filters }),

    ageGroups: () =>
        reportsClient.get<AgeGroupResponse>(`${BASE}/age-groups`),

    dailyTrend: (filters: Pick<ReportFilters, 'district' | 'from_date' | 'to_date'> = {}) =>
        reportsClient.get<DailyTrendResponse>(`${BASE}/daily-trend`, { params: filters }),

    shopRevenue: (filters: Pick<ReportFilters, 'from_date' | 'to_date' | 'page' | 'page_size'> = {}) =>
        reportsClient.get<ShopRevenueResponse>(`${BASE}/shop-revenue`, { params: filters }),

    restrictionAdoption: () =>
        reportsClient.get<RestrictionAdoptionResponse>(`${BASE}/restriction-adoption`),

    downloadPDF: (reportType: string, filters: ReportFilters = {}) =>
        reportsClient.get(`${BASE}/${reportType}/pdf`, {
            params: filters,
            responseType: 'blob',
        }),

    exportCSV: (filters: ReportFilters = {}) =>
        reportsClient.get(`${BASE}/export`, {
            params: { ...filters, format: 'csv' },
            responseType: 'blob',
        }),

    exportXLSX: (filters: ReportFilters = {}) =>
        reportsClient.get(`${BASE}/export`, {
            params: { ...filters, format: 'xlsx' },
            responseType: 'blob',
        }),

    powerbiManifest: () =>
        reportsClient.get<PowerBIManifestResponse>(`${BASE}/export/powerbi-manifest`),
}
