/**
 * ReportsPage — Full Admin Government Report Dashboard
 *
 * Features:
 *  - KPI summary cards (live TanStack Query)
 *  - Filter bar: district, date range, sort
 *  - 4 Recharts panels: district bar, daily trend line, age donut, restriction adoption
 *  - Download PDF button (Matplotlib PDF from backend)
 *  - Export CSV/XLSX buttons
 *  - Collapsible Power BI instructions panel
 */
import React, { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
  RadialBarChart, RadialBar,
} from 'recharts'
import {
  FileBarChart2, TrendingUp, Store, ShoppingCart, Download, FileDown,
  DatabaseZap, ChevronDown, ChevronUp, RefreshCw, Users, ShieldCheck,
  AlertCircle, Loader2, Calendar,
} from 'lucide-react'
import { reportsApi } from '../../api/reports.api'
import type { ReportFilters } from '../../api/reports.api'

// ── Color palette (mirrors Matplotlib PDF) ────────────────────────────────────
const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1']

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatINR(v: number) {
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color: string
}
const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value, sub, color }) => (
  <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 flex items-center gap-4 hover:shadow-md transition-shadow">
    <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-xs text-gray-400 font-medium truncate">{label}</p>
      <p className="text-xl font-black text-gray-900 dark:text-white">
        {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
      </p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
)

interface ChartCardProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  loading?: boolean
}
const ChartCard: React.FC<ChartCardProps> = ({ title, icon, children, loading }) => (
  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <h2 className="font-bold text-gray-900 dark:text-white text-sm">{title}</h2>
      {loading && <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin ml-auto" />}
    </div>
    {children}
  </div>
)

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#1f2937', border: 'none', borderRadius: 12,
    color: '#f9fafb', fontSize: 12,
  },
  cursor: { fill: 'rgba(59,130,246,0.08)' },
}

// ── Main component ─────────────────────────────────────────────────────────────

const DISTRICTS = [
  'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem',
  'Tirunelveli', 'Vellore', 'Erode', 'Thoothukkudi', 'Dindigul',
  'Thanjavur', 'Ranipet', 'Sivagangai', 'Virudhunagar', 'Nagapattinam',
  'Kancheepuram', 'Chengalpattu', 'Tiruppur', 'Namakkal', 'Cuddalore',
]

