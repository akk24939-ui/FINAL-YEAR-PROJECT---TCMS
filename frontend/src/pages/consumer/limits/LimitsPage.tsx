/**
 * LimitsPage.tsx — Full purchase limits management.
 *
 * Features:
 *  - Current limits display cards (daily / weekly / monthly)
 *  - Slider-based edit form with real-time ml equivalents
 *  - Beverage preference multi-select chips
 *  - Advisory cross-limit warnings (from API + local cross-validation)
 *  - Lock banner when self-restriction is active
 *  - WHO advisory reference panel
 *  - Save with inline success/error feedback (no toast dependency)
 */
import React, { useState, useEffect } from 'react'
import {
  Settings2, Save, Lock, Info, AlertTriangle,
  CheckCircle, Loader2, RefreshCw,
} from 'lucide-react'
import { useLimits, useUpdateLimits } from '../../../hooks/useLimits'
import type { BeverageChoice, ConsumerLimitsResponse } from '../../../types/consumer.types'

// ── Constants ─────────────────────────────────────────────────────────────────

const BEER_ML_PER_SD = 330
const WINE_ML_PER_SD = 150
const SPIRITS_ML_PER_SD = 40

const BEVERAGE_CHIPS: { value: BeverageChoice; label: string; emoji: string }[] = [
  { value: 'BEER', label: 'Beer', emoji: '🍺' },
  { value: 'WINE', label: 'Wine', emoji: '🍷' },
  { value: 'SPIRITS', label: 'Spirits', emoji: '🥃' },
  { value: 'MIXED', label: 'Mixed', emoji: '🍹' },
]

const WHO_DAILY = 2.0
const WHO_WEEKLY = 14.0

// ── Helpers ───────────────────────────────────────────────────────────────────

function sdToMl(sd: number) {
  return {
    beer: Math.round(sd * BEER_ML_PER_SD),
    wine: Math.round(sd * WINE_ML_PER_SD),
    spirits: Math.round(sd * SPIRITS_ML_PER_SD),
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Current limit display card */
const LimitCard: React.FC<{
  label: string
  value: number
  max: number
  suffix: string
  color: string
}> = ({ label, value, max, suffix, color }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700/50 p-4 flex flex-col gap-2">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      {value > 0 ? (
        <>
          <p className="text-2xl font-black text-gray-900 dark:text-gray-100">
            {value.toFixed(1)}
            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 ml-1">SD</span>
          </p>
          <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500">{suffix}</p>
        </>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">No limit set</p>
      )}
    </div>
  )
}

