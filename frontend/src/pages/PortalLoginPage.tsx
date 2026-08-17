/**
 * PortalLoginPage — Unified login for:
 *  - Tab 1: Government Admin  (email + password)
 *  - Tab 2: Shop Operator      (shop code + 6-digit PIN)
 *
 * Route: /portal/login  (also served at /admin/login & /shop/login via redirect)
 * Theme: fully respects light/dark mode via Tailwind dark: classes.
 */
import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ShieldCheck, Store, Eye, EyeOff, Loader2,
  AlertCircle, Sun, Moon, ChevronRight,
} from 'lucide-react'
import { useAdminAuthStore } from '../store/adminAuthStore'
import { useOperatorAuthStore } from '../store/operatorAuthStore'
import { useTheme } from '../context/ThemeContext'
import type { AdminUser } from '../types/admin.types'
import type { ShopInfo } from '../types/operator.types'
import axios from 'axios'
import { getErrorMessage } from '../utils/getErrorMessage'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// ── Helpers ────────────────────────────────────────────────────────────────────
type Tab = 'admin' | 'operator'

const inp =
  'w-full px-4 py-3 rounded-xl text-sm border transition-all duration-200 ' +
  'bg-white dark:bg-gray-800/80 ' +
  'border-gray-200 dark:border-gray-700 ' +
  'text-gray-900 dark:text-white ' +
  'placeholder-gray-400 dark:placeholder-gray-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ' +
  'focus:border-transparent'

