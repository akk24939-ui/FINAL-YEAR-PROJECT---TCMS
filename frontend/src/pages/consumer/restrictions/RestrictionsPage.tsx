/**
 * RestrictionsPage.tsx — Full self-restriction and teetotaler management.
 * Combines:
 *   - Teetotaler toggle (with confirm modal)
 *   - Self-restriction lock (lock limits for 1–365 days)
 *   - Display of active lock status + unlock countdown
 */
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldOff, Shield, Lock, Unlock, AlertTriangle,
  CheckCircle, Timer, Loader2, AlertCircle
} from 'lucide-react'
import { consumerApi } from '../../../api/consumer.api'
import type { SelfRestrictionData } from '../../../types/consumer.types'
import { useConsumerProfile, PROFILE_QUERY_KEY } from '../../../hooks/useConsumerProfile'

// ── Confirm Modal ─────────────────────────────────────────────────────────────
const ConfirmModal: React.FC<{
  title: string
  message: string
  confirmLabel: string
  confirmClass: string
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}> = ({ title, message, confirmLabel, confirmClass, onConfirm, onCancel, isPending }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">{message}</p>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isPending}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition ${confirmClass}`}
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : confirmLabel}
        </button>
      </div>
    </div>
  </div>
)

// ── Lock Duration Picker ──────────────────────────────────────────────────────
const DURATION_PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '60 days', days: 60 },
  { label: '90 days', days: 90 },
  { label: '180 days', days: 180 },
  { label: '1 year', days: 365 },
]

