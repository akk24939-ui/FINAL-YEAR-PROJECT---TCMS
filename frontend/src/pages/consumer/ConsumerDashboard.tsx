import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ShoppingBag, TrendingUp, AlertTriangle, CheckCircle, QrCode, Settings, FileText, ToggleLeft, ToggleRight } from 'lucide-react'
import { useThemeStore } from '../../store/themeStore'
import { useAuthStore } from '../../store/authStore'

// Mock data
const mockChartData = Array.from({ length: 30 }, (_, i) => ({
  day: `Jun ${i + 1}`,
  ml: Math.floor(Math.random() * 600 + 100),
  limit: 750,
}))

const mockPurchases = [
  { id: '1', product: 'McDowell No.1 Whisky 750ml', shop: 'TASMAC Chennai-01', date: '2025-06-27', amount: '₹680', ml: 750 },
  { id: '2', product: 'Kingfisher Strong Beer 650ml', shop: 'TASMAC Adyar-02', date: '2025-06-25', amount: '₹85', ml: 650 },
  { id: '3', product: 'Old Monk Rum 750ml', shop: 'TASMAC Guindy-03', date: '2025-06-23', amount: '₹520', ml: 750 },
  { id: '4', product: 'Royal Stag 750ml', shop: 'TASMAC Chennai-01', date: '2025-06-20', amount: '₹720', ml: 750 },
  { id: '5', product: 'Haywards 5000 650ml', shop: 'TASMAC Adyar-02', date: '2025-06-18', amount: '₹80', ml: 650 },
]

const ConsumerDashboard: React.FC = () => {
  const { theme } = useThemeStore()
  const { user } = useAuthStore()
  const isDark = theme === 'dark'
  const [teetotaler, setTeetotaler] = React.useState(false)

  const bg = isDark ? '#0D1F1A' : '#F0FDF4'
  const cardBg = isDark ? 'rgba(26,60,52,0.4)' : 'white'
  const border = isDark ? 'rgba(212,175,55,0.15)' : 'rgba(26,60,52,0.1)'
  const textMain = isDark ? '#F0FDF4' : '#1A1A1A'
  const textSub = isDark ? '#9CA3AF' : '#6B7280'

  const stats = [
    { label: "Today's Consumption", value: '450ml', limit: '750ml', pct: 60, status: 'warning', icon: <ShoppingBag className="w-6 h-6" /> },
    { label: 'This Week', value: '1,800ml', limit: '3,000ml', pct: 60, status: 'safe', icon: <TrendingUp className="w-6 h-6" /> },
    { label: 'This Month', value: '6,200ml', limit: '10,000ml', pct: 62, status: 'safe', icon: <CheckCircle className="w-6 h-6" /> },
    { label: 'Limit Status', value: 'Warning', limit: '', pct: 60, status: 'warning', icon: <AlertTriangle className="w-6 h-6" /> },
  ]

  const statusColor = (s: string) => s === 'exceeded' ? '#EF4444' : s === 'warning' ? '#F97316' : '#22C55E'

  return (
    <div className="min-h-screen" style={{ background: bg }}>
      {/* Header */}
      <div className="px-6 py-8 border-b" style={{ borderColor: border, background: isDark ? '#0D2B22' : '#fff' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: textMain }}>
              Welcome, {user?.full_name || 'Consumer'} 👋
            </h1>
            <p className="text-sm mt-1" style={{ color: textSub }}>
              Smart TASMAC — Consumer Dashboard | {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all hover:border-orange-400`}
              style={{ borderColor: border, color: textSub }}>
              <QrCode className="w-4 h-4" /> View QR
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #1A3C34, #2D6A4F)' }}>
              <Settings className="w-4 h-4" /> Set Limits
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => (
            <div key={i} className="rounded-2xl p-6 border" style={{ background: cardBg, borderColor: border }}>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${statusColor(s.status)}20`, color: statusColor(s.status) }}>
                  {s.icon}
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full"
                  style={{ background: `${statusColor(s.status)}20`, color: statusColor(s.status) }}>
                  {s.status.toUpperCase()}
                </span>
              </div>
              <p className="text-2xl font-black mb-1" style={{ color: textMain }}>{s.value}</p>
              <p className="text-xs mb-3" style={{ color: textSub }}>{s.label}{s.limit && ` / ${s.limit}`}</p>
              {s.limit && (
                <div className="h-2 rounded-full" style={{ background: isDark ? '#374151' : '#E5E7EB' }}>
                  <div className="h-2 rounded-full transition-all"
                    style={{ width: `${s.pct}%`, background: statusColor(s.status) }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Teetotaler + Actions */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl p-6 border flex items-center justify-between" style={{ background: cardBg, borderColor: border }}>
            <div>
              <p className="font-bold" style={{ color: textMain }}>Teetotaler Mode</p>
              <p className="text-xs" style={{ color: textSub }}>Block all purchases</p>
            </div>
            <button onClick={() => setTeetotaler(!teetotaler)} aria-label="Toggle teetotaler mode">
              {teetotaler
                ? <ToggleRight className="w-10 h-10" style={{ color: '#1A3C34' }} />
                : <ToggleLeft className="w-10 h-10" style={{ color: '#6B7280' }} />
              }
            </button>
          </div>
          {[
            { icon: <FileText className="w-5 h-5" />, label: 'Download PDF', sub: 'Purchase history' },
            { icon: <QrCode className="w-5 h-5" />, label: 'My QR Code', sub: 'For shop scanning' },
          ].map((a, i) => (
            <button key={i} className="rounded-2xl p-6 border text-left card-hover" style={{ background: cardBg, borderColor: border }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: 'rgba(249,115,22,0.1)', color: '#F97316' }}>
                {a.icon}
              </div>
              <p className="font-bold" style={{ color: textMain }}>{a.label}</p>
              <p className="text-xs" style={{ color: textSub }}>{a.sub}</p>
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="rounded-2xl p-6 border" style={{ background: cardBg, borderColor: border }}>
          <h2 className="font-bold text-lg mb-6" style={{ color: textMain }}>30-Day Consumption Trend</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={mockChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#F3F4F6'} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: textSub }} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: textSub }} />
              <Tooltip contentStyle={{ background: isDark ? '#1A3C34' : '#fff', border: 'none', borderRadius: '12px', color: textMain }} />
              <Line type="monotone" dataKey="ml" stroke="#F97316" strokeWidth={2} dot={false} name="Consumed (ml)" />
              <Line type="monotone" dataKey="limit" stroke="#1A3C34" strokeWidth={1.5} dot={false} strokeDasharray="5 5" name="Daily Limit" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Purchases */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: cardBg, borderColor: border }}>
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: border }}>
            <h2 className="font-bold" style={{ color: textMain }}>Recent Purchases</h2>
            <button className="text-xs font-semibold" style={{ color: '#F97316' }}>View All →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: isDark ? 'rgba(26,60,52,0.3)' : '#F9FAFB' }}>
                  {['Product', 'Shop', 'Date', 'Amount', 'Volume'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: textSub }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockPurchases.map((p) => (
                  <tr key={p.id} className="border-t" style={{ borderColor: border }}>
                    <td className="px-6 py-4 font-medium" style={{ color: textMain }}>{p.product}</td>
                    <td className="px-6 py-4" style={{ color: textSub }}>{p.shop}</td>
                    <td className="px-6 py-4" style={{ color: textSub }}>{p.date}</td>
                    <td className="px-6 py-4 font-semibold" style={{ color: '#F97316' }}>{p.amount}</td>
                    <td className="px-6 py-4" style={{ color: textSub }}>{p.ml}ml</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ConsumerDashboard
