/**
 * ShopDashboard — Today's stats, revenue, and recent transactions.
 */
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShoppingCart, IndianRupee, ScanLine, AlertTriangle, TrendingUp } from 'lucide-react'
import { operatorDashboardApi } from '../../api/operator.api'
import { useNavigate } from 'react-router-dom'

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; accent: string }> = ({ label, value, icon, accent }) => (
  <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl ${accent} flex items-center justify-center flex-shrink-0`}>{icon}</div>
    <div>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  </div>
)

const ShopDashboard: React.FC = () => {
  const navigate = useNavigate()
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['operator-dashboard'],
    queryFn: () => operatorDashboardApi.get().then(r => r.data),
    refetchInterval: 30_000,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-white">{data?.shop.name}</h1>
          <p className="text-sm text-gray-500 mt-1 font-mono">{data?.shop.shop_code} · {data?.shop.district}</p>
        </div>
        <button
          onClick={() => navigate('/shop/scan')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition"
        >
          <ScanLine className="w-4 h-4" /> Scan & Sell
        </button>
      </div>

      {/* PIN warning */}
      {data?.pin_rotation_warning && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-300">{data.pin_rotation_warning}</p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Today's Transactions"
          value={data?.today_purchases_count ?? 0}
          icon={<ShoppingCart className="w-6 h-6 text-red-400" />}
          accent="bg-red-500/10"
        />
        <StatCard
          label="Today's Revenue"
          value={`₹${(data?.today_revenue ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
          icon={<IndianRupee className="w-6 h-6 text-emerald-400" />}
          accent="bg-emerald-500/10"
        />
      </div>

      {/* Recent transactions */}
      <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
          <TrendingUp className="w-4 h-4 text-red-500" />
          <h2 className="font-bold text-white text-sm">Recent Transactions</h2>
          <button onClick={() => refetch()} className="ml-auto text-xs text-gray-500 hover:text-gray-300">Refresh</button>
        </div>

        {(data?.recent_transactions ?? []).length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="w-8 h-8 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No transactions today yet.</p>
            <button onClick={() => navigate('/shop/scan')} className="mt-4 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition">
              Start First Sale
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {(data?.recent_transactions ?? []).map(tx => (
              <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-800/30 transition">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{tx.product_name}</p>
                  <p className="text-xs text-gray-500">{tx.quantity_ml}ml · {tx.standard_drinks?.toFixed(1)} SD</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-white">₹{tx.price.toFixed(2)}</p>
                  <p className="text-xs text-gray-600">
                    {new Date(tx.purchased_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {tx.remaining_daily_limit !== null && tx.remaining_daily_limit < 1 && (
                  <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">LIMIT</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ShopDashboard
