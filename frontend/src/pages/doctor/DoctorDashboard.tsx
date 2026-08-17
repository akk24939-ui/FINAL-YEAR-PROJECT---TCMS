/**
 * Doctor Dashboard — Clinical Intervention Portal
 * Route: /doctor (protected)
 *
 * Features:
 *   - Patient search (exact mobile / Aadhaar)
 *   - Patient detail panel (consumption stats + restriction history)
 *   - Issue temporary or permanent restriction
 *   - Cancel own restriction (admin can cancel any via admin panel)
 *   - Aggregate public-health stats panel
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Stethoscope, Search, User, AlertTriangle, CheckCircle2, XCircle,
  Clock, Loader2, LogOut, Sun, Moon, ChevronRight, Activity,
  ShieldAlert, ShieldCheck, X, Info, BarChart2, Calendar
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useDoctorAuthStore } from '../../store/doctorAuthStore'
import { doctorAuthApi, doctorPatientApi, doctorRestrictionApi, doctorDashboardApi } from '../../api/doctor.api'
import { useTheme } from '../../hooks/useTheme'
import { getErrorMessage } from '../../utils/getErrorMessage'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ConsumptionSummary {
  daily_consumed_ml: number
  weekly_consumed_ml: number
  daily_limit_ml: number
  weekly_limit_ml: number
  daily_pct_used: number
  weekly_pct_used: number
  total_purchases_30d: number
}

interface PatientResult {
  patient_user_id: string
  full_name: string
  age: number | null
  district: string | null
  beverage_preference: string | null
  is_teetotaler: boolean
  has_active_doctor_restriction: boolean
  active_restriction_category: string | null
  consumption_summary: ConsumptionSummary
}

interface RestrictionRecord {
  restriction_id: string
  reason_category: string
  reason_category_label: string
  reason: string
  restriction_type: string
  status: string
  start_date: string
  end_date: string | null
  doctor_name: string
  hospital_name: string | null
  cancelled_at: string | null
  cancelled_by_name: string | null
  cancellation_reason: string | null
}

interface PatientDetail {
  patient_user_id: string
  full_name: string
  age: number | null
  district: string | null
  is_teetotaler: boolean
  consumption_summary: ConsumptionSummary
  restrictions: RestrictionRecord[]
  purchases_30d: unknown[]
}

interface DashStats {
  total_active_restrictions: number
  total_restrictions_issued_30d: number
  top_restriction_category: string | null
  district_risk_summary: Record<string, number>
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const CATEGORY_OPTIONS = [
  { value: 'liver_disease', label: 'Liver Disease' },
  { value: 'addiction_risk', label: 'Addiction Risk' },
  { value: 'medication_interaction', label: 'Medication Interaction' },
  { value: 'pregnancy', label: 'Pregnancy' },
  { value: 'other', label: 'Other Medical' },
]

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    active: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    expired: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  }
  return map[status] || 'bg-gray-100 text-gray-600'
}

const pctColor = (pct: number) =>
  pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'

// ── Main Component ─────────────────────────────────────────────────────────────
const DoctorDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { doctor, logout } = useDoctorAuthStore()

  // ── Search state ──────────────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<PatientResult | null>(null)
  const [searchNotFound, setSearchNotFound] = useState(false)
  const [searchError, setSearchError] = useState('')

  // ── Patient detail state ──────────────────────────────────────────────────
  const [detail, setDetail] = useState<PatientDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // ── Issue restriction form ────────────────────────────────────────────────
  const [showIssueForm, setShowIssueForm] = useState(false)
  const [issueCategory, setIssueCategory] = useState('liver_disease')
  const [issueType, setIssueType] = useState<'temporary' | 'permanent'>('temporary')
  const [issueDays, setIssueDays] = useState(30)
  const [issueReason, setIssueReason] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [issueError, setIssueError] = useState('')
  const [issueSuccess, setIssueSuccess] = useState('')

  // ── Cancel restriction state ──────────────────────────────────────────────
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  // ── Dashboard stats ───────────────────────────────────────────────────────
  const [stats, setStats] = useState<DashStats | null>(null)

  useEffect(() => {
    doctorDashboardApi.get()
      .then(r => setStats(r.data))
      .catch(() => { })
  }, [])

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim().length < 4) return
    setSearching(true)
    setSearchResult(null)
    setSearchNotFound(false)
    setSearchError('')
    setDetail(null)
    setShowIssueForm(false)
    setIssueSuccess('')
    try {
      const res = await doctorPatientApi.search(query.trim())
      if (res.data.found) {
        setSearchResult(res.data.patient)
        // Auto-load detail
        loadDetail(res.data.patient.patient_user_id)
      } else {
        setSearchNotFound(true)
      }
    } catch {
      setSearchError('Search failed. Please try again.')
    } finally {
      setSearching(false)
    }
  }, [query])

  const loadDetail = async (uid: string) => {
    setLoadingDetail(true)
    try {
      const r = await doctorPatientApi.getDetail(uid)
      setDetail(r.data)
    } catch {
      // non-critical
    } finally {
      setLoadingDetail(false)
    }
  }

  // ── Issue restriction ────────────────────────────────────────────────────
  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchResult) return
    setIssuing(true)
    setIssueError('')
    setIssueSuccess('')
    try {
      await doctorRestrictionApi.issue(searchResult.patient_user_id, {
        reason: issueReason,
        reason_category: issueCategory,
        restriction_type: issueType,
        ...(issueType === 'temporary' ? { duration_days: issueDays } : {}),
      })
      setIssueSuccess('Restriction issued successfully. Purchase is now blocked at all shops.')
      setShowIssueForm(false)
      setIssueReason('')
      // Refresh
      setTimeout(() => {
        handleSearch(new Event('submit') as unknown as React.FormEvent)
      }, 800)
    } catch (err: unknown) {
      setIssueError(getErrorMessage(err, 'Failed to issue restriction.'))
    } finally {
      setIssuing(false)
    }
  }

  // ── Cancel restriction ───────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!cancellingId || !cancelReason.trim()) return
    setCancelling(true)
    setCancelError('')
    try {
      await doctorRestrictionApi.cancel(cancellingId, cancelReason)
      setCancellingId(null)
      setCancelReason('')
      if (searchResult) loadDetail(searchResult.patient_user_id)
    } catch (err: unknown) {
      setCancelError(getErrorMessage(err, 'Failed to cancel restriction.'))
    } finally {
      setCancelling(false)
    }
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try { await doctorAuthApi.logout() } catch { /* ignore */ }
    logout()
    navigate('/login/doctor', { replace: true })
  }

  // ── Shared input style ────────────────────────────────────────────────────
  const inputCls =
    'w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
  const selectCls = inputCls

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-black text-gray-900 dark:text-white text-sm tracking-tight">
                TASMAC <span className="text-emerald-600 dark:text-emerald-400">Clinical</span>
              </span>
              {doctor && (
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-none mt-0.5">
                  Dr. {doctor.full_name} · {doctor.hospital_name}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Stats row ── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Active Restrictions', value: stats.total_active_restrictions, icon: ShieldAlert, color: 'text-red-500' },
              { label: 'Issued (30 days)', value: stats.total_restrictions_issued_30d, icon: Activity, color: 'text-amber-500' },
              { label: 'Top Category', value: stats.top_restriction_category ?? '—', icon: BarChart2, color: 'text-blue-500' },
              { label: 'Districts Affected', value: Object.keys(stats.district_risk_summary ?? {}).length, icon: Calendar, color: 'text-emerald-500' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 flex flex-col gap-2">
                <div className={`${color}`}><Icon className="w-5 h-5" /></div>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Patient search ── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-500" /> Patient Lookup
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Enter exact 10-digit mobile number or 12-digit Aadhaar number. Every search is audit-logged.
          </p>

          <form onSubmit={handleSearch} className="flex gap-3">
            <input
              className={inputCls + ' flex-1'}
              type="text"
              placeholder="Mobile (10 digits) or Aadhaar (12 digits)"
              value={query}
              onChange={e => setQuery(e.target.value)}
              minLength={4}
              maxLength={12}
              id="patient-search-input"
            />
            <button
              type="submit"
              disabled={searching || query.trim().length < 4}
              id="patient-search-btn"
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all whitespace-nowrap"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </form>

          {/* Search error */}
          {searchError && (
            <div className="mt-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2.5 rounded-xl">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {searchError}
            </div>
          )}

          {/* Not found */}
          {searchNotFound && (
            <div className="mt-3 flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl">
              <Info className="w-4 h-4 flex-shrink-0" /> No patient found for that identifier. Verify and try again.
            </div>
          )}

          {/* Issue success */}
          {issueSuccess && (
            <div className="mt-3 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-2.5 rounded-xl">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {issueSuccess}
            </div>
          )}
        </div>

        {/* ── Patient result panel ── */}
        {searchResult && (
          <div className="grid lg:grid-cols-5 gap-6">

            {/* Left: Patient card */}
            <div className="lg:col-span-2 space-y-4">

              {/* Identity card */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40 flex items-center justify-center flex-shrink-0">
                    <User className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 dark:text-white text-base truncate">{searchResult.full_name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {searchResult.age ? `Age ${searchResult.age}` : 'Age unknown'}
                      {searchResult.district ? ` · ${searchResult.district}` : ''}
                    </p>
                  </div>
                </div>

                {/* Restriction status banner */}
                {searchResult.has_active_doctor_restriction ? (
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-300 text-xs bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2 rounded-lg mb-3">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span><strong>Medical restriction active</strong> — {searchResult.active_restriction_category}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-xs bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-2 rounded-lg mb-3">
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                    No active medical restriction
                  </div>
                )}

                {/* Consumption bars */}
                <div className="space-y-2.5">
                  {[
                    { label: 'Daily', consumed: searchResult.consumption_summary.daily_consumed_ml, limit: searchResult.consumption_summary.daily_limit_ml, pct: searchResult.consumption_summary.daily_pct_used },
                    { label: 'Weekly', consumed: searchResult.consumption_summary.weekly_consumed_ml, limit: searchResult.consumption_summary.weekly_limit_ml, pct: searchResult.consumption_summary.weekly_pct_used },
                  ].map(({ label, consumed, limit, pct }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>{label}</span>
                        <span>{consumed} / {limit} ml ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pctColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 dark:text-gray-600 pt-1">
                    {searchResult.consumption_summary.total_purchases_30d} purchases in last 30 days
                  </p>
                </div>
              </div>

              {/* Issue restriction button / form */}
              {!showIssueForm ? (
                <button
                  onClick={() => { setShowIssueForm(true); setIssueError(''); setIssueSuccess('') }}
                  id="issue-restriction-btn"
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-red-600/20 transition-all"
                >
                  <AlertTriangle className="w-4 h-4" /> Issue Medical Restriction
                </button>
              ) : (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-200 dark:border-red-500/30 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">Issue Restriction</h4>
                    <button onClick={() => setShowIssueForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleIssue} className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-1">Category</label>
                      <select className={selectCls} value={issueCategory} onChange={e => setIssueCategory(e.target.value)}>
                        {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-1">Type</label>
                      <div className="flex gap-2">
                        {(['temporary', 'permanent'] as const).map(t => (
                          <button key={t} type="button"
                            onClick={() => setIssueType(t)}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${issueType === t ? 'bg-red-600 border-red-600 text-white' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'}`}
                          >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {issueType === 'temporary' && (
                      <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-1">Duration (days)</label>
                        <input className={inputCls} type="number" min={1} max={365} value={issueDays} onChange={e => setIssueDays(Number(e.target.value))} />
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-1">Clinical Notes</label>
                      <textarea
                        className={inputCls + ' resize-none'}
                        rows={3}
                        placeholder="Describe clinical observations, diagnosis codes, etc. This is NOT shown to the patient or operator."
                        value={issueReason}
                        onChange={e => setIssueReason(e.target.value)}
                        required
                        minLength={10}
                      />
                    </div>

                    {issueError && (
                      <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2 rounded-lg">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {issueError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={issuing || issueReason.length < 10}
                      id="confirm-restriction-btn"
                      className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
                    >
                      {issuing ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                      Confirm & Issue
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Right: Restriction history + purchases */}
            <div className="lg:col-span-3 space-y-4">

              {loadingDetail ? (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
                </div>
              ) : detail ? (
                <>
                  {/* Restriction history */}
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-4 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-500" /> Restriction History
                    </h3>

                    {detail.restrictions.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-4">No restrictions on record.</p>
                    ) : (
                      <div className="space-y-3">
                        {detail.restrictions.map((r) => (
                          <div key={r.restriction_id} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusBadge(r.status)}`}>
                                    {r.status.toUpperCase()}
                                  </span>
                                  <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{r.reason_category_label}</span>
                                  <span className="text-xs text-gray-400 dark:text-gray-600">· {r.restriction_type}</span>
                                </div>
                                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{r.reason}</p>
                              </div>
                              {r.status === 'active' && (
                                <button
                                  onClick={() => { setCancellingId(r.restriction_id); setCancelError(''); setCancelReason('') }}
                                  className="flex-shrink-0 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-300 font-semibold transition-colors flex items-center gap-1"
                                >
                                  <XCircle className="w-3.5 h-3.5" /> Cancel
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-600 mt-1">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(r.start_date).toLocaleDateString()}</span>
                              {r.end_date && <span>→ {new Date(r.end_date).toLocaleDateString()}</span>}
                              <span>by {r.doctor_name}</span>
                              {r.hospital_name && <span>· {r.hospital_name}</span>}
                            </div>
                            {r.status === 'cancelled' && r.cancellation_reason && (
                              <p className="text-[11px] text-gray-500 dark:text-gray-500 mt-1 italic">
                                Cancelled by {r.cancelled_by_name}: "{r.cancellation_reason}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Cancel dialog */}
                  {cancellingId && (
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-amber-200 dark:border-amber-500/30 p-5">
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-3 flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-amber-500" /> Cancel Restriction
                      </h4>
                      <textarea
                        className={inputCls + ' resize-none mb-3'}
                        rows={3}
                        placeholder="Reason for cancellation (required)"
                        value={cancelReason}
                        onChange={e => setCancelReason(e.target.value)}
                        minLength={5}
                      />
                      {cancelError && (
                        <p className="text-xs text-red-600 dark:text-red-400 mb-2">{cancelError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={handleCancel}
                          disabled={cancelling || cancelReason.trim().length < 5}
                          className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
                        >
                          {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          Confirm Cancel
                        </button>
                        <button
                          onClick={() => setCancellingId(null)}
                          className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Recent purchases */}
                  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-500" /> Recent Purchases (30 days)
                    </h3>
                    {detail.purchases_30d.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-4">No purchases in last 30 days.</p>
                    ) : (
                      <div className="space-y-2">
                        {(detail.purchases_30d as Record<string, unknown>[]).map((p, i) => (
                          <div key={i} className="flex items-center justify-between text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                            <span className="font-medium">{String(p.product_name ?? '—')}</span>
                            <span className="text-gray-500">{Number(p.quantity_ml ?? 0)} ml</span>
                            <span className="text-gray-400">{p.purchased_at ? new Date(String(p.purchased_at)).toLocaleDateString() : '—'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              {/* Prompt if no result yet */}
              {!searchResult && !searching && !searchNotFound && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Search className="w-7 h-7 text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Search for a patient above</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600 max-w-xs">
                    Enter the patient's exact mobile number or Aadhaar number to view their consumption history and manage medical restrictions.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Placeholder when no search done ── */}
        {!searchResult && !searching && !searchNotFound && !searchError && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 flex flex-col items-center justify-center text-center gap-3 min-h-[260px]">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center">
              <Stethoscope className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-800 dark:text-white">Clinical Intervention Dashboard</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                Search for a registered consumer using their mobile or Aadhaar number to view purchase patterns, assess risk, and apply medical restrictions.
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              {[
                { icon: Search, label: 'Exact-match search' },
                { icon: ShieldAlert, label: 'Issue restrictions' },
                { icon: Activity, label: 'Purchase history' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center border border-gray-200 dark:border-gray-700">
                    <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </div>
                  <span className="text-[11px] text-gray-400 dark:text-gray-600 font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <footer className="mt-8 py-3 text-center text-[11px] text-gray-400 dark:text-gray-600 border-t border-gray-100 dark:border-gray-800">
        TASMAC Clinical Module · Identified Clinical Access · All searches are audit-logged
      </footer>
    </div>
  )
}

export default DoctorDashboard
