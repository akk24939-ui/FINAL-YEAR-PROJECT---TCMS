/**
 * Admin Overview Page — dashboard stats cards + recent audit log.
 */
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Store, Users, Stethoscope, ShoppingCart, AlertTriangle, Activity } from 'lucide-react'
import { adminOverviewApi } from '../../api/admin.api'

const StatCard: React.FC<{ label: string; value: number | string; icon: React.ReactNode; accent: string; sub?: string }> = ({ label, value, icon, accent, sub }) => (
  <div className={`bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 flex items-center gap-4 hover:shadow-lg transition-shadow`}>
    <div className={`w-12 h-12 rounded-xl ${accent} flex items-center justify-center flex-shrink-0`}>{icon}</div>
    <div>
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black text-gray-900 dark:text-white">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
)

const EVENT_COLORS: Record<string, string> = {
  login_success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  login_failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  admin_created_shop: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  admin_reset_pin: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  admin_suspended_shop: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  admin_created_doctor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  admin_updated_global_limits: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
}

const OverviewPage: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => adminOverviewApi.get().then(r => r.data),
    refetchInterval: 60_000,
  })

  const stats = [
    { label: 'Total Consumers', value: data?.total_consumers ?? '—', icon: <Users className="w-6 h-6 text-emerald-600" />, accent: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Active Shops', value: data?.total_shops ?? '—', icon: <Store className="w-6 h-6 text-blue-600" />, accent: 'bg-blue-50 dark:bg-blue-900/20', sub: data ? `${data.suspended_shops} suspended` : undefined },
    { label: 'Doctors', value: data?.total_doctors ?? '—', icon: <Stethoscope className="w-6 h-6 text-purple-600" />, accent: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: "Today's Purchases", value: data?.today_purchases ?? '—', icon: <ShoppingCart className="w-6 h-6 text-amber-600" />, accent: 'bg-amber-50 dark:bg-amber-900/20' },
  ]

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Dashboard Overview</h1>
        <p className="text-sm text-gray-400 mt-1">System-wide statistics and recent activity</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Suspended shops warning */}
      {(data?.suspended_shops ?? 0) > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            <strong>{data?.suspended_shops}</strong> shop{data?.suspended_shops !== 1 ? 's are' : ' is'} currently suspended and cannot process transactions.
          </p>
        </div>
      )}

      {/* Recent audit log */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <Activity className="w-4 h-4 text-blue-600" />
          <h2 className="font-bold text-gray-900 dark:text-white text-sm">Recent Activity</h2>
          <span className="ml-auto text-xs text-gray-400">Last 10 events</span>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
          {(data?.recent_audit ?? []).length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">No audit events yet.</p>
          )}
          {(data?.recent_audit ?? []).map(log => (
            <div key={log.id} className="flex items-start gap-3 px-5 py-3.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${EVENT_COLORS[log.event_type] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                {log.event_type.replace(/_/g, ' ').toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{log.description || '—'}</p>
                <p className="text-xs text-gray-400 mt-0.5">{log.ip_address} · {new Date(log.created_at).toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default OverviewPage