// ── Main Component ─────────────────────────────────────────────────────────────
const PortalLoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const [searchParams] = useSearchParams()

  const setAdminAuth = useAdminAuthStore((s: { setAuth: (admin: AdminUser, token: string, mustChange: boolean) => void }) => s.setAuth)
  const setOperatorAuth = useOperatorAuthStore((s: { setAuth: (token: string, shop: ShopInfo, pinWarning: string | null) => void }) => s.setAuth)

  const [tab, setTab] = useState<Tab>('admin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-select tab from URL ?tab=operator
  useEffect(() => {
    if (searchParams.get('tab') === 'operator') setTab('operator')
  }, [searchParams])

  // Admin fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  // Operator fields
  const [shopCode, setShopCode] = useState('')
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [showPin, setShowPin] = useState(false)
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])

  // ── PIN handlers ──────────────────────────────────────────────────────────
  const handlePinChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return
    const next = [...pin]; next[i] = val.slice(-1); setPin(next)
    if (val && i < 5) pinRefs.current[i + 1]?.focus()
  }
  const handlePinKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[i] && i > 0) pinRefs.current[i - 1]?.focus()
  }
  const handlePinPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) { setPin(text.split('')); pinRefs.current[5]?.focus() }
    e.preventDefault()
  }

  const switchTab = (t: Tab) => { setTab(t); setError('') }

  // ── Admin submit ──────────────────────────────────────────────────────────
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res = await axios.post(`${API}/api/v1/admin/auth/login`, {
        username: email.trim(), password
      }, { withCredentials: true })
      const { access_token, must_change_password, admin } = res.data
      setAdminAuth(admin, access_token, must_change_password ?? false)
      if (must_change_password) {
        navigate('/admin/change-password', { replace: true })
      } else {
        navigate('/admin', { replace: true })
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Invalid credentials. Check your email and password.'))
    } finally { setLoading(false) }
  }

  // ── Operator submit ───────────────────────────────────────────────────────
  const handleOperatorLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const pinStr = pin.join('')
    if (pinStr.length < 6) { setError('Enter all 6 PIN digits'); return }
    setError(''); setLoading(true)
    try {
      const res = await axios.post(`${API}/api/v1/shop/auth/login`, {
        shop_code: shopCode.trim().toUpperCase(), pin: pinStr
      }, { withCredentials: true })
      const { access_token, shop, pin_rotation_warning } = res.data
      setOperatorAuth(access_token, shop, pin_rotation_warning ?? null)
      navigate('/shop', { replace: true })
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Invalid shop code or PIN.'))
      setPin(['', '', '', '', '', ''])
      pinRefs.current[0]?.focus()
    } finally { setLoading(false) }
  }

  // ── Accent colours per tab ────────────────────────────────────────────────
  const accent = tab === 'admin'
    ? 'from-blue-600 to-indigo-600'
    : 'from-red-600 to-rose-600'
  const accentRing = tab === 'admin'
    ? 'focus:ring-blue-500 dark:focus:ring-blue-400'
    : 'focus:ring-red-500 dark:focus:ring-red-400'
  const btnBg = tab === 'admin'
    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'
    : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500'

  return (
    <div className="
      min-h-screen flex items-center justify-center p-4
      bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100
      dark:from-gray-950 dark:via-slate-900 dark:to-gray-950
      transition-colors duration-300
    ">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="
          fixed top-4 right-4 p-2.5 rounded-xl transition-all
          bg-white/80 dark:bg-gray-800/80
          border border-gray-200 dark:border-gray-700
          text-gray-600 dark:text-gray-300
          hover:bg-white dark:hover:bg-gray-700
          shadow-sm
        "
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="w-full max-w-md">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="text-center mb-8">
          {/* Emblem */}
          <div className={`
            inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4
            bg-gradient-to-br ${accent} shadow-lg
          `}>
            {tab === 'admin'
              ? <ShieldCheck className="w-8 h-8 text-white" />
              : <Store className="w-8 h-8 text-white" />}
          </div>

          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            {tab === 'admin' ? 'Government Admin Portal' : 'Shop Operator Portal'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Smart TASMAC Consumer Regulation System
          </p>
        </div>

        {/* ── Card ────────────────────────────────────────────────────────── */}
        <div className="
          rounded-2xl shadow-xl border
          bg-white/90 dark:bg-gray-900/80
          border-gray-200 dark:border-gray-800
          backdrop-blur-xl overflow-hidden
        ">

          {/* Tab switcher */}
          <div className="flex border-b border-gray-100 dark:border-gray-800">
            {(['admin', 'operator'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`
                  flex-1 py-3.5 text-sm font-bold transition-all duration-200
                  ${tab === t
                    ? t === 'admin'
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/60 dark:bg-blue-950/30'
                      : 'text-red-600 dark:text-red-400 border-b-2 border-red-600 dark:border-red-400 bg-red-50/60 dark:bg-red-950/30'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                  }
                `}
              >
                {t === 'admin' ? 'Government Admin' : 'Shop Operator'}
              </button>
            ))}
          </div>

          {/* Form area */}
          <div className="p-7">

            {/* ── ADMIN FORM ─────────────────────────────────────────────── */}
            {tab === 'admin' && (
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">
                    Admin Email
                  </label>
                  <input
                    type="email"
                    className={`${inp} ${accentRing}`}
                    placeholder="admin@tasmac.gov.in"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required autoFocus autoComplete="username"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      className={`${inp} ${accentRing} pr-11`}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && <ErrorBox msg={error} />}

                <button
                  type="submit" disabled={loading}
                  className={`w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md mt-1 ${btnBg}`}
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : <>Sign In <ChevronRight className="w-4 h-4" /></>}
                </button>
              </form>
            )}

            {/* ── OPERATOR FORM ───────────────────────────────────────────── */}
            {tab === 'operator' && (
              <form onSubmit={handleOperatorLogin} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1.5">
                    Shop Code
                  </label>
                  <input
                    className={`${inp} ${accentRing} font-mono uppercase`}
                    type="text"
                    placeholder="e.g. TSM-CHE-001"
                    value={shopCode}
                    onChange={e => setShopCode(e.target.value.toUpperCase())}
                    required autoFocus autoComplete="username"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                      6-Digit PIN
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPin(s => !s)}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
                    >
                      {showPin ? <><EyeOff className="w-3 h-3" /> Hide</> : <><Eye className="w-3 h-3" /> Show</>}
                    </button>
                  </div>
                  <div className="flex gap-2" onPaste={handlePinPaste}>
                    {pin.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => { pinRefs.current[i] = el }}
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric" maxLength={1}
                        value={digit}
                        onChange={e => handlePinChange(i, e.target.value)}
                        onKeyDown={e => handlePinKey(i, e)}
                        className={`
                          w-full h-12 text-center text-xl font-black rounded-xl border transition-all
                          bg-white dark:bg-gray-800
                          border-gray-200 dark:border-gray-700
                          text-gray-900 dark:text-white
                          focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 focus:border-transparent
                        `}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1.5">
                    You can paste a 6-digit PIN directly
                  </p>
                </div>

                {error && <ErrorBox msg={error} />}

                <button
                  type="submit" disabled={loading}
                  className={`w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-md ${btnBg}`}
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : <>Sign In to Shop Portal <ChevronRight className="w-4 h-4" /></>}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-700 mt-6">
          {tab === 'admin'
            ? 'Restricted to authorised government administrators only.'
            : 'For authorised TASMAC shop operators only. 5 wrong PIN attempts lock the account.'}
        </p>
      </div>
    </div>
  )
}

// ── Sub-component ──────────────────────────────────────────────────────────────
const ErrorBox: React.FC<{ msg: string }> = ({ msg }) => (
  <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2.5 rounded-xl">
    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
    <span>{msg}</span>
  </div>
)

export default PortalLoginPage
