/**
 * AdminLayout — shell for all admin portal pages.
 *
 * Collapsible left sidebar with navy blue theme (distinct from consumer green).
 * Light + Dark mode with toggle. Session-aware: shows admin name + last login.
 */
import React, { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Store, Stethoscope, Users, Settings2,
  ScrollText, FileBarChart2, ChevronLeft, ChevronRight,
  LogOut, Sun, Moon, Shield, Menu, X,
} from 'lucide-react'
import { useAdminAuthStore } from '../../store/adminAuthStore'
import { adminAuthApi } from '../../api/admin.api'
import { useTheme } from '../../hooks/useTheme'

const NAV_ITEMS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/shops', label: 'Shops', icon: Store },
  { to: '/admin/doctors', label: 'Doctors', icon: Stethoscope },
  { to: '/admin/consumers', label: 'Consumers', icon: Users },
  { to: '/admin/limits', label: 'Global Limits', icon: Settings2 },
  { to: '/admin/audit', label: 'Audit Log', icon: ScrollText },
  { to: '/admin/reports', label: 'Reports', icon: FileBarChart2 },
]

const AdminLayout: React.FC = () => {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { admin, logout } = useAdminAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = async () => {
    try { await adminAuthApi.logout() } catch { /* ignore */ }
    logout()
    navigate('/portal/login', { replace: true })
  }

  const initials = admin?.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) ?? 'GA'

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-200 dark:border-gray-800 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-xs font-black text-gray-900 dark:text-white leading-tight">Admin Portal</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">TASMAC Regulation</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-gray-800 hover:text-blue-700 dark:hover:text-white'
              } ${collapsed ? 'justify-center' : ''}`
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: admin info + actions */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-3 space-y-1">
        {/* Admin avatar */}
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{admin?.full_name}</p>
              <p className="text-[10px] text-gray-400 truncate">{admin?.email}</p>
            </div>
          </div>
        )}

        <button
          onClick={toggleTheme}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition ${collapsed ? 'justify-center' : ''}`}
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {!collapsed && (theme === 'dark' ? 'Light Mode' : 'Dark Mode')}
        </button>

        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition ${collapsed ? 'justify-center' : ''}`}
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && 'Sign Out'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {sidebarContent}
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute left-full top-1/2 -translate-y-1/2 w-5 h-10 bg-white dark:bg-gray-900 border border-l-0 border-gray-200 dark:border-gray-800 rounded-r-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition z-10"
          style={{ left: collapsed ? '4rem' : '15rem' }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 w-64 bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-gray-900 dark:text-white text-sm">Admin Portal</span>
          </div>
          <button onClick={() => setMobileOpen(o => !o)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-5 lg:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
