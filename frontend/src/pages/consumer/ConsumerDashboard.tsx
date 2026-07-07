import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  AlertTriangle, RefreshCw, Settings2, ShoppingBag,
  QrCode, ShieldOff, TrendingUp, Droplets,
} from 'lucide-react'
import { consumerApi } from '../../api/consumer.api'
import type { ConsumptionSummary } from '../../types/consumer.types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
}

// ─── SVG Ring Chart ───────────────────────────────────────────────────────────

interface RingProps {
  pct: number
  status: 'safe' | 'warn' | 'exceeded'
  size?: number
}

const ringColor = (s: 'safe' | 'warn' | 'exceeded') =>
  s === 'exceeded' ? '#ef4444' : s === 'warn' ? '#f97316' : '#22c55e'

const RingChart: React.FC<RingProps> = ({ pct, status, size = 72 }) => {
  const r = 28
  const circ = 2 * Math.PI * r
  const clamped = Math.min(pct / 100, 1)
  const dash = clamped * circ
  const color = ringColor(status)
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="flex-shrink-0">
      <circle cx={32} cy={32} r={r} fill="none" stroke="currentColor"
        strokeWidth={6} className="text-gray-200 dark:text-gray-700" />
      <circle
        cx={32} cy={32} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x={32} y={36} textAnchor="middle" fill={color}
        fontSize={12} fontWeight={700} fontFamily="system-ui">
        {Math.round(pct)}%
      </text>
    </svg>
  )
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

const SkeletonCard: React.FC = () => (
  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 space-y-3 animate-pulse">
    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
    <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded-full w-16 mx-auto" />
    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded" />
  </div>
)

// ─── Consumption Card ─────────────────────────────────────────────────────────

interface CardProps { label: string; summary: ConsumptionSummary }

const ConsumptionCard: React.FC<CardProps> = ({ label, summary }) => {
  const { consumed_sd, limit_sd, percent_used, status, consumed_beer_ml, consumed_wine_ml, consumed_spirits_ml } = summary
  const barBg = status === 'exceeded' ? 'bg-red-500' : status === 'warn' ? 'bg-orange-500' : 'bg-green-500'
  const badgeBg = status === 'exceeded'
    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
    : status === 'warn'
    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
    : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${badgeBg}`}>
          {status}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-3xl font-black text-gray-900 dark:text-gray-100 leading-none">
            {consumed_sd.toFixed(1)}
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 ml-1">SD</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {limit_sd > 0 ? `of ${limit_sd} SD limit` : 'No limit set'}
          </p>
        </div>
        <RingChart pct={percent_used} status={status} />
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barBg}`}
          style={{ width: `${Math.min(percent_used, 100)}%` }}
        />
      </div>

      {/* ML equivalents */}
      <div className="flex flex-wrap gap-2 text-[11px] text-gray-500 dark:text-gray-400">
        {consumed_beer_ml != null && consumed_beer_ml > 0 && <span>🍺 {consumed_beer_ml}ml</span>}
        {consumed_wine_ml != null && consumed_wine_ml > 0 && <span>🍷 {consumed_wine_ml}ml</span>}
        {consumed_spirits_ml != null && consumed_spirits_ml > 0 && <span>🥃 {consumed_spirits_ml}ml</span>}
        {!consumed_beer_ml && !consumed_wine_ml && !consumed_spirits_ml && (
          <span className="text-gray-400 dark:text-gray-600 italic">No consumption today</span>
        )}
      </div>
    </div>
  )
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface TooltipProps { active?: boolean; payload?: Array<{ value: number }>; label?: string }
const ChartTooltip: React.FC<TooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</p>
      <p className="text-blue-600 dark:text-blue-400">{payload[0].value.toFixed(2)} SD</p>
    </div>
  )
}

// ─── Quick Action Button ──────────────────────────────────────────────────────

