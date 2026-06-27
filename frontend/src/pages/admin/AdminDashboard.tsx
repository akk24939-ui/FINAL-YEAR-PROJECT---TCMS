import React from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useThemeStore } from '../../store/themeStore'
import { Building2, TrendingUp, ShoppingBag, Users } from 'lucide-react'

const districts = [
  { name: 'Chennai', shops: 310, revenue: 2450000, consumers: 12500 },
  { name: 'Coimbatore', shops: 285, revenue: 1980000, consumers: 9800 },
  { name: 'Madurai', shops: 245, revenue: 1750000, consumers: 8600 },
  { name: 'Tiruchirappalli', shops: 210, revenue: 1480000, consumers: 7200 },
  { name: 'Salem', shops: 195, revenue: 1320000, consumers: 6500 },
  { name: 'Tirunelveli', shops: 180, revenue: 1210000, consumers: 5900 },
  { name: 'Tiruppur', shops: 175, revenue: 1180000, consumers: 5700 },
  { name: 'Erode', shops: 165, revenue: 1090000, consumers: 5200 },
]

const COLORS = ['#1A3C34', '#2D6A4F', '#F97316', '#D4AF37', '#3B82F6', '#8B5CF6', '#EF4444', '#10B981']

const AdminDashboard: React.FC = () => {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const bg = isDark ? '#0D1F1A' : '#F0FDF4'
  const cardBg = isDark ? 'rgba(26,60,52,0.4)' : 'white'
  const border = isDark ? 'rgba(212,175,55,0.15)' : 'rgba(26,60,52,0.1)'
  const textMain = isDark ? '#F0FDF4' : '#1A1A1A'
  const textSub = isDark ? '#9CA3AF' : '#6B7280'

  const summaryStats = [
    { label: 'Total Outlets', value: '6,860+', icon: <Building2 className="w-6 h-6" />, color: '#1A3C34' },
    { label: 'Districts', value: '38', icon: <ShoppingBag className="w-6 h-6" />, color: '#F97316' },
    { label: "Today's Revenue", value: '₹45.2L', icon: <TrendingUp className="w-6 h-6" />, color: '#22C55E' },
    { label: 'Registered Consumers', value: '1,24,500', icon: <Users className="w-6 h-6" />, color: '#3B82F6' },
  ]

  return (
    <div className="min-h-screen" style={{ background: bg }}>
      <div className="px-6 py-8 border-b" style={{ borderColor: border, background: isDark ? '#0D2B22' : '#fff' }}>
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold" style={{ color: textMain }}>Government Admin Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: textSub }}>Tamil Nadu — District-wise Analytics & Revenue Reports</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryStats.map((s, i) => (
            <div key={i} className="rounded-2xl p-6 border" style={{ background: cardBg, borderColor: border }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${s.color}20`, color: s.color }}>
                {s.icon}
              </div>
              <p className="text-2xl font-black mb-1" style={{ color: textMain }}>{s.value}</p>
              <p className="text-xs" style={{ color: textSub }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl p-6 border" style={{ background: cardBg, borderColor: border }}>
            <h2 className="font-bold mb-6" style={{ color: textMain }}>Revenue by District (Top 8)</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={districts}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#F3F4F6'} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: textSub }} />
                <YAxis tick={{ fontSize: 10, fill: textSub }} />
                <Tooltip contentStyle={{ background: isDark ? '#1A3C34' : '#fff', borderRadius: '12px', color: textMain, border: 'none' }} />
                <Bar dataKey="revenue" fill="#1A3C34" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-2xl p-6 border" style={{ background: cardBg, borderColor: border }}>
            <h2 className="font-bold mb-6" style={{ color: textMain }}>Shop Distribution</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={districts} dataKey="shops" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {districts.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: isDark ? '#1A3C34' : '#fff', borderRadius: '12px', color: textMain, border: 'none' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* District Table */}
        <div className="rounded-2xl border overflow-hidden" style={{ background: cardBg, borderColor: border }}>
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: border }}>
            <h2 className="font-bold" style={{ color: textMain }}>District-wise Statistics (Showing 8 of 38)</h2>
            <button className="text-xs font-semibold px-4 py-2 rounded-lg text-white" style={{ background: '#1A3C34' }}>
              Export PDF
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: isDark ? 'rgba(26,60,52,0.3)' : '#F9FAFB' }}>
                  {['District', 'Shops', 'Consumers', 'Revenue', 'Status'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: textSub }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {districts.map((d, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: border }}>
                    <td className="px-6 py-4 font-medium" style={{ color: textMain }}>{d.name}</td>
                    <td className="px-6 py-4" style={{ color: textSub }}>{d.shops}</td>
                    <td className="px-6 py-4" style={{ color: textSub }}>{d.consumers.toLocaleString()}</td>
                    <td className="px-6 py-4 font-semibold" style={{ color: '#F97316' }}>₹{(d.revenue / 100000).toFixed(1)}L</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold" style={{ background: '#22C55E20', color: '#22C55E' }}>Active</span>
                    </td>
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

export default AdminDashboard
