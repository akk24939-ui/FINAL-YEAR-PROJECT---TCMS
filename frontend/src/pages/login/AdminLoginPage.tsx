/**
 * AdminLoginPage — Government Administrator portal login.
 * Route: /login/admin
 *
 * Isolated from consumer and shop logins.
 * Posts to /api/v1/admin/auth/login (email + password).
 * Role mismatch → generic "Invalid credentials" from backend.
 */
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ShieldCheck, AlertCircle, Building2 } from 'lucide-react'
import { useAdminAuthStore } from '../../store/adminAuthStore'
import { adminAuthApi } from '../../api/admin.api'

// ─── Schema ───────────────────────────────────────────────────────────────────
const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

// ─── Component ────────────────────────────────────────────────────────────────
const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { setAuth } = useAdminAuthStore()
  const [showPwd, setShowPwd] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      const resp = await adminAuthApi.login(values.email, values.password)
      const data = resp.data
      setAuth(data.admin, data.access_token, data.must_change_password ?? false)

      if (data.must_change_password) {
        navigate('/admin/change-password')
      } else {
        navigate('/admin')
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setServerError(msg ?? 'Invalid credentials. Please try again.')
    }
  }

  const inputCls = (hasError: boolean) =>
    [
      'w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm outline-none transition-all',
      hasError
        ? 'border-red-500/60 focus:border-red-400'
        : 'border-white/15 focus:border-blue-400 hover:border-white/30',
    ].join(' ')

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0D2246 50%, #0A1628 100%)' }}>

      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
            <Building2 className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Government Admin Portal</h1>
          <p className="text-white/50 text-sm mt-1">Tamil Nadu TASMAC Regulation System</p>
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(59,130,246,0.1)', color: 'rgba(147,197,253,0.9)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <ShieldCheck className="w-3 h-3" />
            Restricted Access — Authorised Personnel Only
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl shadow-2xl p-8"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}>

          <h2 className="text-xl font-bold text-white mb-1">Administrator Sign In</h2>
          <p className="text-sm text-white/40 mb-6">Use your government-issued admin credentials.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                Admin Email
              </label>
              <input
                type="email"
                className={inputCls(!!errors.email)}
                placeholder="admin@tn.gov.in"
                autoComplete="username"
                {...register('email')}
              />
              {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className={inputCls(!!errors.password)}
                  placeholder="Your secure password"
                  autoComplete="current-password"
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
              {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
            </div>

            {/* Server error */}
            {serverError && (
              <div className="flex items-start gap-2 text-red-400 text-sm rounded-xl px-4 py-3"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {serverError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: isSubmitting ? '#374151' : 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                boxShadow: isSubmitting ? 'none' : '0 4px 20px rgba(59,130,246,0.3)',
              }}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
              ) : (
                <><ShieldCheck className="w-4 h-4" /> Admin Sign In</>
              )}
            </button>
          </form>
        </div>

        {/* Portal links */}
        <div className="mt-5 flex justify-center gap-4 text-xs text-white/25">
          <Link to="/login" className="hover:text-white/50 transition-colors">Consumer Portal</Link>
          <span>·</span>
          <Link to="/login/shop" className="hover:text-white/50 transition-colors">Shop Portal</Link>
        </div>
      </div>
    </div>
  )
}

export default AdminLoginPage
