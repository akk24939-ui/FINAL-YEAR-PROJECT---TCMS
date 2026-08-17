import React, { useState } from 'react'
import { ChevronLeft, CheckCircle, Loader2, AlertCircle, LogIn, HelpCircle, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { consumerApi } from '../../../api/consumer.api'
import type { RegisterFinalRequest } from '../../../types/consumer.types'
import { getErrorMessage } from '../../../utils/getErrorMessage'

interface Props {
  formData: RegisterFinalRequest
  onSuccess: () => void
  onBack: () => void
}

const maskAadhaar = (num: string) => `XXXX XXXX ${num.slice(-4)}`

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-start justify-between py-3 border-b border-gray-200 dark:border-white/10 last:border-0">
    <span className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wide">{label}</span>
    <span className="text-sm text-gray-900 dark:text-white font-medium text-right max-w-[60%]">{value || '—'}</span>
  </div>
)

const StepD_Confirm: React.FC<Props> = ({ formData, onSuccess, onBack }) => {
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const handleRegister = async () => {
    setLoading(true)
    setError(null)
    try {
      await consumerApi.register(formData)
      setSuccess(true)
      onSuccess()
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Registration failed. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="p-8 sm:p-12 flex flex-col items-center gap-6 text-center">
        {/* Success animation */}
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center animate-bounce">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Account Created! 🎉</h2>
          <p className="text-gray-600 dark:text-white/60 text-sm">
            Welcome to Smart TASMAC. You can now sign in with your credentials.
          </p>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#F97316] to-orange-400 text-gray-900 dark:text-white font-bold text-sm shadow-lg hover:shadow-orange-500/25 transition-all"
        >
          <LogIn className="w-4 h-4" /> Sign In Now
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Confirm & Create Account</h2>
        <p className="text-sm text-gray-600 dark:text-white/60 mt-1">
          Review your details before submitting.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-gray-50/50 dark:bg-white/5 rounded-xl px-4 divide-y divide-white/10">
        <Row label="Full Name" value={formData.full_name} />
        {formData.email && <Row label="Email" value={formData.email} />}
        <Row label="Mobile" value={formData.mobile_number} />
        <Row label="Date of Birth" value={formData.dob} />
        <Row label="Gender" value={formData.gender} />
        <Row label="Aadhaar" value={maskAadhaar(formData.aadhaar_number)} />
        <Row label="District" value={formData.district} />
        {formData.address && <Row label="Address" value={formData.address} />}
      </div>

      {/* Terms checkbox */}
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded accent-orange-500 flex-shrink-0"
        />
        <span className="text-xs text-gray-600 dark:text-white/60 leading-relaxed">
          I confirm that the information provided is accurate. I agree to the{' '}
          <span className="text-[#F97316] underline cursor-pointer">Terms of Service</span> and{' '}
          <span className="text-[#F97316] underline cursor-pointer">Privacy Policy</span> of the
          Smart TASMAC Consumer Management System.
        </span>
      </label>

      {/* Error panel — shows specific reason from backend */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-red-500/20 border-b border-red-500/20">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-bold">Registration Failed</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400/60 hover:text-red-400 transition-colors"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Reason + help */}
          <div className="px-4 py-3 space-y-2">
            <p className="text-sm text-red-300 leading-snug">{error}</p>
            <div className="flex items-start gap-1.5 text-red-400/70">
              <HelpCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span className="text-xs leading-snug">
                {error.toLowerCase().includes('email')
                  ? 'Try signing in instead, or use a different email address.'
                  : error.toLowerCase().includes('mobile')
                    ? 'Use a different mobile number, or contact support if this is your number.'
                    : error.toLowerCase().includes('aadhaar')
                      ? 'Each Aadhaar card can only be linked to one account. Contact support if you believe this is an error.'
                      : 'Please check your details and try again. If the problem persists, contact support.'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-300 dark:border-white/20 text-gray-600 dark:text-white/70 hover:text-gray-900 dark:text-white hover:border-gray-400 dark:hover:border-white/40 text-sm font-semibold transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={handleRegister}
          disabled={!agreed || loading}
          className={[
            'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-gray-900 dark:text-white transition-all',
            !agreed || loading
              ? 'bg-gray-600 opacity-50 cursor-not-allowed'
              : 'bg-gradient-to-r from-[#1A3C34] to-emerald-700 hover:from-emerald-700 hover:to-emerald-600 shadow-lg',
          ].join(' ')}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Creating Account…
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" /> Create Account
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default StepD_Confirm
