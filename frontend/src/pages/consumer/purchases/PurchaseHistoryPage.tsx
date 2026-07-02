import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShoppingBag, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { consumerApi } from '../../../api/consumer.api'
import { useThemeStore } from '../../../store/themeStore'

const PurchaseHistoryPage: React.FC = () => {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const [skip, setSkip] = useState(0)
  const [search, setSearch] = useState('')
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', skip, search],
    queryFn: () => consumerApi.getPurchases({ skip, limit, product_name: search || undefined }).then(r => r.data),
  })

  const textMain = isDark ? '#F0FDF4' : '#1A3C34'
  const textSub = isDark ? '#9CA3AF' : '#6B7280'
  const cardBg = isDark ? 'rgba(26,60,52,0.4)' : 'white'
  const borderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,60,52,0.1)'

  const totalPages = data ? Math.ceil(data.total / limit) : 0
  const currentPage = Math.floor(skip / limit) + 1

  return (
    <div className="min-h-screen p-6" style={{ background: isDark ? '#0D1F1A' : '#F8FAFC' }}>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2" style={{ color: textMain }}>Purchase History</h1>
        <p className="text-sm mb-6" style={{ color: textSub }}>Your complete purchase record</p>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textSub }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setSkip(0) }}
            placeholder="Search by product name..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border text-sm outline-none"
            style={{ background: cardBg, borderColor, color: textMain }}
          />
        </div>

        {/* Table */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor, background: cardBg }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${borderColor}`, background: isDark ? 'rgba(0,0,0,0.2)' : '#F9FAFB' }}>
                {['Date', 'Product', 'Volume (ml)', 'Price (₹)'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                    style={{ color: textSub }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={4} className="text-center py-12" style={{ color: textSub }}>
                  <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading...
                </td></tr>
              )}
              {!isLoading && data?.items.length === 0 && (
                <tr><td colSpan={4} className="text-center py-16" style={{ color: textSub }}>
                  <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No purchases found</p>
                </td></tr>
              )}
              {data?.items.map((p, i) => (
                <tr key={p.id} style={{
                  borderBottom: i < data.items.length - 1 ? `1px solid ${borderColor}` : 'none'
                }} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3" style={{ color: textSub }}>
                    {new Date(p.purchased_at).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: textMain }}>{p.product_name}</td>
                  <td className="px-4 py-3" style={{ color: textSub }}>{p.quantity_ml}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: '#F97316' }}>
                    ₹{p.price.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm" style={{ color: textSub }}>
              Page {currentPage} of {totalPages} · {data?.total} total
            </p>
            <div className="flex gap-2">
              <button onClick={() => setSkip(Math.max(0, skip - limit))} disabled={skip === 0}
                className="p-2 rounded-lg border disabled:opacity-40 transition-all"
                style={{ borderColor, color: textMain }}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setSkip(skip + limit)} disabled={currentPage >= totalPages}
                className="p-2 rounded-lg border disabled:opacity-40 transition-all"
                style={{ borderColor, color: textMain }}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PurchaseHistoryPage
