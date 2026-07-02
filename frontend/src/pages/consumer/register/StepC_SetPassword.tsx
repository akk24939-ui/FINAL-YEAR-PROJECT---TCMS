import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ChevronLeft, ChevronRight, Check, X } from 'lucide-react'

// ─── Password rules ───────────────────────────────────────────────────────────
const hasUppercase = (s: string) => /[A-Z]/.test(s)
const hasLowercase = (s: string) => /[a-z]/.test(s)
const hasNumber = (s: string) => /\d/.test(s)

const schema = z
  .object({
    password: z
      .string()
      .min(10, 'At least 10 characters required')
      .refine(hasUppercase, { message: 'Must contain an uppercase letter' })
      .refine(hasLowercase, { message: 'Must contain a lowercase letter' })
      .refine(hasNumber, { message: 'Must contain a number' }),
    confirm: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })

type FormValues = z.infer<typeof schema>

// ─── Strength calculation ─────────────────────────────────────────────────────
const calcStrength = (pwd: string): { score: number; label: string; color: string } => {
  let score = 0
  if (pwd.length >= 10) score++
  if (hasUppercase(pwd)) score++
  if (hasLowercase(pwd)) score++
  if (hasNumber(pwd)) score++
  if (/[^a-zA-Z0-9]/.test(pwd)) score++

  if (score <= 1) return { score, label: 'Weak', color: '#EF4444' }
  if (score === 2) return { score, label: 'Fair', color: '#F97316' }
  if (score === 3) return { score, label: 'Good', color: '#EAB308' }
  if (score === 4) return { score, label: 'Strong', color: '#22C55E' }
  return { score, label: 'Very Strong', color: '#10B981' }
}

// ─── Requirement item ─────────────────────────────────────────────────────────
const Req: React.FC<{ met: boolean; label: string }> = ({ met, label }) => (
  <li className={`flex items-center gap-2 text-xs transition-colors ${met ? 'text-emerald-400' : 'text-white/40'}`}>
    {met
      ? <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={3} />
      : <X className="w-3.5 h-3.5 text-white/30" strokeWidth={3} />
    }
    {label}
  </li>
)

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  onComplete: (data: { password: string }) => void
  onBack: () => void
}

const inputCls =
  'w-full bg-white/5 border border-white/15 hover:border-white/30 focus:border-[#F97316] text-white placeholder-white/30 rounded-lg px-3 py-2.5 pr-10 text-sm outline-none transition-colors'

const StepC_SetPassword: React.FC<Props> = ({ onComplete, onBack }) => {
  const [showPwd, setShowPwd] = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [pwdValue, setPwdValue] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  })

  const strength = calcStrength(pwdValue)
  const segments = 5

  const onSubmit = (values: FormValues) => {
    onComplete({ password: values.password })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 sm:p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Set Your Password</h2>
        <p className="text-sm text-white/60 mt-1">
          Choose a strong password to protect your account.
        </p>
      </div>

      {/* Password field */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-white/70 uppercase tracking-wide">Password</label>
        <div className="relative">
          <input
            type={showPwd ? 'text' : 'password'}
            className={inputCls}
            placeholder="Min. 10 characters"
            {...register('password', {
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setPwdValue(e.target.value),
            })}
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

      {/* Strength meter */}
      {pwdValue.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">Password Strength</span>
            <span className="text-xs font-bold" style={{ color: strength.color }}>{strength.label}</span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: segments }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-1.5 rounded-full transition-all duration-300"
                style={{
                  background: i < strength.score ? strength.color : 'rgba(255,255,255,0.1)',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Requirements checklist */}
      <div className="bg-white/5 rounded-xl p-4">
        <p className="text-xs font-semibold text-white/50 mb-2 uppercase tracking-wide">Requirements</p>
        <ul className="space-y-1.5">
          <Req met={pwdValue.length >= 10} label="At least 10 characters" />
          <Req met={hasUppercase(pwdValue)} label="At least one uppercase letter (A–Z)" />
          <Req met={hasLowercase(pwdValue)} label="At least one lowercase letter (a–z)" />
          <Req met={hasNumber(pwdValue)} label="At least one number (0–9)" />
        </ul>
      </div>

      {/* Confirm password */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-white/70 uppercase tracking-wide">Confirm Password</label>
        <div className="relative">
          <input
            type={showConf ? 'text' : 'password'}
            className={inputCls}
            placeholder="Re-enter your password"
            {...register('confirm')}
          />
          <button
            type="button"
            onClick={() => setShowConf(!showConf)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
            aria-label="Toggle confirm password visibility"
          >
            {showConf ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {errors.confirm && (
          <p className="text-red-400 text-xs">{errors.confirm.message}</p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/20 text-white/70 hover:text-white hover:border-white/40 text-sm font-semibold transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          type="submit"
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#F97316] to-orange-400 hover:from-orange-500 hover:to-orange-300 text-white font-bold text-sm shadow-lg hover:shadow-orange-500/25 transition-all"
        >
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  )
}

export default StepC_SetPassword
