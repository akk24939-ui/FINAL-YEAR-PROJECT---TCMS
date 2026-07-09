/**
 * AdminLoginPage — Government Admin portal login.
 *
 * Features:
 * - Separate portal (no role selector, no consumer branding)
 * - Rate-limited login with lockout feedback
 * - Forced password change if must_change_password=true
 * - Light + Dark mode
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Eye, EyeOff, Loader2, AlertCircle, KeyRound, Sun, Moon } from 'lucide-react'
import { useAdminAuthStore } from '../../store/adminAuthStore'
import { adminAuthApi } from '../../api/admin.api'
import { useTheme } from '../../hooks/useTheme'

const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const setAuth = useAdminAuthStore(s => s.setAuth)

  // Login form
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Change password form (shown after first login)
  const [mustChange, setMustChange] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [changing, setChanging] = useState(false)
  const [changeError, setChangeError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await adminAuthApi.login(username, password)
      const { access_token, admin, must_change_password } = res.data
      setAuth(admin, access_token, must_change_password)
      if (must_change_password) {
        setMustChange(true)
      } else {
        navigate('/admin', { replace: true })
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangeError('')
    if (newPw !== confirmPw) { setChangeError('Passwords do not match'); return }
    if (newPw.length < 12) { setChangeError('New password must be at least 12 characters'); return }
    setChanging(true)
    try {
      await adminAuthApi.changePassword(currentPw, newPw)
      useAdminAuthStore.getState().clearMustChange()
      navigate('/admin', { replace: true })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setChangeError(msg || 'Password change failed.')
    } finally {
      setChanging(false)
    }
  }

  const inputCls = 'w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 dark:from-gray-950 dark:via-blue-950 dark:to-gray-950 flex items-center justify-center p-4">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/30 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Government Admin Portal</h1>
          <p className="text-blue-300/60 text-sm mt-1">Smart TASMAC Consumer Regulation System</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 dark:bg-gray-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">

          {!mustChange ? (
            <>
              <h2 className="text-lg font-bold text-white mb-6">Sign In</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide block mb-1.5">Admin Email</label>
                  <input
                    className={inputCls}
                    type="email"
                    placeholder="admin@tasmac.gov.in"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide block mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      className={inputCls + ' pr-10'}
                      type={showPw ? 'text' : 'password'}
                      placeholder="Your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 px-3 py-2.5 rounded-xl border border-red-500/20">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 mt-2"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : 'Sign In'}
                </button>
              </form>

              <p className="text-center text-xs text-gray-500 dark:text-gray-600 mt-6">
                This portal is restricted to authorised government administrators only.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Change Your Password</h2>
                  <p className="text-xs text-gray-400">Required before accessing the dashboard</p>
                </div>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-5">
                <p className="text-amber-300 text-xs leading-relaxed">
                  For security, you must set a new password (minimum 12 characters) before continuing. This replaces the initial seed password.
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide block mb-1.5">Current Password</label>
                  <input className={inputCls} type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide block mb-1.5">New Password (min 12 chars)</label>
                  <input className={inputCls} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} minLength={12} required />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide block mb-1.5">Confirm New Password</label>
                  <input className={inputCls} type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
                </div>
                {changeError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 px-3 py-2.5 rounded-xl border border-red-500/20">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {changeError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={changing}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 mt-2"
                >
                  {changing ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</> : 'Set New Password & Continue'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminLoginPage
