/**
 * AuditLogPage — Filterable, paginated audit trail viewer.
 */
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ScrollText, Filter } from 'lucide-react'
import { adminAuditApi } from '../../api/admin.api'

const EVENT_TYPES = [
  'login_success', 'login_failed', 'account_locked', 'logout',
  'admin_created_shop', 'admin_reset_pin', 'admin_suspended_shop', 'admin_reactivated_shop',
  'admin_created_doctor', 'admin_activated_doctor', 'admin_deactivated_doctor', 'admin_revoked_doctor',
  'admin_updated_global_limits', 'shop_login_success', 'shop_pin_failed', 'shop_pin_locked',
  'limit_changed', 'teetotaler_enabled', 'teetotaler_disabled', 'self_restriction_locked',
  'consumer_registered', 'profile_updated', 'qr_generated', 'pdf_downloaded',
]

const EVENT_COLORS: Record<string, string> = {
  login_success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  login_failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  account_locked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  admin_created_shop: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  admin_suspended_shop: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  admin_reset_pin: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  admin_created_doctor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  admin_deactivated_doctor: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  admin_updated_global_limits: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  shop_pin_locked: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const AuditLogPage: React.FC = () => {
  const [eventType, setEventType] = useState('')
  const [skip, setSkip] = useState(0)
  const LIMIT = 50

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit', eventType, skip],
    queryFn: () => adminAuditApi.list({ event_type: eventType || undefined, skip, limit: LIMIT }).then(r => r.data),
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Audit Log</h1>
        <p className="text-sm text-gray-400">Immutable security event trail — all admin and user actions</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Filter className="w-4 h-4" /> Event:
        </div>
        <select
          value={eventType}
          onChange={e => { setEventType(e.target.value); setSkip(0) }}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
        >
          <option value="">All events</option>
          {EVENT_TYPES.map(et => <option key={et} value={et}>{et.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <ScrollText className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-bold text-gray-900 dark:text-white">Events</span>
          <span className="ml-auto text-xs text-gray-400">{data?.total ?? 0} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['Timestamp', 'Event', 'Description', 'IP Address', 'Metadata'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {isLoading && <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading…</td></tr>}
              {!isLoading && (data?.logs ?? []).length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">No audit events found.</td></tr>}
              {(data?.logs ?? []).map(log => (
                <tr key={log.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition">
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${EVENT_COLORS[log.event_type] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                      {log.event_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-xs truncate">{log.description ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{log.ip_address ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate font-mono">{log.metadata ? JSON.stringify(log.metadata) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-400">
          <span>Page {Math.floor(skip / LIMIT) + 1}</span>
          <div className="flex gap-2">
            <button disabled={skip === 0} onClick={() => setSkip(s => Math.max(0, s - LIMIT))} className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 disabled:opacity-40">← Prev</button>
            <button disabled={(skip + LIMIT) >= (data?.total ?? 0)} onClick={() => setSkip(s => s + LIMIT)} className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 disabled:opacity-40">Next →</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuditLogPage
