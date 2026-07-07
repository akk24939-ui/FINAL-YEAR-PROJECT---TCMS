/**
 * ConsumerLayout.tsx
 *
 * Full shell layout for all Consumer module inner pages.
 * Includes:
 *  - Sticky header with logo, theme toggle, notifications bell, user dropdown
 *  - Left sidebar (240px desktop / 64px icon-only tablet / hidden mobile)
 *  - Bottom navigation bar (mobile only, 5 primary links)
 *  - Main content area with max-w-7xl centering
 *
 * Dark/Light mode: all Tailwind dark: variants, driven by <html class="dark">
 */
import React, { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  User,
  Sliders,
  ShoppingCart,
  ShieldOff,
  Bell,
  QrCode,
  FileDown,
  LogOut,
  Sun,
  Moon,
  ChevronDown,
  Menu,
  X,
  AlertCircle,
} from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useAuthStore } from '../../store/authStore'

// ── Navigation items ────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/consumer',           label: 'Dashboard',        icon: LayoutDashboard, end: true },
  { to: '/consumer/profile',   label: 'Profile',          icon: User },
  { to: '/consumer/limits',    label: 'My Limits',        icon: Sliders },
  { to: '/consumer/purchases', label: 'Purchase History', icon: ShoppingCart },
  { to: '/consumer/restrictions', label: 'Restrictions',  icon: ShieldOff },
  { to: '/consumer/notifications', label: 'Notifications',icon: Bell },
  { to: '/consumer/qr',        label: 'QR Code',          icon: QrCode },
  { to: '/consumer/report',    label: 'Download Report',  icon: FileDown },
]

// Bottom nav shows 5 primary links on mobile
const BOTTOM_NAV = [
  { to: '/consumer',           label: 'Home',    icon: LayoutDashboard, end: true },
  { to: '/consumer/limits',    label: 'Limits',  icon: Sliders },
  { to: '/consumer/purchases', label: 'History', icon: ShoppingCart },
  { to: '/consumer/qr',        label: 'QR Code', icon: QrCode },
  { to: '/consumer/profile',   label: 'Profile', icon: User },
]

// ── Sidebar nav link ─────────────────────────────────────────────────────────
interface NavItemProps {
  to: string
  label: string
  icon: React.ElementType
  collapsed: boolean
  end?: boolean
  onClick?: () => void
}

const SideNavItem: React.FC<NavItemProps> = ({ to, label, icon: Icon, collapsed, end, onClick }) => (
  <NavLink
    to={to}
    end={end}
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={({ isActive }) =>
      `group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 select-none
       ${isActive
         ? 'bg-blue-50 text-blue-700 border-r-4 border-blue-600 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-500'
         : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
       }
       ${collapsed ? 'justify-center px-2' : ''}
      `
    }
  >
    <Icon className="w-5 h-5 flex-shrink-0" />
    {!collapsed && <span className="truncate">{label}</span>}
    {/* Tooltip when collapsed */}
    {collapsed && (
      <span className="
        absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 dark:bg-gray-700
        text-white text-xs rounded-lg whitespace-nowrap
        opacity-0 group-hover:opacity-100 pointer-events-none
        transition-opacity duration-150 z-50 shadow-lg
      ">
        {label}
      </span>
    )}
  </NavLink>
)

// ── Notification bell (placeholder count — will be wired to API in Step 10) ──
const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const unreadCount = 3 // mock — Step 10 will connect real API

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        id="notification-bell-btn"
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="
          absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-2xl
          border border-gray-200 dark:border-gray-700 shadow-xl z-50 overflow-hidden
        ">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Notifications</h3>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{unreadCount} unread</span>
          </div>
          {/* Mock notifications - Step 10 replaces with real data */}
          {[
            { icon: '⚠️', msg: "You've used 75% of today's limit.", time: '2h ago', type: 'warn' },
            { icon: '🚨', msg: 'Daily limit exceeded. Purchases blocked.', time: 'Yesterday', type: 'danger' },
            { icon: 'ℹ️', msg: 'Your self-restriction expires in 3 days.', time: '3 days ago', type: 'info' },
          ].map((n, i) => (
            <div key={i} className={`
              px-4 py-3 flex gap-3 border-b border-gray-50 dark:border-gray-800
              hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer transition-colors
              ${i === 0 ? 'border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : ''}
            `}>
              <span className="text-lg flex-shrink-0">{n.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs leading-relaxed ${i < 2 ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>
                  {n.msg}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{n.time}</p>
              </div>
            </div>
          ))}
          <NavLink
            to="/consumer/notifications"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-center text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            View all notifications →
          </NavLink>
        </div>
      )}
    </div>
  )
}