const ReportsPage: React.FC = () => {
  // ── Filter state ────────────────────────────────────────────────────────────
  const [district, setDistrict] = useState<string>('')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('purchases')

  // ── Applied filters (only change on "Apply") ──────────────────────────────
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>({})

  const applyFilters = useCallback(() => {
    const f: ReportFilters = {}
    if (district) f.district = district
    if (fromDate) f.from_date = fromDate
    if (toDate) f.to_date = toDate
    if (sortBy) f.sort_by = sortBy
    setAppliedFilters(f)
  }, [district, fromDate, toDate, sortBy])

  const resetFilters = () => {
    setDistrict(''); setFromDate(''); setToDate(''); setSortBy('purchases')
    setAppliedFilters({})
  }

  // ── TanStack Query — one key per chart ─────────────────────────────────────
  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ['report-summary'],
    queryFn: () => reportsApi.summary().then(r => r.data),
  })

  const { data: districtData, isLoading: distLoading } = useQuery({
    queryKey: ['report-district-sales', appliedFilters],
    queryFn: () => reportsApi.districtSales({ ...appliedFilters, page_size: 20 }).then(r => r.data),
  })

  const { data: ageData, isLoading: ageLoading } = useQuery({
    queryKey: ['report-age-groups'],
    queryFn: () => reportsApi.ageGroups().then(r => r.data),
  })

  const { data: trendData, isLoading: trendLoading } = useQuery({
    queryKey: ['report-daily-trend', appliedFilters],
    queryFn: () => reportsApi.dailyTrend({
      district: appliedFilters.district,
      from_date: appliedFilters.from_date,
      to_date: appliedFilters.to_date,
    }).then(r => r.data),
  })

  const { data: adoptionData, isLoading: adoptLoading } = useQuery({
    queryKey: ['report-restriction-adoption'],
    queryFn: () => reportsApi.restrictionAdoption().then(r => r.data),
  })

  // ── Download handlers ──────────────────────────────────────────────────────
  const [pdfLoading, setPdfLoading] = useState(false)
  const [csvLoading, setCsvLoading] = useState(false)
  const [xlsxLoading, setXlsxLoading] = useState(false)

  const handlePDF = async () => {
    setPdfLoading(true)
    try {
      const res = await reportsApi.downloadPDF('full', appliedFilters)
      triggerFileDownload(
        new Blob([res.data], { type: 'application/pdf' }),
        `tasmac_report_${new Date().toISOString().slice(0, 10)}.pdf`,
      )
    } finally { setPdfLoading(false) }
  }

  const handleCSV = async () => {
    setCsvLoading(true)
    try {
      const res = await reportsApi.exportCSV(appliedFilters)
      triggerFileDownload(
        new Blob([res.data], { type: 'text/csv' }),
        `tasmac_export_${new Date().toISOString().slice(0, 10)}.csv`,
      )
    } finally { setCsvLoading(false) }
  }

  const handleXLSX = async () => {
    setXlsxLoading(true)
    try {
      const res = await reportsApi.exportXLSX(appliedFilters)
      triggerFileDownload(
        new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `tasmac_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
      )
    } finally { setXlsxLoading(false) }
  }

  // ── Power BI panel ─────────────────────────────────────────────────────────
  const [pbiOpen, setPbiOpen] = useState(false)
  const [pbiManifest, setPbiManifest] = useState<any>(null)
  const [pbiLoading, setPbiLoading] = useState(false)

  const loadManifest = async () => {
    if (pbiManifest) { setPbiOpen(v => !v); return }
    setPbiLoading(true)
    try {
      const res = await reportsApi.powerbiManifest()
      setPbiManifest(res.data)
      setPbiOpen(true)
    } catch {
      setPbiManifest({ error: 'No export found yet. It runs every 4 hours automatically.' })
      setPbiOpen(true)
    } finally { setPbiLoading(false) }
  }

  // ── Chart data prep ────────────────────────────────────────────────────────
  const distChartData = (districtData?.data ?? [])
    .sort((a, b) => b.total_purchases - a.total_purchases)
    .slice(0, 12)

  // Aggregate daily trend across districts
  const trendMap = new Map<string, number>()
  for (const row of trendData?.data ?? []) {
    trendMap.set(row.purchase_date, (trendMap.get(row.purchase_date) ?? 0) + row.total_purchases)
  }
  const trendChartData = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }))

  const ageChartData = (ageData?.data ?? []).map(r => ({
    name: r.age_bracket,
    value: Number(r.total_drinks),
  }))

  const adoptionChartData = (adoptionData?.data ?? [])
    .sort((a, b) => b.adoption_rate_pct - a.adoption_rate_pct)
    .slice(0, 10)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            Government Reports
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Aggregate analytics — all data is anonymised (k-anon ≥ 5)
          </p>
        </div>
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            id="btn-download-pdf"
            onClick={handlePDF}
            disabled={pdfLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-60 transition"
          >
            {pdfLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Download className="w-3.5 h-3.5" />}
            Download PDF
          </button>
          <button
            id="btn-export-csv"
            onClick={handleCSV}
            disabled={csvLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-60 transition"
          >
            {csvLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <FileDown className="w-3.5 h-3.5" />}
            Export CSV
          </button>
          <button
            id="btn-export-xlsx"
            onClick={handleXLSX}
            disabled={xlsxLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-60 transition"
          >
            {xlsxLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <FileDown className="w-3.5 h-3.5" />}
            Export Excel
          </button>
          <button
            id="btn-powerbi"
            onClick={loadManifest}
            disabled={pbiLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F2C811] hover:bg-[#e5bd07] text-gray-900 text-xs font-semibold disabled:opacity-60 transition"
          >
            {pbiLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <DatabaseZap className="w-3.5 h-3.5" />}
            Power BI
            {pbiOpen
              ? <ChevronUp className="w-3 h-3" />
              : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Power BI instruction panel */}
      {pbiOpen && (
        <div className="bg-[#fffbeb] dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-2xl p-5 text-sm">
          <div className="flex items-start gap-3">
            <DatabaseZap className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-bold text-yellow-800 dark:text-yellow-200">Power BI Desktop — Connection Instructions</p>
              {pbiManifest?.error ? (
                <p className="text-yellow-700 dark:text-yellow-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />{pbiManifest.error}
                </p>
              ) : (
                <>
                  <p className="text-yellow-700 dark:text-yellow-300">{pbiManifest?.instructions}</p>
                  <p className="text-yellow-700 dark:text-yellow-300 text-xs">
                    Last export: <span className="font-mono">{pbiManifest?.generated_at}</span>
                  </p>
                  {(pbiManifest?.files ?? []).length > 0 && (
                    <table className="w-full text-xs mt-2 border-collapse">
                      <thead>
                        <tr className="border-b border-yellow-300">
                          <th className="text-left py-1 font-semibold text-yellow-800 dark:text-yellow-200">File</th>
                          <th className="text-right py-1 font-semibold text-yellow-800 dark:text-yellow-200">Rows</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pbiManifest.files.map((f: any) => (
                          <tr key={f.filename} className="border-b border-yellow-200/50">
                            <td className="py-1 font-mono text-yellow-800 dark:text-yellow-300">{f.filename}</td>
                            <td className="py-1 text-right text-yellow-700 dark:text-yellow-400">{f.row_count.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
              <p className="text-[10px] text-yellow-600 dark:text-yellow-400">
                Production upgrade: connect Power BI directly via the <code>tasmac_reports</code> read-only PostgreSQL user (SELECT on v_* views only).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {/* District */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">District</label>
            <select
              id="filter-district"
              value={district}
              onChange={e => setDistrict(e.target.value)}
              className="text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Districts</option>
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          {/* From date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">From</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                id="filter-from-date"
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="pl-8 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {/* To date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">To</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                id="filter-to-date"
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="pl-8 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          {/* Sort */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Sort by</label>
            <select
              id="filter-sort-by"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="purchases">Purchases</option>
              <option value="revenue">Revenue</option>
              <option value="district">District</option>
              <option value="unique_consumers">Consumers</option>
            </select>
          </div>
          {/* Buttons */}
          <div className="flex gap-2 ml-auto">
            <button
              id="btn-reset-filters"
              onClick={resetFilters}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" /> Reset
            </button>
            <button
              id="btn-apply-filters"
              onClick={applyFilters}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      {sumLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<Store className="w-5 h-5 text-blue-600" />}
            label="Active Shops"
            value={summary.total_active_shops}
            color="bg-blue-50 dark:bg-blue-900/20"
          />
          <KpiCard
            icon={<Users className="w-5 h-5 text-emerald-600" />}
            label="Total Consumers"
            value={summary.total_consumers}
            sub={`${(summary.restricted_consumers ?? 0).toLocaleString()} restricted`}
            color="bg-emerald-50 dark:bg-emerald-900/20"
          />
          <KpiCard
            icon={<ShoppingCart className="w-5 h-5 text-amber-600" />}
            label="Total Purchases"
            value={summary.total_purchases}
            color="bg-amber-50 dark:bg-amber-900/20"
          />
          <KpiCard
            icon={<TrendingUp className="w-5 h-5 text-purple-600" />}
            label="Total Revenue"
            value={formatINR(Number(summary.total_revenue ?? 0))}
            sub={`${summary.districts_covered ?? 0} districts`}
            color="bg-purple-50 dark:bg-purple-900/20"
          />
        </div>
      )}

      {/* Charts — row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* District Sales Bar */}
        <ChartCard
          title="Purchases by District (Top 12)"
          icon={<FileBarChart2 className="w-4 h-4 text-blue-500" />}
          loading={distLoading}
        >
          {distChartData.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No data for selected filters</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={distChartData} margin={{ top: 0, right: 8, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} />
                <XAxis dataKey="district" tick={{ fontSize: 9, fill: '#9ca3af' }} angle={-40} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [v.toLocaleString(), 'Purchases']} />
                <Bar dataKey="total_purchases" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Purchases" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Daily Trend Line */}
        <ChartCard
          title="Daily Consumption Trend"
          icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
          loading={trendLoading}
        >
          {trendChartData.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No trend data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendChartData} margin={{ top: 0, right: 8, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#9ca3af' }}
                  angle={-40}
                  textAnchor="end"
                  interval={Math.floor(trendChartData.length / 8)}
                />
                <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [v.toLocaleString(), 'Purchases']} />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  name="Purchases"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Charts — row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Age Group Donut */}
        <ChartCard
          title="Consumption by Age Group (standard drinks)"
          icon={<Users className="w-4 h-4 text-amber-500" />}
          loading={ageLoading}
        >
          {ageChartData.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">Insufficient data (k-anon)</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={ageChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={true}
                >
                  {ageChartData.map((_, idx) => (
                    <Cell key={idx} fill={PALETTE[idx % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: any) => [Number(v).toFixed(1), 'Std. Drinks']} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Restriction Adoption Rate */}
        <ChartCard
          title="Restriction Adoption Rate by District (Top 10)"
          icon={<ShieldCheck className="w-4 h-4 text-purple-500" />}
          loading={adoptLoading}
        >
          {adoptionChartData.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={adoptionChartData}
                layout="vertical"
                margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.4} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: '#9ca3af' }} unit="%" domain={[0, 100]} />
                <YAxis type="category" dataKey="district" tick={{ fontSize: 9, fill: '#9ca3af' }} width={80} />
                <Tooltip
                  {...TOOLTIP_STYLE}
                  formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Adoption Rate']}
                />
                <Bar dataKey="adoption_rate_pct" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Adoption Rate" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* District stats table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-white text-sm">District Statistics</h2>
          <span className="text-xs text-gray-400">
            {districtData?.total ?? 0} districts · k-anon ≥ 5
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['District', 'Purchases', 'Revenue', 'Std. Drinks', 'Consumers'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {distLoading && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…
                  </td>
                </tr>
              )}
              {(districtData?.data ?? []).map(d => (
                <tr key={d.district} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition">
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{d.district}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{(d.total_purchases ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatINR(Number(d.total_revenue ?? 0))}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{Number(d.total_drinks ?? 0).toFixed(1)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{(d.unique_consumers ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

export default ReportsPage