interface ActionProps { icon: React.ReactNode; label: string; color: string; onClick: () => void }
const QuickAction: React.FC<ActionProps> = ({ icon, label, color, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-gray-200 dark:border-gray-700/50 bg-white dark:bg-gray-900 hover:shadow-md hover:-translate-y-0.5 transition-all"
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
      {icon}
    </div>
    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 text-center">{label}</span>
  </button>
)

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const ConsumerDashboard: React.FC = () => {
  const navigate = useNavigate()

  const { data: dash, isLoading, isError, refetch } = useQuery({
    queryKey: ['consumer-dashboard'],
    queryFn: () => consumerApi.getDashboard().then(r => r.data),
    refetchInterval: 30_000,
  })

  const dailyChartData = useMemo(() =>
    dash?.daily_chart?.map(d => ({ name: d.label, sd: d.consumed_sd, limit: d.limit_sd })) ?? [],
    [dash]
  )
  const weeklyChartData = useMemo(() =>
    dash?.weekly_chart?.map(w => ({ name: w.label, sd: w.consumed_sd, limit: w.limit_sd })) ?? [],
    [dash]
  )

  const dailyLimit = dash?.daily_chart?.[0]?.limit_sd ?? 0
  const weeklyLimit = dash?.weekly_chart?.[0]?.limit_sd ?? 0

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="h-36 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
        </div>
        <div className="h-56 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-2xl" />
        <div className="h-56 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-2xl" />
      </div>
    )
  }

  if (isError || !dash) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <p className="text-gray-700 dark:text-gray-300 font-semibold">Failed to load dashboard</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-6 py-2.5 transition"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  const alertIsExceeded = dash.alert_type === 'exceeded'

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">

      {/* ── Welcome Banner ── */}
      <div className="relative rounded-2xl bg-gradient-to-br from-blue-700 to-blue-900 dark:from-blue-800 dark:to-blue-950 p-6 shadow-lg overflow-hidden">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-6 w-52 h-52 rounded-full bg-white/5" />

        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-blue-200 text-sm font-medium mb-1">{greeting()},</p>
            <h1 className="text-2xl font-black text-white leading-tight">{dash.consumer_name}</h1>
            <p className="text-blue-200/70 text-sm mt-1.5 flex flex-wrap items-center gap-2">
              <span className="font-mono bg-blue-800/50 px-2 py-0.5 rounded-lg text-xs">
                {dash.aadhaar_masked}
              </span>
              {dash.member_since && (
                <span>· Member since {formatDate(dash.member_since)}</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {dash.is_teetotaler && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-red-500/20 text-red-300 border border-red-400/30">
                🚫 Teetotaler
              </span>
            )}
            {dash.is_self_restricted && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                🔒 Self-Restricted
              </span>
            )}
            {!dash.is_teetotaler && !dash.is_self_restricted && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-green-500/20 text-green-300 border border-green-400/30">
                ✅ Active Consumer
              </span>
            )}
          </div>
        </div>

        <div className="relative flex flex-wrap gap-3 mt-4">
          <div className="text-[11px] bg-blue-800/50 rounded-lg px-3 py-1.5 text-blue-200 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            WHO Daily: <strong className="ml-1">{dash.who_daily_advisory} SD/day</strong>
          </div>
          <div className="text-[11px] bg-blue-800/50 rounded-lg px-3 py-1.5 text-blue-200 flex items-center gap-1">
            <Droplets className="w-3 h-3" />
            WHO Weekly: <strong className="ml-1">{dash.who_weekly_advisory} SD/week</strong>
          </div>
        </div>
      </div>

      {/* ── Alert Banner ── */}
      {dash.alert_message && (
        <div className={`flex items-start gap-3 rounded-2xl px-5 py-4 border ${
          alertIsExceeded
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50 text-red-700 dark:text-red-400'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/50 text-amber-700 dark:text-amber-400'
        }`}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{dash.alert_message}</p>
        </div>
      )}

      {/* ── Consumption Summary Cards ── */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Consumption Summary
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ConsumptionCard label="Today" summary={dash.today} />
          <ConsumptionCard label="This Week" summary={dash.this_week} />
          <ConsumptionCard label="This Month" summary={dash.this_month} />
        </div>
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 7-Day Area Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Last 7 Days</h3>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
              Daily SD
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailyChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              {dailyLimit > 0 && (
                <ReferenceLine y={dailyLimit} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5}
                  label={{ value: `Limit`, fill: '#ef4444', fontSize: 10, position: 'right' }} />
              )}
              <Area type="monotone" dataKey="sd" stroke="#3b82f6" strokeWidth={2.5}
                fill="url(#blueGrad)" dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* 4-Week Bar Chart */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Last 4 Weeks</h3>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
              Weekly SD
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyChartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }} barSize={32}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              {weeklyLimit > 0 && (
                <ReferenceLine y={weeklyLimit} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1.5}
                  label={{ value: `Limit`, fill: '#ef4444', fontSize: 10, position: 'right' }} />
              )}
              <Bar dataKey="sd" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div>
        <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction
            icon={<Settings2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
            label="Set Limits"
            color="bg-blue-50 dark:bg-blue-900/20"
            onClick={() => navigate('/consumer/limits')}
          />
          <QuickAction
            icon={<ShoppingBag className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
            label="Purchase History"
            color="bg-purple-50 dark:bg-purple-900/20"
            onClick={() => navigate('/consumer/purchases')}
          />
          <QuickAction
            icon={<QrCode className="w-5 h-5 text-green-600 dark:text-green-400" />}
            label="QR Code"
            color="bg-green-50 dark:bg-green-900/20"
            onClick={() => navigate('/consumer/qr')}
          />
          <QuickAction
            icon={<ShieldOff className="w-5 h-5 text-red-600 dark:text-red-400" />}
            label="Restrictions"
            color="bg-red-50 dark:bg-red-900/20"
            onClick={() => navigate('/consumer/restrictions')}
          />
        </div>
      </div>
    </div>
  )
}

export default ConsumerDashboard
