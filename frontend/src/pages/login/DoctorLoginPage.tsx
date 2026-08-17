/**
 * DoctorLoginPage — Clinical Doctor portal login.
 * Route: /login/doctor
 *
 * Brand colour: Teal/Emerald (Medical/Clinical).
 * Handles: email + password login, forced first-login password change.
 */
import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Stethoscope, Eye, EyeOff, Loader2, AlertCircle, KeyRound, Sun, Moon, CheckCircle } from 'lucide-react'
import { useDoctorAuthStore } from '../../store/doctorAuthStore'
import { doctorAuthApi } from '../../api/doctor.api'
import { useTheme } from '../../hooks/useTheme'
import { getErrorMessage } from '../../utils/getErrorMessage'

const DoctorLoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const setAuth = useDoctorAuthStore(s => s.setAuth)

  // Login form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Forced password-change state
  const [mustChange, setMustChange] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [changing, setChanging] = useState(false)
  const [changeError, setChangeError] = useState('')
  const [changeSuccess, setChangeSuccess] = useState(false)
  const [doctorData, setDoctorData] = useState<Record<string, unknown> | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await doctorAuthApi.login(email, password)
      const { access_token, doctor, must_change_password } = res.data
      if (must_change_password) {
        // Store token temporarily to allow password change call
        setTempToken(access_token)
        setDoctorData(doctor)
        setCurrentPw(password)   // pre-fill current password
        setMustChange(true)
      } else {
        setAuth(doctor, access_token, false)
        navigate('/doctor', { replace: true })
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Login failed. Check your credentials.'))
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangeError('')
    if (newPw !== confirmPw) { setChangeError('Passwords do not match.'); return }
    if (newPw.length < 8) { setChangeError('New password must be at least 8 characters.'); return }
    if (newPw === currentPw) { setChangeError('New password must differ from the current one.'); return }
    setChanging(true)
    try {
      // Use the temp token obtained right after login
      await doctorAuthApi.changePassword(currentPw, newPw)
      setChangeSuccess(true)
      setTimeout(() => {
        if (doctorData) {
          setAuth(doctorData as Parameters<typeof setAuth>[0], tempToken, false)
        }
        navigate('/doctor', { replace: true })
      }, 1500)
    } catch (err: unknown) {
      setChangeError(getErrorMessage(err, 'Password change failed.'))
    } finally {
      setChanging(false)
    }
  }

  const inputCls =
    'w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 hover:border-gray-300 dark:hover:border-gray-600'

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 transition-colors duration-300">

      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/30">
            <Stethoscope className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-gray-900 dark:text-white text-sm tracking-tight">
            TASMAC <span className="text-emerald-600 dark:text-emerald-400">Clinical</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500 font-medium">
            Doctor Portal
          </span>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          {/* Brand badge */}
          <div className="text-center mb-8">
            <div className="inline-flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25 flex items-center justify-center">
                <Stethoscope className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  Doctor Portal
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Clinical Intervention — Smart TASMAC System
                </p>
              </div>
            </div>
          </div>

          {/* Card */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-800 p-8">

            {!mustChange ? (
              /* ── Login form ── */
              <>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Clinical Sign In</h2>
                <form onSubmit={handleLogin} className="space-y-4">

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block">
                      Registration Number
                    </label>
                    <input
                      className={inputCls}
                      type="text"
                      placeholder="e.g. MRN-82597077"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="username"
                      id="doctor-email"
                    />
                    <p className="text-xs text-gray-400 dark:text-gray-600">
                      Enter your Medical Registration Number — provided by the Administrator.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        className={inputCls + ' pr-10'}
                        type={showPw ? 'text' : 'password'}
                        placeholder="Your password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        id="doctor-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                        tabIndex={-1}
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2.5 rounded-xl">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    id="doctor-login-btn"
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all duration-200 mt-2"
                  >
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                      : <><Stethoscope className="w-4 h-4" /> Sign In</>
                    }
                  </button>

                  <p className="text-center text-xs text-gray-400 dark:text-gray-600 pt-1">
                    Restricted to authorised medical practitioners only.
                  </p>
                </form>
              </>
            ) : (
              /* ── Forced password change ── */
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    <KeyRound className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Set Your Password</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Required before accessing the clinical dashboard</p>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-4 py-3 mb-5">
                  <p className="text-amber-700 dark:text-amber-300 text-xs leading-relaxed">
                    Your account was created by the Administrator with a temporary password. Please set a new personal password (minimum 8 characters) to continue.
                  </p>
                </div>

                {changeSuccess && (
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-2.5 rounded-xl mb-4">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" /> Password set! Redirecting to dashboard…
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block">Current (Temp) Password</label>
                    <input className={inputCls} type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required autoComplete="current-password" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block">New Password (min 8 chars)</label>
                    <div className="relative">
                      <input className={inputCls + ' pr-10'} type={showNew ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} minLength={8} required />
                      <button type="button" onClick={() => setShowNew(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" tabIndex={-1}>
                        {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block">Confirm New Password</label>
                    <div className="relative">
                      <input className={inputCls + ' pr-10'} type={showConfirm ? 'text' : 'password'} value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
                      <button type="button" onClick={() => setShowConfirm(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" tabIndex={-1}>
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {changeError && (
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2.5 rounded-xl">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" /> {changeError}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={changing || changeSuccess}
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all mt-2"
                  >
                    {changing
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
                      : 'Set Password & Enter Dashboard'
                    }
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Portal links */}
          <div className="mt-6 flex justify-center items-center gap-4 text-xs text-gray-400 dark:text-gray-600">
            <Link to="/login" className="hover:text-gray-600 dark:hover:text-gray-400 transition-colors">Consumer Portal</Link>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            <Link to="/login/admin" className="hover:text-gray-600 dark:hover:text-gray-400 transition-colors">Admin Portal</Link>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            <Link to="/login/shop" className="hover:text-gray-600 dark:hover:text-gray-400 transition-colors">Shop Portal</Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-3 text-center text-[11px] text-gray-400 dark:text-gray-600 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        Government of Tamil Nadu · Smart TASMAC Consumer Regulation System — Clinical Module
      </footer>
    </div>
  )
}

export default DoctorLoginPage
