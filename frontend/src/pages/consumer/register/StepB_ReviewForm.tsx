import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import type { OcrExtractResponse, RegisterFinalRequest, Gender, OcrConfidence } from '../../../types/consumer.types'

// ─── TN Districts ─────────────────────────────────────────────────────────────
const TN_DISTRICTS = [
  'Ariyalur','Chengalpattu','Chennai','Coimbatore','Cuddalore','Dharmapuri',
  'Dindigul','Erode','Kallakurichi','Kanchipuram','Kanyakumari','Karur',
  'Krishnagiri','Madurai','Mayiladuthurai','Nagapattinam','Namakkal','Nilgiris',
  'Perambalur','Pudukkottai','Ramanathapuram','Ranipet','Salem','Sivaganga',
  'Tenkasi','Thanjavur','Theni','Thoothukudi','Tiruchirappalli','Tirunelveli',
  'Tirupattur','Tiruppur','Tiruvallur','Tiruvannamalai','Tiruvarur','Vellore',
  'Viluppuram','Virudhunagar',
]

// ─── Age validation ───────────────────────────────────────────────────────────
const atLeast18 = (dobStr: string): boolean => {
  if (!dobStr) return false
  const dob = new Date(dobStr)
  const today = new Date()
  const age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  return age > 18 || (age === 18 && (m > 0 || (m === 0 && today.getDate() >= dob.getDate())))
}

// ─── Zod schema ───────────────────────────────────────────────────────────────
const schema = z.object({
  full_name: z.string().min(2, 'Full name is required').max(100),
  dob: z
    .string()
    .min(1, 'Date of birth is required')
    .refine(atLeast18, { message: 'You must be at least 18 years old to register.' }),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] as const),
  aadhaar_number: z
    .string()
    .regex(/^\d{12}$/, 'Aadhaar must be exactly 12 digits'),
  email: z.string().email('Enter a valid email address'),
  mobile_number: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  district: z.string().min(1, 'Please select a district'),
  address: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// ─── Confidence badge ─────────────────────────────────────────────────────────
const ConfidenceBadge: React.FC<{ score: number }> = ({ score }) => {
  const pct = Math.round(score)
  const color =
    pct >= 80
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      : pct >= 50
      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
      : 'bg-red-500/20 text-red-400 border-red-500/30'
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${color}`}>
      {pct >= 80 ? '✓' : '!'} {pct}%
    </span>
  )
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
interface FieldProps {
  label: string
  error?: string
  confidence?: number
  children: React.ReactNode
}

const Field: React.FC<FieldProps> = ({ label, error, confidence, children }) => {
  const lowConf = confidence !== undefined && confidence < 0.5
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-gray-600 dark:text-white/70 uppercase tracking-wide">{label}</label>
        {confidence !== undefined && <ConfidenceBadge score={confidence} />}
      </div>
      <div className={lowConf ? 'ring-1 ring-amber-400/60 rounded-lg' : ''}>{children}</div>
      {lowConf && (
        <p className="text-amber-400 text-[10px] flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> Low confidence — please verify this field carefully
        </p>
      )}
      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}

const inputCls =
  'w-full bg-gray-50/50 dark:bg-white/5 border border-gray-300 dark:border-white/15 hover:border-gray-400 dark:hover:border-white/30 focus:border-[#F97316] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors'
const selectCls =
  'w-full bg-gray-50 dark:bg-[#1A3C34] border border-gray-300 dark:border-white/15 hover:border-gray-400 dark:hover:border-white/30 focus:border-[#F97316] text-gray-900 dark:text-white rounded-lg px-3 py-2.5 text-sm outline-none transition-colors'

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  ocrData: OcrExtractResponse
  onComplete: (data: Partial<RegisterFinalRequest>) => void
  onBack: () => void
}

const StepB_ReviewForm: React.FC<Props> = ({ ocrData, onComplete, onBack }) => {
  const conf: OcrConfidence = ocrData.confidence

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: ocrData.full_name ?? '',
      dob: ocrData.dob ?? '',
      gender: (ocrData.gender as Gender) ?? 'MALE',
      aadhaar_number: ocrData.aadhaar_number ?? '',
      email: '',
      mobile_number: '',
      district: '',
      address: ocrData.address ?? '',
    },
  })

  const onSubmit = (values: FormValues) => {
    onComplete(values as Partial<RegisterFinalRequest>)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 sm:p-8 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Review Extracted Details</h2>
        <p className="text-sm text-gray-600 dark:text-white/60 mt-1">
          Fields with a confidence badge were auto-filled. Please verify highlighted fields.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Full name */}
        <Field label="Full Name" error={errors.full_name?.message} confidence={conf.full_name}>
          <input className={inputCls} {...register('full_name')} placeholder="Your full name" />
        </Field>

        {/* DOB */}
        <Field label="Date of Birth" error={errors.dob?.message} confidence={conf.dob}>
          <input type="date" className={inputCls} {...register('dob')} />
        </Field>

        {/* Gender */}
        <Field label="Gender" error={errors.gender?.message} confidence={conf.gender}>
          <select className={selectCls} {...register('gender')}>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
            <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
          </select>
        </Field>

        {/* Aadhaar */}
        <Field label="Aadhaar Number (12 digits)" error={errors.aadhaar_number?.message} confidence={conf.aadhaar_number}>
          <input
            className={inputCls}
            {...register('aadhaar_number')}
            placeholder="xxxx xxxx xxxx"
            maxLength={12}
            inputMode="numeric"
          />
        </Field>

        {/* Email */}
        <Field label="Email Address" error={errors.email?.message}>
          <input
            className={inputCls}
            {...register('email')}
            type="email"
            placeholder="you@example.com"
          />
        </Field>

        {/* Mobile */}
        <Field label="Mobile Number" error={errors.mobile_number?.message}>
          <input
            className={inputCls}
            {...register('mobile_number')}
            placeholder="10-digit number"
            inputMode="numeric"
            maxLength={10}
          />
        </Field>

        {/* District */}
        <Field label="District" error={errors.district?.message}>
          <select className={selectCls} {...register('district')}>
            <option value="">Select district…</option>
            {TN_DISTRICTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Address */}
      <Field label="Address (optional)" error={errors.address?.message} confidence={conf.address}>
        <textarea
          className={`${inputCls} resize-none`}
          {...register('address')}
          rows={2}
          placeholder="Door no, street, city…"
        />
      </Field>

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
          type="submit"
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#F97316] to-orange-400 hover:from-orange-500 hover:to-orange-300 text-gray-900 dark:text-white font-bold text-sm shadow-lg hover:shadow-orange-500/25 transition-all"
        >
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  )
}

export default StepB_ReviewForm
