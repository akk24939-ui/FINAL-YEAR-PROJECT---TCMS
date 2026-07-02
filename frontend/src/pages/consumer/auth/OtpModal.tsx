import React, { useRef, useState, useEffect, useCallback } from 'react'
import { X, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { authApi } from '../../../api/auth.api'

interface Props {
  mobileNumber: string
  onVerified: () => void
  onClose: () => void
}

const OTP_LENGTH = 6
const TIMER_SECONDS = 60

const OtpModal: React.FC<Props> = ({ mobileNumber, onVerified, onClose }) => {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [timer, setTimer] = useState(TIMER_SECONDS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Countdown timer
  useEffect(() => {
    if (timer <= 0) return
    const id = setInterval(() => setTimer((t) => t - 1), 1000)
    return () => clearInterval(id)
  }, [timer])

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const focusNext = (index: number) => {
    if (index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus()
  }

  const focusPrev = (index: number) => {
    if (index > 0) inputRefs.current[index - 1]?.focus()
  }

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const next = [...digits]
    next[index] = value
    setDigits(next)
    if (value) focusNext(index)
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index]) focusPrev(index)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    const next = Array(OTP_LENGTH).fill('')
    pasted.split('').forEach((d, i) => (next[i] = d))
    setDigits(next)
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus()
  }

  const handleSubmit = useCallback(async () => {
    const code = digits.join('')
    if (code.length < OTP_LENGTH) {
      setError('Please enter all 6 digits')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const ok = await authApi.verifyOtp(mobileNumber, code)
      if (ok) {
        onVerified()
      } else {
        setError('Incorrect OTP. Please try again.')
        setDigits(Array(OTP_LENGTH).fill(''))
        inputRefs.current[0]?.focus()
      }
    } catch {
      setError('Verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [digits, mobileNumber, onVerified])

  const handleResend = async () => {
    setResending(true)
    setError(null)
    try {
      await authApi.sendOtp(mobileNumber)
      setTimer(TIMER_SECONDS)
      setDigits(Array(OTP_LENGTH).fill(''))
      inputRefs.current[0]?.focus()
    } catch {
      setError('Failed to resend OTP. Please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-[#0D2B22] border border-white/10 shadow-2xl p-6 space-y-5">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F97316]/10 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-[#F97316]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Verify OTP</h3>
            <p className="text-sm text-white/50 mt-0.5">
              Sent to <span className="text-white/80 font-medium">{mobileNumber}</span>
            </p>
          </div>
        </div>

        {/* Digit inputs */}
        <div className="flex gap-2 justify-center" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={[
                'w-10 h-12 text-center text-xl font-bold rounded-xl border outline-none transition-all',
                'bg-white/5 text-white',
                d
                  ? 'border-[#F97316] shadow-md shadow-orange-500/20'
                  : 'border-white/20 focus:border-[#F97316]',
              ].join(' ')}
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>

        {/* Timer */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm font-mono font-bold" style={{ color: timer > 0 ? '#F97316' : '#6B7280' }}>
            {formatTime(timer)}
          </span>
          <span className="text-xs text-white/40">remaining</span>
        </div>

        {/* Error */}
        {error && (
          <p className="text-center text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg py-2 px-3">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || digits.join('').length < OTP_LENGTH}
          className={[
            'w-full py-3 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2',
            loading || digits.join('').length < OTP_LENGTH
              ? 'bg-gray-600 opacity-50 cursor-not-allowed'
              : 'bg-gradient-to-r from-[#F97316] to-orange-400 hover:from-orange-500 hover:to-orange-300 shadow-lg',
          ].join(' ')}
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : 'Verify OTP'}
        </button>

        {/* Resend */}
        <div className="text-center">
          <button
            onClick={handleResend}
            disabled={timer > 0 || resending}
            className={[
              'text-xs font-semibold flex items-center gap-1.5 mx-auto transition-colors',
              timer > 0 || resending
                ? 'text-white/30 cursor-not-allowed'
                : 'text-[#F97316] hover:text-orange-300',
            ].join(' ')}
          >
            <RefreshCw className={`w-3 h-3 ${resending ? 'animate-spin' : ''}`} />
            {resending ? 'Resending…' : timer > 0 ? `Resend OTP in ${formatTime(timer)}` : 'Resend OTP'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default OtpModal
