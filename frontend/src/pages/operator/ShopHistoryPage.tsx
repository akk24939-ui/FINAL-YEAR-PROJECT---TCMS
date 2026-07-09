/**
 * ShopHistoryPage — Paginated shop transaction history with date filter.
 */
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, IndianRupee, Calendar } from 'lucide-react'
import { operatorPurchaseApi } from '../../api/operator.api'

const ShopHistoryPage: React.FC = () => {
  const [skip, setSkip] = useState(0)
  const [dateFilter, setDateFilter] = useState('')
  const LIMIT = 50

  const { data, isLoading } = useQuery({
    queryKey: ['operator-history', skip, dateFilter],
    queryFn: () => operatorPurchaseApi.history({
      skip,
      limit: LIMIT,
      date_filter: dateFilter || undefined,
    }).then(r => r.data),
  })

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Transaction History</h1>
          <p className="text-sm text-gray-500">All sales recorded at this shop</p>
        </div>

        {/* Date filter */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <input
            type="date"
            value={dateFilter}
            onChange={e => { setDateFilter(e.target.value); setSkip(0) }}
            className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          {dateFilter && (
            <button onClick={() => { setDateFilter(''); setSkip(0) }} className="text-xs text-gray-500 hover:text-white px-2 py-1 rounded-lg hover:bg-gray-800 transition">Clear</button>
          )}
        </div>
      </div>

      {/* Summary row */}
      {data && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
            <History className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-xs text-gray-500">Total Transactions</p>
              <p className="text-xl font-black text-white">{data.total.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-3">
            <IndianRupee className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-xs text-gray-500">Total Revenue</p>
              <p className="text-xl font-black text-white">₹{data.total_revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Time', 'Product', 'Volume', 'Std. Drinks', 'Price', 'Rem. Limit'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {isLoading && (
                <tr><td colSpan={6} className="text-center py-10">
                  <div className="w-6 h-6 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
                </td></tr>
              )}
              {!isLoading && (data?.purchases ?? []).length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-gray-600">No transactions found.</td></tr>
              )}
              {(data?.purchases ?? []).map(tx => {
                const atLimit = tx.remaining_daily_limit !== null && tx.remaining_daily_limit < 0.5
                return (
                  <tr key={tx.id} className="hover:bg-gray-800/30 transition">
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatTime(tx.purchased_at)}</td>
                    <td className="px-4 py-3 font-semibold text-white">{tx.product_name}</td>
                    <td className="px-4 py-3 text-gray-400">{tx.quantity_ml}ml</td>
                    <td className="px-4 py-3 text-gray-400">{tx.standard_drinks?.toFixed(2) ?? '—'}</td>
                    <td className="px-4 py-3 font-bold text-white">₹{tx.price.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {atLimit
                        ? <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">Limit reached</span>
                        : <span className="text-xs text-gray-400">{tx.remaining_daily_limit?.toFixed(1) ?? '—'} SD</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
          <span>Page {Math.floor(skip / LIMIT) + 1} of {Math.ceil((data?.total ?? 0) / LIMIT) || 1}</span>
          <div className="flex gap-2">
            <button disabled={skip === 0} onClick={() => setSkip(s => Math.max(0, s - LIMIT))} className="px-3 py-1 rounded-lg bg-gray-800 disabled:opacity-40 text-gray-300 hover:bg-gray-700 transition">← Prev</button>
            <button disabled={(skip + LIMIT) >= (data?.total ?? 0)} onClick={() => setSkip(s => s + LIMIT)} className="px-3 py-1 rounded-lg bg-gray-800 disabled:opacity-40 text-gray-300 hover:bg-gray-700 transition">Next →</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ShopHistoryPage
