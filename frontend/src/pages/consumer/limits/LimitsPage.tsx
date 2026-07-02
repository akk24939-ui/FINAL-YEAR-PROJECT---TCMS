import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, Loader2, AlertTriangle, CheckCircle } from 'lucide-react'
import { useLimits, useUpdateLimits } from '../../../hooks/useLimits'
import { useConsumerProfile } from '../../../hooks/useConsumerProfile'
import StandardDrinkGuide from './StandardDrinkGuide'
import SelfRestrictionPanel from './SelfRestrictionPanel'
import LimitGauge from '../../../components/consumer/LimitGauge'

// ─── Zod schema for limit form ────────────────────────────────────────────────
const schema = z.object({
  daily_limit_sd: z
    .number({ invalid_type_error: 'Enter a number' })
    .min(0, 'Must be 0 or more')
    .max(50, 'Cannot exceed 50'),
  weekly_limit_sd: z
    .number({ invalid_type_error: 'Enter a number' })
    .min(0)
    .max(200),
  monthly_limit_sd: z
    .number({ invalid_type_error: 'Enter a number' })
    .min(0)
    .max(500),
})

type FormValues = z.infer<typeof schema>

// ─── Alert bar ────────────────────────────────────────────────────────────────
interface AlertBarProps {
  label: string
  current: number
  max: number
}

const AlertBar: React.FC<AlertBarProps> = ({ label, current, max }) => {
  if (max === 0) return null
  const pct = current / max
  if (pct < 0.8) return null

  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 border text-sm ${
        pct >= 1
          ? 'bg-red-500/10 border-red-500/20 text-red-400'
          : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
      }`}
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span>
        {pct >= 1
          ? `🚫 ${label} limit <strong>exceeded</strong> (${current}/${max} std drinks)`
          : `⚠️ ${label} limit at ${Math.round(pct * 100)}% — nearing your set limit`}
      </span>
    </div>
  )
}

const inputCls =
  'w-full bg-white/5 dark:bg-white/5 border border-gray-200 dark:border-white/15 hover:border-gray-300 dark:hover:border-white/30 focus:border-[#F97316] dark:focus:border-[#F97316] text-gray-900 dark:text-white rounded-lg px-3 py-2.5 text-sm outline-none transition-colors'

// ─── Main component ───────────────────────────────────────────────────────────
const LimitsPage: React.FC = () => {
  const { limits, isLoading: limitsLoading } = useLimits()
  const { profile } = useConsumerProfile()
  const { mutate: updateLimits, isPending: saving, isSuccess, isError, error } = useUpdateLimits()
  const [saved, setSaved] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: limits
      ? {
          daily_limit_sd: limits.daily_limit_sd,
          weekly_limit_sd: limits.weekly_limit_sd,
          monthly_limit_sd: limits.monthly_limit_sd,
        }
      : undefined,
  })

  const onSubmit = (values: FormValues) => {
    updateLimits(values, {
      onSuccess: () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      },
    })
  }

  // Mock current consumption — in production these come from a stats endpoint
  const todaySd = profile?.restrictions?.daily_limit_sd ? 0 : 0
  const weekSd = 0
  const monthSd = 0

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Self-Limits</h1>
        <p className="text-sm text-gray-400 dark:text-white/40 mt-1">
          Set your own alcohol consumption limits. Changes take effect immediately.
        </p>
      </div>

      {/* Gauge row */}
      {limits && (
        <div className="grid grid-cols-3 gap-4 bg-white dark:bg-[#0D2B22] rounded-2xl border border-gray-100 dark:border-white/10 p-5">
          <LimitGauge value={todaySd} max={limits.daily_limit_sd} label="Daily" />
          <LimitGauge value={weekSd} max={limits.weekly_limit_sd} label="Weekly" />
          <LimitGauge value={monthSd} max={limits.monthly_limit_sd} label="Monthly" />
        </div>
      )}

      {/* Alert bars */}
      {limits && (
        <div className="space-y-2">
          <AlertBar label="Daily" current={todaySd} max={limits.daily_limit_sd} />
          <AlertBar label="Weekly" current={weekSd} max={limits.weekly_limit_sd} />
          <AlertBar label="Monthly" current={monthSd} max={limits.monthly_limit_sd} />
        </div>
      )}

      {/* Limit form */}
      <div className="rounded-2xl bg-white dark:bg-[#0D2B22] border border-gray-100 dark:border-white/10 shadow-sm p-5">
        <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Your Limits (Standard Drinks)</h3>

        {limitsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-[#F97316] animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {[
              { key: 'daily_limit_sd' as const, label: 'Daily Limit', hint: 'WHO max: 2/day' },
              { key: 'weekly_limit_sd' as const, label: 'Weekly Limit', hint: 'WHO max: 14/week' },
              { key: 'monthly_limit_sd' as const, label: 'Monthly Limit', hint: 'e.g. 40/month' },
            ].map(({ key, label, hint }) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wide">{label}</label>
                  <span className="text-[10px] text-gray-300 dark:text-white/20">{hint}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    className={inputCls}
                    {...register(key, { valueAsNumber: true })}
                  />
                  <span className="text-xs text-gray-400 dark:text-white/30 whitespace-nowrap">std drinks</span>
                </div>
                {errors[key] && (
                  <p className="text-red-400 text-xs">{errors[key]?.message}</p>
                )}
              </div>
            ))}

            {isError && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                {(error as Error)?.message ?? 'Failed to save limits.'}
              </div>
            )}

            {saved && (
              <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                <CheckCircle className="w-3.5 h-3.5" />
                Limits saved successfully!
              </div>
            )}

            <button
              type="submit"
              disabled={saving || limits?.is_locked}
              className={[
                'w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all',
                saving || limits?.is_locked
                  ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-[#1A3C34] to-emerald-700 hover:from-emerald-700 hover:to-emerald-600 shadow-lg',
              ].join(' ')}
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : limits?.is_locked
                ? <><Save className="w-4 h-4" /> Limits are Locked</>
                : <><Save className="w-4 h-4" /> Save Limits</>
              }
            </button>

            {limits?.is_locked && (
              <p className="text-center text-xs text-amber-400">
                🔒 You've locked your limits. Unlock first to make changes.
              </p>
            )}
          </form>
        )}
      </div>

      {/* Standard drink guide */}
      <StandardDrinkGuide />

      {/* Self-restriction panel */}
      <SelfRestrictionPanel />
    </div>
  )
}

export default LimitsPage