/** Styled slider */
const LimitSlider: React.FC<{
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  warnHigh?: boolean
  disabled?: boolean
}> = ({ label, value, min, max, onChange, warnHigh, disabled }) => {
  const ml = sdToMl(value)
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</label>
        <div className="flex items-center gap-2">
          {warnHigh && value > 0 && (
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
              ⚠ Cross-limit
            </span>
          )}
          <span className={`text-lg font-black ${value === 0 ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
            {value === 0 ? 'None' : `${value.toFixed(1)} SD`}
          </span>
        </div>
      </div>

      {/* Slider track */}
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={0.5}
          value={value}
          disabled={disabled}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer accent-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: disabled
              ? '#e5e7eb'
              : `linear-gradient(to right, #3b82f6 ${pct}%, #e5e7eb ${pct}%)`,
          }}
        />
      </div>

      {/* ml equivalents */}
      {value > 0 && (
        <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">🍺 <strong className="text-gray-700 dark:text-gray-300">{ml.beer} ml</strong> beer</span>
          <span className="flex items-center gap-1">🍷 <strong className="text-gray-700 dark:text-gray-300">{ml.wine} ml</strong> wine</span>
          <span className="flex items-center gap-1">🥃 <strong className="text-gray-700 dark:text-gray-300">{ml.spirits} ml</strong> spirits</span>
        </div>
      )}
      {value === 0 && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">
          Slide to set a limit. Set to 0 for no limit (unlimited).
        </p>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const LimitsPage: React.FC = () => {
  const { limits, isLoading, error, refetch } = useLimits()
  const { mutate: saveLimits, isPending: saving } = useUpdateLimits()

  // Form state (mirrors API values)
  const [daily, setDaily] = useState(0)
  const [weekly, setWeekly] = useState(0)
  const [monthly, setMonthly] = useState(0)
  const [beverages, setBeverages] = useState<BeverageChoice[]>([])
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Sync form with server data
  useEffect(() => {
    if (limits) {
      setDaily(limits.daily_limit_sd)
      setWeekly(limits.weekly_limit_sd)
      setMonthly(limits.monthly_limit_sd)
      setBeverages(limits.beverage_preference ?? [])
    }
  }, [limits])

  // Local cross-limit advisory (informational only)
  const warnWeekly = weekly > 0 && daily > 0 && daily * 7 > weekly
  const warnMonthly = monthly > 0 && weekly > 0 && weekly * 4 > monthly

  const toggleBeverage = (b: BeverageChoice) => {
    setBeverages(prev =>
      prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]
    )
  }

  const handleSave = () => {
    setSaveError('')
    saveLimits(
      { daily_limit_sd: daily, weekly_limit_sd: weekly, monthly_limit_sd: monthly, beverage_preference: beverages },
      {
        onSuccess: () => {
          setSaved(true)
          setTimeout(() => setSaved(false), 3000)
        },
        onError: (err: Error) => {
          setSaveError(err.message || 'Failed to save limits. Please try again.')
        },
      }
    )
  }

  const isLocked = limits?.is_locked ?? false

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-28 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="font-semibold text-gray-900 dark:text-gray-100">Failed to load limits</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 transition"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Purchase Limits
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Set your daily, weekly, and monthly alcohol purchase limits.
          </p>
        </div>
      </div>

      {/* Active lock banner */}
      {isLocked && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
          <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Limits are locked</p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
              Your self-restriction is active. Limits cannot be changed until it expires.
              Manage it on the <strong>Restrictions</strong> page.
            </p>
          </div>
        </div>
      )}

      {/* Current limits overview */}
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Current Limits
        </p>
        <div className="grid grid-cols-3 gap-3">
          <LimitCard label="Daily" value={limits?.daily_limit_sd ?? 0} max={20} suffix="per day" color="bg-blue-500" />
          <LimitCard label="Weekly" value={limits?.weekly_limit_sd ?? 0} max={60} suffix="per week" color="bg-purple-500" />
          <LimitCard label="Monthly" value={limits?.monthly_limit_sd ?? 0} max={200} suffix="per month" color="bg-indigo-500" />
        </div>
      </div>

      {/* Edit form */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-6">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          Adjust Limits
          {isLocked && <Lock className="w-3.5 h-3.5 text-blue-500" />}
        </h2>

        {/* Daily slider */}
        <LimitSlider
          label="Daily Limit"
          value={daily}
          min={0}
          max={20}
          onChange={setDaily}
          disabled={isLocked}
        />

        <div className="h-px bg-gray-100 dark:bg-gray-800" />

        {/* Weekly slider */}
        <LimitSlider
          label="Weekly Limit"
          value={weekly}
          min={0}
          max={60}
          onChange={setWeekly}
          warnHigh={warnWeekly}
          disabled={isLocked}
        />

        <div className="h-px bg-gray-100 dark:bg-gray-800" />

        {/* Monthly slider */}
        <LimitSlider
          label="Monthly Limit"
          value={monthly}
          min={0}
          max={200}
          onChange={setMonthly}
          warnHigh={warnMonthly}
          disabled={isLocked}
        />

        <div className="h-px bg-gray-100 dark:bg-gray-800" />

        {/* Beverage preference */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Beverage Preferences</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Select all beverages you typically consume. This helps display accurate ml equivalents.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {BEVERAGE_CHIPS.map(chip => (
              <button
                key={chip.value}
                type="button"
                onClick={() => toggleBeverage(chip.value)}
                disabled={isLocked}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all',
                  beverages.includes(chip.value)
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-600',
                  isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                ].join(' ')}
              >
                <span>{chip.emoji}</span>
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Advisory warnings */}
        {(warnWeekly || warnMonthly || limits?.warn_weekly_vs_daily || limits?.warn_monthly_vs_weekly) && !isLocked && (
          <div className="space-y-2">
            {(warnWeekly || limits?.warn_weekly_vs_daily) && (
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                Your daily limit × 7 exceeds your weekly limit. Consider aligning them for consistency.
              </div>
            )}
            {(warnMonthly || limits?.warn_monthly_vs_weekly) && (
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                Your weekly limit × 4 exceeds your monthly limit. Consider aligning them.
              </div>
            )}
          </div>
        )}

        {/* Save feedback */}
        {saved && (
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300 text-sm bg-green-50 dark:bg-green-900/10 px-4 py-3 rounded-xl border border-green-200 dark:border-green-800">
            <CheckCircle className="w-4 h-4 flex-shrink-0" /> Limits saved successfully!
          </div>
        )}
        {saveError && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/10 px-4 py-3 rounded-xl border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {saveError}
          </div>
        )}

        {/* Save button */}
        {!isLocked && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <><Save className="w-4 h-4" /> Save Limits</>
            }
          </button>
        )}
      </div>

      {/* WHO Advisory panel */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100">WHO Advisory Guidelines</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/60 dark:bg-blue-900/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{WHO_DAILY}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-0.5">SD / day max</p>
          </div>
          <div className="bg-white/60 dark:bg-blue-900/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-blue-700 dark:text-blue-300">{WHO_WEEKLY}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-0.5">SD / week max</p>
          </div>
        </div>
        {/* Standard drink table */}
        <div className="space-y-1.5 text-xs text-blue-800 dark:text-blue-200">
          <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">1 Standard Drink (SD) equals:</p>
          {[
            { emoji: '🍺', label: 'Beer (4–5%)', ml: '330 ml' },
            { emoji: '🍷', label: 'Wine (12–14%)', ml: '150 ml' },
            { emoji: '🥃', label: 'Spirits (40%)', ml: '40 ml' },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between bg-white/50 dark:bg-blue-900/20 rounded-lg px-3 py-1.5">
              <span>{row.emoji} {row.label}</span>
              <span className="font-bold">{row.ml}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default LimitsPage
