import React, { useState } from 'react'
import { ChevronLeft, CheckCircle, Loader2, AlertCircle, LogIn } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { consumerApi } from '../../../api/consumer.api'
import type { RegisterFinalRequest } from '../../../types/consumer.types'

interface Props {
  formData: RegisterFinalRequest
  onSuccess: () => void
  onBack: () => void
}

const maskAadhaar = (num: string) => `XXXX XXXX ${num.slice(-4)}`

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-start justify-between py-3 border-b border-white/10 last:border-0">
    <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">{label}</span>
    <span className="text-sm text-white font-medium text-right max-w-[60%]">{value || '—'}</span>
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
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Registration failed. Please try again.')
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
          <h2 className="text-2xl font-bold text-white mb-2">Account Created! 🎉</h2>
          <p className="text-white/60 text-sm">
            Welcome to Smart TASMAC. You can now sign in with your credentials.
          </p>
        </div>
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#F97316] to-orange-400 text-white font-bold text-sm shadow-lg hover:shadow-orange-500/25 transition-all"
        >
          <LogIn className="w-4 h-4" /> Sign In Now
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Confirm & Create Account</h2>
        <p className="text-sm text-white/60 mt-1">
          Review your details before submitting.
        </p>
      </div>

      {/* Summary */}
      <div className="bg-white/5 rounded-xl px-4 divide-y divide-white/10">
        <Row label="Full Name" value={formData.full_name} />
        <Row label="Email" value={formData.email} />
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
        <span className="text-xs text-white/60 leading-relaxed">
          I confirm that the information provided is accurate. I agree to the{' '}
          <span className="text-[#F97316] underline cursor-pointer">Terms of Service</span> and{' '}
          <span className="text-[#F97316] underline cursor-pointer">Privacy Policy</span> of the
          Smart TASMAC Consumer Management System.
        </span>
      </label>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

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
          onClick={handleRegister}
          disabled={!agreed || loading}
          className={[
            'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all',
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
