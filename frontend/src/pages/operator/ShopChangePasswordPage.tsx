/**
 * ShopChangePasswordPage — Forced password change for shop operators.
 *
 * Shown when must_change_password=true after login.
 * Operator cannot access any POS feature until they set a new password.
 * Route: /shop/change-password
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2, KeyRound, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react'
import { operatorAuthApi } from '../../api/operator.api'
import { useOperatorAuthStore } from '../../store/operatorAuthStore'
import { getErrorMessage } from '../../utils/getErrorMessage'

// ─── Password policy regex (must match backend PASSWORD_POLICY) ───────────────
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};:'",./<>?]).{8,}$/

const schema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(PASSWORD_POLICY, 'Must contain uppercase, lowercase, digit, and symbol'),
  confirm_password: z.string().min(1, 'Please confirm your new password'),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
}).refine(d => d.new_password !== d.current_password, {
  message: 'New password must be different from your current password',
  path: ['new_password'],
})

type FormValues = z.infer<typeof schema>

// ─── Password strength helper ─────────────────────────────────────────────────
const checkStrength = (pwd: string) => ({
  length: pwd.length >= 8,
  upper: /[A-Z]/.test(pwd),
  lower: /[a-z]/.test(pwd),
  digit: /\d/.test(pwd),
  symbol: /[!@#$%^&*()_+\-=\[\]{};:'",./<>?]/.test(pwd),
})

const StrengthRow: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <div className={`flex items-center gap-1.5 text-xs ${ok ? 'text-emerald-400' : 'text-white/30'}`}>
    <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
    {label}
  </div>
)

// ─── Component ────────────────────────────────────────────────────────────────
const ShopChangePasswordPage: React.FC = () => {
  const navigate = useNavigate()
  const { logout } = useOperatorAuthStore()
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const newPwd = watch('new_password', '')
  const strength = checkStrength(newPwd)
  const strengthScore = Object.values(strength).filter(Boolean).length

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      await operatorAuthApi.changePassword(
        values.current_password,
        values.new_password,
        values.confirm_password,
      )
      setSuccess(true)
      // Log out after success — operator must re-login with new password
      setTimeout(() => {
        logout()
        navigate('/login/shop')
      }, 2500)
    } catch (err: unknown) {
      setServerError(getErrorMessage(err, 'Failed to change password. Please try again.'))
    }
  }

  const inputCls = (hasError: boolean) =>
    [
      'w-full bg-white/5 border rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm outline-none transition-all',
      hasError
        ? 'border-red-500/60 focus:border-red-400'
        : 'border-white/15 focus:border-amber-400 hover:border-white/30',
    ].join(' ')

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg, #1a0505 0%, #3b0a0a 50%, #1a0505 100%)' }}>
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)' }}>
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Password Changed!</h2>
          <p className="text-white/50 text-sm">Redirecting to login…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #1a0505 0%, #3b0a0a 50%, #1a0505 100%)' }}>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)' }}>
            <KeyRound className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Change Password Required</h1>
          <p className="text-white/50 text-sm mt-2 max-w-sm mx-auto">
            Your account was assigned an initial password by your administrator.
            You must set a new password before accessing the POS system.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl shadow-2xl p-8"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Current password */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                Current / Temporary Password
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  className={inputCls(!!errors.current_password)}
                  placeholder="Password given by administrator"
                  autoComplete="current-password"
                  {...register('current_password')}
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.current_password && <p className="text-red-400 text-xs">{errors.current_password.message}</p>}
            </div>

            {/* New password */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  className={inputCls(!!errors.new_password)}
                  placeholder="Min 8 chars, upper+lower+digit+symbol"
                  autoComplete="new-password"
                  {...register('new_password')}
                />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.new_password && <p className="text-red-400 text-xs">{errors.new_password.message}</p>}

              {/* Strength indicator */}
              {newPwd.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 mb-1.5">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex-1 h-1 rounded-full transition-all"
                        style={{
                          background: i <= strengthScore
                            ? strengthScore <= 2 ? '#ef4444'
                              : strengthScore <= 3 ? '#f59e0b'
                                : '#10b981'
                            : 'rgba(255,255,255,0.1)',
                        }} />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <StrengthRow ok={strength.length} label="8+ characters" />
                    <StrengthRow ok={strength.upper} label="Uppercase letter" />
                    <StrengthRow ok={strength.lower} label="Lowercase letter" />
                    <StrengthRow ok={strength.digit} label="Number" />
                    <StrengthRow ok={strength.symbol} label="Symbol (!@#…)" />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  className={inputCls(!!errors.confirm_password)}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  {...register('confirm_password')}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirm_password && <p className="text-red-400 text-xs">{errors.confirm_password.message}</p>}
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
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2"
              style={{
                background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                boxShadow: '0 4px 20px rgba(245,158,11,0.3)',
              }}
            >
              {isSubmitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Changing…</>
                : <><KeyRound className="w-4 h-4" /> Set New Password</>}
            </button>
          </form>
        </div>

        <p className="text-center text-white/25 text-xs mt-4">
          You cannot access the POS system until this is complete.
        </p>
      </div>
    </div>
  )
}

export default ShopChangePasswordPage
