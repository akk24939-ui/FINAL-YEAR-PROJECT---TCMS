import React, { useState, useEffect } from 'react'
import { Lock, Unlock, Clock, AlertCircle, Loader2, CheckCircle, X } from 'lucide-react'
import { useLimits, useLockLimits, useConfirmIncrease } from '../../../hooks/useLimits'

// ─── Countdown hook ───────────────────────────────────────────────────────────
function useCountdown(targetIso: string | undefined): { days: number; hours: number; minutes: number; seconds: number; expired: boolean } {
  const calc = () => {
    if (!targetIso) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
    const diff = new Date(targetIso).getTime() - Date.now()
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
    const s = Math.floor(diff / 1000)
    return {
      days: Math.floor(s / 86400),
      hours: Math.floor((s % 86400) / 3600),
      minutes: Math.floor((s % 3600) / 60),
      seconds: s % 60,
      expired: false,
    }
  }
  const [cd, setCd] = useState(calc)
  useEffect(() => {
    if (!targetIso) return
    const id = setInterval(() => setCd(calc()), 1000)
    return () => clearInterval(id)
  }, [targetIso])
  return cd
}

// ─── Lock Modal ───────────────────────────────────────────────────────────────
interface LockModalProps {
  onConfirm: (days: number, reason: string) => void
  onClose: () => void
  loading: boolean
}

const LockModal: React.FC<LockModalProps> = ({ onConfirm, onClose, loading }) => {
  const [days, setDays] = useState(30)
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-[#0D2B22] border border-white/10 shadow-2xl p-6 space-y-5">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">Lock My Limits</h3>
            <p className="text-xs text-white/40">Prevent limit increases for a set period</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wide">Lock Duration (days)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/15 focus:border-[#F97316] text-white rounded-lg px-3 py-2.5 text-sm outline-none"
            />
            <p className="text-[10px] text-white/30">1–365 days</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-white/50 uppercase tracking-wide">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Health goal"
              className="w-full bg-white/5 border border-white/15 focus:border-[#F97316] text-white rounded-lg px-3 py-2.5 text-sm outline-none placeholder-white/20"
            />
          </div>
        </div>

        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <p className="text-red-400 text-xs leading-relaxed">
            ⚠️ Once locked, you cannot increase your limits for <strong>{days} day{days !== 1 ? 's' : ''}</strong>.
            Decreasing limits is always allowed.
          </p>
        </div>

        <button
          onClick={() => onConfirm(days, reason)}
          disabled={loading || days < 1}
          className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Locking…</> : <><Lock className="w-4 h-4" /> Lock Limits</>}
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
const SelfRestrictionPanel: React.FC = () => {
  const { limits, isLoading } = useLimits()
  const { mutate: lockLimits, isPending: lockPending } = useLockLimits()
  const { mutate: confirmIncrease, isPending: confirmPending } = useConfirmIncrease()
  const [lockModal, setLockModal] = useState(false)

  const lockCd = useCountdown(limits?.locked_until)
  const cooloffCd = useCountdown(
    limits?.lock_requested_at
      ? new Date(new Date(limits.lock_requested_at).getTime() + 24 * 60 * 60 * 1000).toISOString()
      : undefined
  )

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white dark:bg-[#0D2B22] border border-gray-100 dark:border-white/10 p-6 flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 text-[#F97316] animate-spin" />
      </div>
    )
  }

  if (!limits) return null

  const isLocked = limits.is_locked && !lockCd.expired
  const hasPendingIncrease =
    limits.pending_daily_limit_sd !== undefined ||
    limits.pending_weekly_limit_sd !== undefined ||
    limits.pending_monthly_limit_sd !== undefined

  return (
    <>
      {lockModal && (
        <LockModal
          loading={lockPending}
          onClose={() => setLockModal(false)}
          onConfirm={(days, reason) => {
            lockLimits({ lock_days: days, lock_reason: reason })
            setLockModal(false)
          }}
        />
      )}

      <div className="rounded-2xl bg-white dark:bg-[#0D2B22] border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/10">
          <h3 className="text-sm font-bold text-gray-800 dark:text-white">Self-Restriction Lock</h3>
          <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">
            Lock your limits to prevent accidental increases. You can always decrease them.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Locked state */}
          {isLocked && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-red-400" />
                <span className="text-sm font-bold text-red-400">Limits Locked</span>
              </div>
              {limits.lock_reason && (
                <p className="text-xs text-white/50">Reason: {limits.lock_reason}</p>
              )}
              <div className="flex items-center gap-4 text-center">
                {[
                  { label: 'Days', val: lockCd.days },
                  { label: 'Hours', val: lockCd.hours },
                  { label: 'Minutes', val: lockCd.minutes },
                  { label: 'Seconds', val: lockCd.seconds },
                ].map((unit) => (
                  <div key={unit.label} className="flex-1">
                    <div className="text-xl font-black text-red-400 font-mono">
                      {String(unit.val).padStart(2, '0')}
                    </div>
                    <div className="text-[10px] text-white/30 uppercase">{unit.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-white/30 text-center">
                Unlocks: {limits.locked_until ? new Date(limits.locked_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
              </p>
            </div>
          )}

          {/* Pending increase */}
          {hasPendingIncrease && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-bold text-amber-400">Increase Requested — Cooling Off</span>
              </div>
              <p className="text-xs text-white/50">
                A 24-hour cooling-off period is required before your limit increase takes effect.
              </p>
              {!cooloffCd.expired ? (
                <div className="flex items-center gap-4 text-center">
                  {[
                    { label: 'Hours', val: cooloffCd.hours },
                    { label: 'Minutes', val: cooloffCd.minutes },
                    { label: 'Seconds', val: cooloffCd.seconds },
                  ].map((unit) => (
                    <div key={unit.label} className="flex-1">
                      <div className="text-xl font-black text-amber-400 font-mono">
                        {String(unit.val).padStart(2, '0')}
                      </div>
                      <div className="text-[10px] text-white/30 uppercase">{unit.label}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => confirmIncrease()}
                  disabled={confirmPending}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {confirmPending
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirming…</>
                    : <><CheckCircle className="w-4 h-4" /> Confirm Increase Now</>
                  }
                </button>
              )}
            </div>
          )}

          {/* Not locked */}
          {!isLocked && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 dark:bg-white/5">
              <Unlock className="w-4 h-4 text-gray-400 dark:text-white/30 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-700 dark:text-white">Limits are unlocked</p>
                <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">
                  Lock them to prevent yourself from raising them impulsively.
                </p>
              </div>
              <button
                onClick={() => setLockModal(true)}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
              >
                <Lock className="w-3 h-3" /> Lock
              </button>
            </div>
          )}

          {!isLocked && !hasPendingIncrease && (
            <div className="flex items-start gap-2 text-xs text-gray-400 dark:text-white/30">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              Any request to increase a locked limit requires a 24-hour cooling-off period.
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default SelfRestrictionPanel
