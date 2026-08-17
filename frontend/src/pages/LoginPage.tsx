/**
 * LoginPage — Consumer portal login.
 * Route: /login
 *
 * Full light + dark mode support.
 * Brand colour: Emerald / Green (TASMAC Consumer).
 * Separate from admin and shop portals.
 */
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2, LogIn, AlertCircle, Info, Sun, Moon } from 'lucide-react'
import { authApi } from '../api/auth.api'
import { useAuthStore } from '../store/authStore'
import { useTheme } from '../hooks/useTheme'
import OtpModal from './consumer/auth/OtpModal'
import { getErrorMessage } from '../utils/getErrorMessage'

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  identifier: z
    .string()
    .min(4, 'Enter mobile number, Aadhaar number, or last 4 digits')
    .max(12, 'Identifier too long')
    .regex(/^\d+$/, 'Only digits allowed — no spaces or dashes'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

// ─── Role-based redirect map ──────────────────────────────────────────────────
const ROLE_REDIRECT: Record<string, string> = {
  CONSUMER: '/consumer',
  OPERATOR: '/operator',
  ADMIN: '/admin',
  DOCTOR: '/doctor',
  CARETAKER: '/caretaker',
}

// ─── Component ────────────────────────────────────────────────────────────────
const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const { theme, toggleTheme } = useTheme()
  const [showPwd, setShowPwd] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [otpState, setOtpState] = useState<{ open: boolean; mobile: string }>({ open: false, mobile: '' })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      const resp = await authApi.login(values.identifier, values.password)
      const data = resp.data

      if ((data as { requires_otp?: boolean }).requires_otp) {
        setOtpState({ open: true, mobile: values.identifier })
        login({ id: data.user_id, full_name: data.full_name, role: data.role }, data.access_token)
        return
      }

      login({ id: data.user_id, full_name: data.full_name, role: data.role }, data.access_token)
      navigate(ROLE_REDIRECT[data.role] ?? '/')
    } catch (err: unknown) {
      setServerError(getErrorMessage(err, 'Invalid credentials. Please try again.'))
    }
  }

  const handleOtpVerified = () => {
    const user = useAuthStore.getState().user
    navigate(ROLE_REDIRECT[user?.role ?? ''] ?? '/')
  }

  const inputCls = (hasError: boolean) =>
    [
      'w-full bg-gray-50 dark:bg-gray-800 border rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm outline-none transition-all',
      hasError
        ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
        : 'border-gray-200 dark:border-gray-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 hover:border-gray-300 dark:hover:border-gray-600',
    ].join(' ')

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 transition-colors duration-300">

      {/* OTP Modal */}
      {otpState.open && (
        <OtpModal
          mobileNumber={otpState.mobile}
          onVerified={handleOtpVerified}
          onClose={() => setOtpState({ open: false, mobile: '' })}
        />
      )}

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center shadow-md shadow-emerald-700/30">
            <span className="text-white text-sm leading-none">🏛️</span>
          </div>
          <span className="font-black text-gray-900 dark:text-white text-sm tracking-tight">
            Smart <span className="text-emerald-700 dark:text-emerald-400">TASMAC</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500 font-medium">Consumer Portal</span>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          {/* Brand badge */}
          <div className="text-center mb-8">
            <div className="inline-flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-emerald-700 shadow-lg shadow-emerald-700/25 flex items-center justify-center text-2xl">
                🏛️
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  Consumer Sign In
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Smart TASMAC Consumer Management System
                </p>
              </div>
            </div>
          </div>

          {/* Card */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-800 p-8">

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

              {/* Identifier */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block">
                  Mobile or Aadhaar Number
                </label>
                <input
                  className={inputCls(!!errors.identifier)}
                  placeholder="10-digit mobile or 12-digit Aadhaar"
                  inputMode="numeric"
                  maxLength={12}
                  {...register('identifier')}
                />
                <p className="text-gray-400 dark:text-gray-500 text-[11px]">
                  Accepted: 10-digit mobile · 12-digit Aadhaar · Aadhaar last 4 digits
                </p>
                {errors.identifier && (
                  <p className="text-red-500 text-xs">{errors.identifier.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className={inputCls(!!errors.password) + ' pr-10'}
                    placeholder="Your password"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    aria-label="Toggle password visibility"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs">{errors.password.message}</p>
                )}
              </div>

              {/* Server error */}
              {serverError && (
                <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {serverError}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 transition-all duration-200"
              >
                {isSubmitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                  : <><LogIn className="w-4 h-4" /> Sign In</>
                }
              </button>
            </form>

            {/* Forgot password + Register link */}
            <div className="text-center space-y-2 mt-6">
              <p className="text-sm">
                <Link
                  to="/forgot-password"
                  className="text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-sm"
                >
                  Forgot password?
                </Link>
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                New user?{' '}
                <Link
                  to="/register"
                  className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-semibold transition-colors"
                >
                  Register here
                </Link>
              </p>
            </div>
          </div>

          {/* Demo credentials */}
          <div className="mt-5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-5 py-4 space-y-1.5">
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-amber-700 dark:text-amber-400 text-xs font-bold uppercase tracking-wide">Demo Credentials</span>
            </div>
            <p className="text-gray-700 dark:text-gray-300 text-xs">
              <span className="text-gray-400 dark:text-gray-500 mr-2">Mobile:</span>
              <span className="font-mono font-semibold">9876543210</span>
            </p>
            <p className="text-gray-700 dark:text-gray-300 text-xs">
              <span className="text-gray-400 dark:text-gray-500 mr-2">Password:</span>
              <span className="font-mono font-semibold">Demo@1234pass</span>
            </p>
          </div>

          {/* Portal links */}
          <div className="mt-5 flex justify-center items-center gap-4 text-xs text-gray-400 dark:text-gray-600">
            <Link to="/login/admin" className="hover:text-gray-600 dark:hover:text-gray-400 transition-colors">Admin Portal</Link>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            <Link to="/login/shop" className="hover:text-gray-600 dark:hover:text-gray-400 transition-colors">Shop Portal</Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-3 text-center text-[11px] text-gray-400 dark:text-gray-600 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        Tamil Nadu State Marketing Corporation · Smart TASMAC v1.0
      </footer>
    </div>
  )
}

export default LoginPage
