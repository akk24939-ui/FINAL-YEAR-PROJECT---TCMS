/**
 * ConsumersPage — Read-only admin view of consumer accounts.
 * Shows: name, district, teetotaler flag, self-restriction status, account status.
 */
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ShieldOff, Shield, UserX } from 'lucide-react'
import { adminConsumersApi } from '../../api/admin.api'

const ConsumersPage: React.FC = () => {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [skip, setSkip] = useState(0)
  const LIMIT = 50

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setSkip(0) }, 400)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-consumers', debouncedSearch, skip],
    queryFn: () => adminConsumersApi.list({ search: debouncedSearch || undefined, skip, limit: LIMIT }).then(r => r.data),
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Consumers</h1>
        <p className="text-sm text-gray-400">Read-only view — search and monitor consumer accounts</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['Name', 'Email / Mobile', 'District', 'Aadhaar', 'Flags', 'Last Login', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {isLoading && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading…</td></tr>}
              {!isLoading && (data?.consumers ?? []).length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No consumers found.</td></tr>}
              {(data?.consumers ?? []).map(c => (
                <tr key={c.user_id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition">
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{c.full_name}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-600 dark:text-gray-300 text-xs">{c.email}</p>
                    <p className="text-gray-400 text-xs">{c.mobile_number ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.district ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.aadhaar_masked ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.is_teetotaler && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-full">
                          <Shield className="w-2.5 h-2.5" /> Teetotaler
                        </span>
                      )}
                      {c.is_self_restricted && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded-full">
                          <ShieldOff className="w-2.5 h-2.5" /> Restricted
                        </span>
                      )}
                      {!c.is_teetotaler && !c.is_self_restricted && <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{c.last_login_at ? new Date(c.last_login_at).toLocaleDateString() : 'Never'}</td>
                  <td className="px-4 py-3">
                    {c.is_active
                      ? <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Active</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400"><UserX className="w-3 h-3" /> Deactivated</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-400">
          <span>{data?.total ?? 0} consumers</span>
          <div className="flex gap-2">
            <button disabled={skip === 0} onClick={() => setSkip(s => Math.max(0, s - LIMIT))} className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 disabled:opacity-40">← Prev</button>
            <button disabled={(skip + LIMIT) >= (data?.total ?? 0)} onClick={() => setSkip(s => s + LIMIT)} className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 disabled:opacity-40">Next →</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConsumersPage
