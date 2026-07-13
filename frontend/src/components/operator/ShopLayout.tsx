/**
 * ShopLayout — Shell for all operator portal pages.
 * Supports BOTH light and dark mode via Tailwind dark: classes.
 * Red accent theme. Minimal sidebar, optimised for desktop POS use.
 */
import React, { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ScanLine, History,
  LogOut, Store, Sun, Moon, Menu, X, AlertTriangle,
} from 'lucide-react'
import { useOperatorAuthStore } from '../../store/operatorAuthStore'
import { operatorAuthApi } from '../../api/operator.api'
import { useTheme } from '../../hooks/useTheme'

const NAV_ITEMS = [
  { to: '/shop', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/shop/scan', label: 'Scan & Sell', icon: ScanLine },
  { to: '/shop/history', label: 'History', icon: History },
]

const ShopLayout: React.FC = () => {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { shop, pinWarning, logout } = useOperatorAuthStore()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    try { await operatorAuthApi.logout() } catch { /* ignore */ }
    logout()
    navigate('/portal/login?tab=operator', { replace: true })
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="
        px-4 py-5
        border-b border-gray-200 dark:border-gray-800
        bg-white dark:bg-gray-900
      ">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center flex-shrink-0">
            <Store className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-gray-900 dark:text-white leading-tight truncate">
              {shop?.name ?? 'Shop Portal'}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
              {shop?.shop_code}
            </p>
          </div>
        </div>
      </div>

      {/* PIN rotation warning */}
      {pinWarning && (
        <div className="mx-3 mt-3 flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">{pinWarning}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-red-600 text-white shadow-sm shadow-red-600/30'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-gray-800 hover:text-red-700 dark:hover:text-white'
              }`
            }
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-3 space-y-1">
        <div className="px-2 py-2 mb-1">
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            {shop?.district} · {shop?.address?.slice(0, 30)}
          </p>
        </div>

        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex transition-colors duration-200">

      {/* Desktop sidebar */}
      <aside className="
        hidden lg:flex flex-col flex-shrink-0 w-56
        border-r border-gray-200 dark:border-gray-800
        bg-white dark:bg-gray-900
        transition-colors duration-200
      ">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 w-64 bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Mobile topbar */}
        <header className="
          lg:hidden flex items-center justify-between px-4 py-3
          bg-white dark:bg-gray-900
          border-b border-gray-200 dark:border-gray-800
          transition-colors duration-200
        ">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-red-500" />
            <span className="font-bold text-gray-900 dark:text-white text-sm">
              {shop?.shop_code ?? 'Shop Portal'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default ShopLayout