// ── User dropdown ─────────────────────────────────────────────────────────────
const UserDropdown: React.FC = () => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const initials = (user?.full_name ?? 'CU')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="relative" ref={ref}>
      <button
        id="user-dropdown-btn"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {initials}
        </div>
        <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
          {user?.full_name ?? 'Consumer'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="
          absolute right-0 mt-2 w-52 bg-white dark:bg-gray-900 rounded-2xl
          border border-gray-200 dark:border-gray-700 shadow-xl z-50 overflow-hidden
        ">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {user?.full_name ?? 'Consumer'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {user?.email ?? 'Consumer Account'}
            </p>
          </div>
          <NavLink
            to="/consumer/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <User className="w-4 h-4" /> My Profile
          </NavLink>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main layout ───────────────────────────────────────────────────────────────
const ConsumerLayout: React.FC = () => {
  const { theme, toggleTheme } = useTheme()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const isDark = theme === 'dark'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300 flex flex-col">

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header className="
        fixed top-0 left-0 right-0 z-40 h-16
        bg-white dark:bg-gray-900
        border-b border-gray-200 dark:border-gray-800
        flex items-center
        transition-colors duration-300
      ">
        <div className="flex items-center w-full px-4 gap-4">
          {/* Mobile hamburger */}
          <button
            id="mobile-sidebar-toggle"
            className="lg:hidden p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setMobileSidebarOpen(o => !o)}
            aria-label="Toggle sidebar"
          >
            {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Desktop sidebar collapse toggle */}
          <button
            id="sidebar-collapse-toggle"
            className="hidden lg:flex p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={() => setSidebarCollapsed(c => !c)}
            aria-label="Collapse sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Logo + Brand */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-none">TASMAC</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-none mt-0.5">Consumer Portal</p>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Theme toggle */}
            <button
              id="theme-toggle-btn"
              onClick={toggleTheme}
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark
                ? <Sun className="w-5 h-5 text-amber-400" />
                : <Moon className="w-5 h-5" />
              }
            </button>

            <NotificationBell />
            <UserDropdown />
          </div>
        </div>
      </header>

      {/* ── BODY (sidebar + content) ────────────────────────────────────────── */}
      <div className="flex flex-1 pt-16">

        {/* ── SIDEBAR (desktop) ─────────────────────────────────────────────── */}
        <aside className={`
          hidden lg:flex flex-col fixed left-0 top-16 bottom-0 z-30
          bg-white dark:bg-gray-900
          border-r border-gray-200 dark:border-gray-800
          transition-all duration-300
          ${sidebarCollapsed ? 'w-16' : 'w-60'}
          overflow-y-auto overflow-x-hidden
        `}>
          <nav className="flex-1 px-2 py-4 space-y-0.5">
            {NAV_ITEMS.map(item => (
              <SideNavItem
                key={item.to}
                {...item}
                collapsed={sidebarCollapsed}
              />
            ))}
          </nav>

          {/* Logout at bottom */}
          <div className="px-2 py-4 border-t border-gray-100 dark:border-gray-800">
            <button
              id="sidebar-logout-btn"
              onClick={async () => {
                const { logout } = useAuthStore.getState()
                await logout()
                window.location.href = '/login'
              }}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                text-red-600 dark:text-red-400
                hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200
                ${sidebarCollapsed ? 'justify-center px-2' : ''}
              `}
              title={sidebarCollapsed ? 'Sign Out' : undefined}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* ── MOBILE SIDEBAR OVERLAY ─────────────────────────────────────────── */}
        {mobileSidebarOpen && (
          <>
            {/* Backdrop */}
            <div
              className="lg:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            {/* Drawer */}
            <aside className="
              lg:hidden fixed left-0 top-16 bottom-0 z-40 w-64
              bg-white dark:bg-gray-900
              border-r border-gray-200 dark:border-gray-800
              flex flex-col overflow-y-auto
              animate-slide-in-left
            ">
              <nav className="flex-1 px-2 py-4 space-y-0.5">
                {NAV_ITEMS.map(item => (
                  <SideNavItem
                    key={item.to}
                    {...item}
                    collapsed={false}
                    onClick={() => setMobileSidebarOpen(false)}
                  />
                ))}
              </nav>
              <div className="px-2 py-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={async () => {
                    setMobileSidebarOpen(false)
                    const { logout } = useAuthStore.getState()
                    await logout()
                    window.location.href = '/login'
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                >
                  <LogOut className="w-5 h-5" /> Sign Out
                </button>
              </div>
            </aside>
          </>
        )}

        {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
        <main className={`
          flex-1 min-h-0
          transition-all duration-300
          ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-60'}
          pb-16 lg:pb-0
        `}>
          <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
            {/* Render nested routes here */}
            <Outlet />
          </div>
        </main>
      </div>

      {/* ── BOTTOM NAV (mobile only) ────────────────────────────────────────── */}
      <nav className="
        lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16
        bg-white dark:bg-gray-900
        border-t border-gray-200 dark:border-gray-800
        flex items-stretch
        transition-colors duration-300
      ">
        {BOTTOM_NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors
               ${isActive
                 ? 'text-blue-600 dark:text-blue-400'
                 : 'text-gray-500 dark:text-gray-400'
               }
              `
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

export default ConsumerLayout
