/**
 * StepA_Manual.tsx — Manual consumer registration (no OCR).
 *
 * Collects all required fields directly from the user.
 * Produces an OcrExtractResponse-shaped object with zero confidence
 * so StepB_ReviewForm renders without confidence badges.
 */
import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronRight, UserCircle2 } from 'lucide-react'
import type { OcrExtractResponse, Gender } from '../../../types/consumer.types'

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
  full_name:     z.string().min(2, 'Full name is required').max(100),
  dob:           z.string().min(1, 'Date of birth is required')
                  .refine(atLeast18, { message: 'You must be at least 18 years old.' }),
  gender:        z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] as const),
  aadhaar_number: z.string().regex(/^\d{12}$/, 'Aadhaar must be exactly 12 digits'),
  email:         z.string().email('Enter a valid email address'),
  mobile_number: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  district:      z.string().min(1, 'Please select a district'),
  address:       z.string().optional(),
})
type FormValues = z.infer<typeof schema>

// ─── Styles ───────────────────────────────────────────────────────────────────
const inputCls =
  'w-full bg-gray-50/50 dark:bg-white/5 border border-gray-300 dark:border-white/15 hover:border-gray-400 dark:hover:border-white/30 focus:border-[#F97316] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors'
const selectCls =
  'w-full bg-gray-50 dark:bg-[#1A3C34] border border-gray-300 dark:border-white/15 hover:border-gray-400 dark:hover:border-white/30 focus:border-[#F97316] text-gray-900 dark:text-white rounded-lg px-3 py-2.5 text-sm outline-none transition-colors'

const FieldLabel: React.FC<{ label: string; required?: boolean; error?: string }> = ({ label, required, error }) => (
  <div className="space-y-1">
    <label className="text-xs font-semibold text-gray-600 dark:text-white/70 uppercase tracking-wide">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {error && <p className="text-red-400 text-xs">{error}</p>}
  </div>
)

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  onComplete: (data: OcrExtractResponse) => void
  onSwitchToOcr: () => void
}

const StepA_Manual: React.FC<Props> = ({ onComplete, onSwitchToOcr }) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = (values: FormValues) => {
    // Produce zero-confidence OcrExtractResponse so StepB doesn't show any badges
    const ocrShaped: OcrExtractResponse = {
      full_name:      values.full_name,
      dob:            values.dob,
      gender:         values.gender as Gender,
      aadhaar_number: values.aadhaar_number,
      address:        values.address ?? '',
      email:          values.email,
      mobile_number:  values.mobile_number,
      district:       values.district,
      confidence: {
        full_name:      100,  // manually typed = perfect confidence
        dob:            100,
        gender:         100,
        aadhaar_number: 100,
        address:        100,
      },
      raw_text: '',
      source: 'MANUAL',
    }
    onComplete(ocrShaped)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 sm:p-8 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Enter Your Details</h2>
        <p className="text-sm text-gray-600 dark:text-white/60 mt-1">
          Fill in your details manually. All fields marked <span className="text-red-400">*</span> are required.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Full name */}
        <div className="space-y-1">
          <FieldLabel label="Full Name" required error={errors.full_name?.message} />
          <input className={inputCls} placeholder="As on Aadhaar card" {...register('full_name')} />
        </div>

        {/* DOB */}
        <div className="space-y-1">
          <FieldLabel label="Date of Birth" required error={errors.dob?.message} />
          <input type="date" className={inputCls} {...register('dob')} />
        </div>

        {/* Gender */}
        <div className="space-y-1">
          <FieldLabel label="Gender" required error={errors.gender?.message} />
          <select className={selectCls} {...register('gender')}>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
            <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
          </select>
        </div>

        {/* Aadhaar */}
        <div className="space-y-1">
          <FieldLabel label="Aadhaar Number" required error={errors.aadhaar_number?.message} />
          <input
            className={inputCls}
            placeholder="12-digit Aadhaar number"
            inputMode="numeric"
            maxLength={12}
            {...register('aadhaar_number')}
          />
        </div>

        {/* Email */}
        <div className="space-y-1">
          <FieldLabel label="Email Address" required error={errors.email?.message} />
          <input type="email" className={inputCls} placeholder="you@example.com" {...register('email')} />
        </div>

        {/* Mobile */}
        <div className="space-y-1">
          <FieldLabel label="Mobile Number" required error={errors.mobile_number?.message} />
          <input
            className={inputCls}
            placeholder="10-digit mobile number"
            inputMode="numeric"
            maxLength={10}
            {...register('mobile_number')}
          />
        </div>

        {/* District */}
        <div className="space-y-1 sm:col-span-2">
          <FieldLabel label="District" required error={errors.district?.message} />
          <select className={selectCls} {...register('district')}>
            <option value="">Select district…</option>
            {TN_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-1">
        <FieldLabel label="Address (optional)" error={errors.address?.message} />
        <textarea
          className={`${inputCls} resize-none`}
          rows={2}
          placeholder="Door no, street, city…"
          {...register('address')}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-1">
        <button
          type="submit"
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-[#F97316] to-orange-400 hover:from-orange-500 hover:to-orange-300 text-gray-900 dark:text-white font-bold text-sm shadow-lg hover:shadow-orange-500/25 transition-all"
        >
          Review Details <ChevronRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onSwitchToOcr}
          className="w-full py-2.5 rounded-xl border border-gray-300 dark:border-white/20 text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-white/40 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <UserCircle2 className="w-4 h-4" />
          Switch to ID Card Upload (OCR)
        </button>
      </div>
    </form>
  )
}

export default StepA_Manual