function formatCountdown(until?: string): string {
  if (!until) return ''
  const diff = new Date(until).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  if (days > 0) return `${days}d ${hours}h remaining`
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  return `${hours}h ${mins}m remaining`
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const RestrictionsPage: React.FC = () => {
  const qc = useQueryClient()
  const { profile, isLoading: profileLoading } = useConsumerProfile()
  const [teetotalerModal, setTeetotalerModal] = useState(false)
  const [lockModal, setLockModal] = useState(false)
  const [lockDays, setLockDays] = useState(30)
  const [lockReason, setLockReason] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  // Fetch self-restriction state
  const { data: restriction, isLoading: restrictionLoading } = useQuery<SelfRestrictionData>({
    queryKey: ['consumer-restriction'],
    queryFn: () => consumerApi.getLimits().then(r => ({
      daily_limit_sd: 0, weekly_limit_sd: 0, monthly_limit_sd: 0,
      is_locked: (r.data as any).is_locked ?? false,
      locked_until: (r.data as any).locked_until,
      pending_daily_limit_sd: undefined,
      pending_weekly_limit_sd: undefined,
      pending_monthly_limit_sd: undefined,
      lock_requested_at: undefined,
      lock_reason: undefined,
    })),
  })

  // Teetotaler mutations
  const { mutate: enableTeetotaler, isPending: enablingT } = useMutation({
    mutationFn: () => consumerApi.enableTeetotaler().then(r => r.data),
    onSuccess: (updated) => {
      qc.setQueryData(PROFILE_QUERY_KEY, updated)
      setTeetotalerModal(false)
      showSuccess('Teetotaler mode enabled. All purchases are now blocked.')
    },
  })

  const { mutate: disableTeetotaler, isPending: disablingT } = useMutation({
    mutationFn: () => consumerApi.disableTeetotaler().then(r => r.data),
    onSuccess: (updated) => {
      qc.setQueryData(PROFILE_QUERY_KEY, updated)
      setTeetotalerModal(false)
      showSuccess('Teetotaler mode disabled.')
    },
  })

  // Lock mutation
  const { mutate: lockLimits, isPending: locking } = useMutation({
    mutationFn: () => consumerApi.lockLimits({ lock_days: lockDays, lock_reason: lockReason || undefined }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consumer-restriction'] })
      qc.invalidateQueries({ queryKey: ['consumer-limits'] })
      setLockModal(false)
      showSuccess(`Limits locked for ${lockDays} days. They cannot be increased until the lock expires.`)
    },
  })

  const isLoading = profileLoading || restrictionLoading
  const isTeetotaler = profile?.is_teetotaler ?? false
  const isLocked = restriction?.is_locked ?? false

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <>
      {/* Modals */}
      {teetotalerModal && (
        <ConfirmModal
          title={isTeetotaler ? 'Disable Teetotaler Mode' : 'Enable Teetotaler Mode'}
          message={isTeetotaler
            ? 'This will re-enable alcohol purchases. Are you sure you want to disable teetotaler mode?'
            : 'This will BLOCK all future alcohol purchases. You can disable it later, but it takes effect immediately. Proceed?'
          }
          confirmLabel={isTeetotaler ? 'Disable' : 'Enable Teetotaler'}
          confirmClass={isTeetotaler ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'}
          onConfirm={() => isTeetotaler ? disableTeetotaler() : enableTeetotaler()}
          onCancel={() => setTeetotalerModal(false)}
          isPending={enablingT || disablingT}
        />
      )}

      {lockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Lock Limits</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              During the lock period, your limits cannot be increased.
            </p>
            {/* Duration presets */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {DURATION_PRESETS.map(p => (
                <button
                  key={p.days}
                  onClick={() => setLockDays(p.days)}
                  className={`py-2 rounded-xl text-xs font-semibold border transition ${
                    lockDays === p.days
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Custom days */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                Custom Duration: {lockDays} days
              </label>
              <input
                type="range" min={1} max={365} value={lockDays}
                onChange={e => setLockDays(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-600"
              />
            </div>
            {/* Reason */}
            <div className="mb-5">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                Reason (optional)
              </label>
              <input
                type="text"
                value={lockReason}
                onChange={e => setLockReason(e.target.value)}
                placeholder="e.g. Health commitment"
                maxLength={500}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setLockModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                Cancel
              </button>
              <button
                onClick={() => lockLimits()}
                disabled={locking}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition"
              >
                {locking ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4" /> Lock for {lockDays} days</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-xl mx-auto space-y-4">
        {/* Page header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            Restrictions &amp; Controls
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage teetotaler mode and self-restriction locks.
          </p>
        </div>

        {/* Success banner */}
        {successMsg && (
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <p className="text-sm font-medium text-green-800 dark:text-green-200">{successMsg}</p>
          </div>
        )}

        {/* Active lock banner */}
        {isLocked && (
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
            <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Limits are currently locked</p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5 flex items-center gap-1">
                <Timer className="w-3 h-3" />
                {formatCountdown(restriction?.locked_until)}
              </p>
            </div>
          </div>
        )}

        {/* Teetotaler card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isTeetotaler ? 'bg-red-100 dark:bg-red-900/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                <ShieldOff className={`w-5 h-5 ${isTeetotaler ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Teetotaler Mode</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-xs">
                  Permanently blocks all alcohol purchases when enabled.
                  Can be disabled anytime.
                </p>
                <div className="mt-2">
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                    isTeetotaler
                      ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}>
                    {isTeetotaler ? '🚫 Active' : '✅ Inactive'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setTeetotalerModal(true)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition ${
                isTeetotaler
                  ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/40'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {isTeetotaler ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>

        {/* Self-restriction lock card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLocked ? 'bg-blue-100 dark:bg-blue-900/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                {isLocked ? (
                  <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Unlock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Self-Restriction Lock</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-xs">
                  Lock your purchase limits for a fixed period.
                  While locked, limits cannot be increased.
                </p>
                {isLocked && restriction?.locked_until && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5 flex items-center gap-1 font-medium">
                    <Timer className="w-3 h-3" />
                    {formatCountdown(restriction.locked_until)}
                  </p>
                )}
              </div>
            </div>
            {!isLocked && (
              <button
                onClick={() => setLockModal(true)}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition"
              >
                <Lock className="w-4 h-4" /> Lock
              </button>
            )}
          </div>
        </div>

        {/* Info box */}
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Why use restrictions?</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
                Self-imposed restrictions help you stay within healthy drinking limits.
                These tools are designed to support responsible consumption and cannot be bypassed by shop operators.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default RestrictionsPage
