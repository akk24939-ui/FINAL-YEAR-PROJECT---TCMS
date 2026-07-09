/**
 * ReportsPage — District stats table and system summary.
 */
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileBarChart2, TrendingUp, Store, ShoppingCart, DollarSign } from 'lucide-react'
import { adminReportsApi } from '../../api/admin.api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const ReportsPage: React.FC = () => {
  const { data: districtData, isLoading: dLoading } = useQuery({
    queryKey: ['admin-report-districts'],
    queryFn: () => adminReportsApi.districtStats().then(r => r.data),
  })

  const { data: summary } = useQuery({
    queryKey: ['admin-report-summary'],
    queryFn: () => adminReportsApi.summary().then(r => r.data),
  })

  const chartData = (districtData?.districts ?? [])
    .filter(d => d.total_purchases > 0)
    .sort((a, b) => b.total_purchases - a.total_purchases)
    .slice(0, 15)

  const SummaryCard = ({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) => (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 flex items-center gap-4`}>
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-xl font-black text-gray-900 dark:text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Reports</h1>
        <p className="text-sm text-gray-400">System-wide statistics and district analysis</p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <SummaryCard icon={<Store className="w-5 h-5 text-blue-600" />} label="Active Shops" value={summary.total_active_shops} color="bg-blue-50 dark:bg-blue-900/20" />
          <SummaryCard icon={<TrendingUp className="w-5 h-5 text-emerald-600" />} label="Total Consumers" value={summary.total_consumers} color="bg-emerald-50 dark:bg-emerald-900/20" />
          <SummaryCard icon={<ShoppingCart className="w-5 h-5 text-amber-600" />} label="Total Purchases" value={summary.total_purchases} color="bg-amber-50 dark:bg-amber-900/20" />
          <SummaryCard icon={<DollarSign className="w-5 h-5 text-purple-600" />} label="Total Revenue (₹)" value={`₹${summary.total_revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} color="bg-purple-50 dark:bg-purple-900/20" />
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-5">
            <FileBarChart2 className="w-4 h-4 text-blue-600" />
            <h2 className="font-bold text-gray-900 dark:text-white text-sm">Purchases by District (Top 15)</h2>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
              <XAxis dataKey="district" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-40} textAnchor="end" />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 12, color: '#f9fafb', fontSize: 12 }}
                cursor={{ fill: 'rgba(59,130,246,0.08)' }}
              />
              <Bar dataKey="total_purchases" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Purchases" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* District table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-bold text-gray-900 dark:text-white text-sm">District Statistics</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['District', 'Code', 'Active Shops', 'Total Purchases', 'Total Revenue'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {dLoading && <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading…</td></tr>}
              {(districtData?.districts ?? []).map(d => (
                <tr key={d.district} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition">
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{d.district}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{d.code}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{d.shop_count}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{d.total_purchases.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">₹{d.total_revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
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
