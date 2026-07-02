import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2, LogIn, AlertCircle, Info } from 'lucide-react'
import { authApi } from '../api/auth.api'
import { useAuthStore } from '../store/authStore'
import OtpModal from './consumer/auth/OtpModal'

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  identifier: z.string().min(4, 'Enter your mobile number or Aadhaar last 4 digits'),
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
  const [showPwd, setShowPwd] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [otpState, setOtpState] = useState<{ open: boolean; mobile: string }>({
    open: false,
    mobile: '',
  })

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      const resp = await authApi.login(values.identifier, values.password)
      const data = resp.data

      if ((data as { requires_otp?: boolean }).requires_otp) {
        setOtpState({
          open: true,
          mobile: values.identifier,
        })
        login({ id: data.user_id, full_name: data.full_name, role: data.role }, data.access_token)
        return
      }

      login({ id: data.user_id, full_name: data.full_name, role: data.role }, data.access_token)
      navigate(ROLE_REDIRECT[data.role] ?? '/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setServerError(msg ?? 'Invalid credentials. Please try again.')
    }
  }

  const handleOtpVerified = () => {
    const user = useAuthStore.getState().user
    navigate(ROLE_REDIRECT[user?.role ?? ''] ?? '/')
  }

  const inputCls = (hasError: boolean) =>
    [
      'w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm outline-none transition-all',
      hasError
        ? 'border-red-500/60 focus:border-red-400'
        : 'border-white/15 focus:border-[#F97316] hover:border-white/30',
    ].join(' ')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0D1F1A] via-[#1A3C34] to-[#0D2B22] p-4">
      {/* OTP Modal */}
      {otpState.open && (
        <OtpModal
          mobileNumber={otpState.mobile}
          onVerified={handleOtpVerified}
          onClose={() => setOtpState({ open: false, mobile: '' })}
        />
      )}

      <div className="w-full max-w-md">
        {/* Logo / branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 mb-4">
            <span className="text-3xl">🏛️</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Smart TASMAC</h1>
          <p className="text-white/50 text-sm mt-1">Consumer Management System</p>
        </div>

        {/* Glassmorphism card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-white mb-1">Sign In</h2>
          <p className="text-sm text-white/50 mb-6">Welcome back. Enter your credentials to continue.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Identifier */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                Mobile Number or Aadhaar Last 4 Digits
              </label>
              <input
                className={inputCls(!!errors.identifier)}
                placeholder="e.g. 9876543210 or last 4 of Aadhaar"
                inputMode="numeric"
                {...register('identifier')}
              />
              {errors.identifier && (
                <p className="text-red-400 text-xs">{errors.identifier.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className={inputCls(!!errors.password)}
                  placeholder="Your password"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs">{errors.password.message}</p>
              )}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {serverError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={[
                'w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all',
                isSubmitting
                  ? 'bg-gray-600 opacity-50 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#F97316] to-orange-400 hover:from-orange-500 hover:to-orange-300 shadow-lg hover:shadow-orange-500/25',
              ].join(' ')}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
              ) : (
                <><LogIn className="w-4 h-4" /> Sign In</>
              )}
            </button>
          </form>

          {/* Register link */}
          <p className="text-center text-white/40 text-sm mt-6">
            New user?{' '}
            <Link
              to="/register"
              className="text-[#F97316] hover:text-orange-300 font-semibold transition-colors"
            >
              Register here
            </Link>
          </p>
        </div>

        {/* Demo credentials */}
        <div className="mt-5 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 px-5 py-4 space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-wide">Demo Credentials</span>
          </div>
          <p className="text-white/70 text-xs">
            <span className="text-white/40 mr-2">Mobile:</span>
            <span className="font-mono font-semibold text-white">9876543210</span>
          </p>
          <p className="text-white/70 text-xs">
            <span className="text-white/40 mr-2">Password:</span>
            <span className="font-mono font-semibold text-white">Demo@1234pass</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
