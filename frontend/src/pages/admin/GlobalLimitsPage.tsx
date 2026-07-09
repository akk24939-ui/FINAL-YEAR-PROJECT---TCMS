/**
 * GlobalLimitsPage — Admin sets system-wide alcohol SD limits.
 * These caps apply to ALL consumers. Consumers cannot exceed them.
 */
import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings2, Save, AlertTriangle, Info, CheckCircle2, Loader2 } from 'lucide-react'
import { adminConfigApi } from '../../api/admin.api'

// 1 standard drink = 10g pure alcohol ≈ various ml equivalents
const SD_TO_ML = {
  beer_330ml: (sd: number) => (sd * 10 / 4.5 * 100 / 330 * 330).toFixed(0),
  wine_150ml: (sd: number) => (sd * 10 / 12 * 100 / 150 * 150).toFixed(0),
  spirits_30ml: (sd: number) => (sd * 10 / 40 * 100 / 30 * 30).toFixed(0),
}

const mlEquiv = (sd: number) =>
  `Beer ${Math.round(sd * 330 / 1.5)}ml · Wine ${Math.round(sd * 150 / 1.8)}ml · Spirits ${Math.round(sd * 30 / 0.9)}ml`

interface LimitSliderProps {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max: number
  color: string
}

const LimitSlider: React.FC<LimitSliderProps> = ({ label, value, onChange, min = 0, max, color }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          step={0.5}
          value={value}
          onChange={e => onChange(Math.min(max, Math.max(min, parseFloat(e.target.value) || 0)))}
          className="w-20 text-right bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm font-black text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-xs text-gray-400 font-semibold">SD</span>
      </div>
    </div>
    <div className="relative">
      <input
        type="range"
        min={min}
        max={max}
        step={0.5}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: color }}
      />
    </div>
    <p className="text-xs text-gray-400">{mlEquiv(value)}</p>
  </div>
)

const GlobalLimitsPage: React.FC = () => {
  const qc = useQueryClient()
  const [daily, setDaily] = useState(4)
  const [weekly, setWeekly] = useState(14)
  const [monthly, setMonthly] = useState(40)
  const [confirmed, setConfirmed] = useState(false)
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-global-limits'],
    queryFn: () => adminConfigApi.getLimits().then(r => r.data),
  })

  useEffect(() => {
    if (data) {
      setDaily(data.daily_limit_sd)
      setWeekly(data.weekly_limit_sd)
      setMonthly(data.monthly_limit_sd)
    }
  }, [data])

  const mutation = useMutation({
    mutationFn: () => adminConfigApi.updateLimits({ daily_limit_sd: daily, weekly_limit_sd: weekly, monthly_limit_sd: monthly }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-global-limits'] })
      setSaved(true)
      setConfirmed(false)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const hasChanges = data && (daily !== data.daily_limit_sd || weekly !== data.weekly_limit_sd || monthly !== data.monthly_limit_sd)

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
          <Settings2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Global Alcohol Limits</h1>
          <p className="text-sm text-gray-400 mt-1">These limits apply to <strong className="text-gray-600 dark:text-gray-300">all consumers</strong>. Individual consumer limits cannot exceed these system-wide caps.</p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl px-5 py-4 flex gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <p><strong>Standard Drink (SD)</strong> = 10g of pure alcohol ≈ one 330ml beer, 150ml wine, or 30ml spirits.</p>
          <p>WHO safe drinking guidelines: ≤ 2 SD/day for women, ≤ 3 SD/day for men. These are population-level defaults.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-8">
        <LimitSlider label="Daily Limit" value={daily} onChange={setDaily} max={20} color="#3b82f6" />
        <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
          <LimitSlider label="Weekly Limit" value={weekly} onChange={setWeekly} max={100} color="#8b5cf6" />
        </div>
        <div className="border-t border-gray-100 dark:border-gray-800 pt-6">
          <LimitSlider label="Monthly Limit" value={monthly} onChange={setMonthly} max={400} color="#06b6d4" />
        </div>
      </div>

      {/* Warning + confirm */}
      {hasChanges && !confirmed && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">This will affect ALL consumers</p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Changing global limits will immediately cap every consumer's personal limits to the new values. Consumers with higher personal limits will be silently capped.</p>
              <button onClick={() => setConfirmed(true)} className="mt-3 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition">
                I understand — confirm changes
              </button>
            </div>
          </div>
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-5 py-4 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
          <p className="text-sm font-semibold">Global limits updated successfully.</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => { if (data) { setDaily(data.daily_limit_sd); setWeekly(data.weekly_limit_sd); setMonthly(data.monthly_limit_sd) } setConfirmed(false) }}
          className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold text-sm transition"
        >
          Reset
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!confirmed || mutation.isPending}
          className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition"
        >
          {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Global Limits</>}
        </button>
      </div>
    </div>
  )
}

export default GlobalLimitsPage
