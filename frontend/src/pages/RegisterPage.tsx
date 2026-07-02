import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { consumerApi } from '../api/consumer.api'
import { useThemeStore } from '../store/themeStore'
import { Users, ShoppingBag, BarChart3, Stethoscope, Shield, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react'

const step1Schema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  district: z.string().optional(),
})

const step2Schema = z.object({
  aadhaar_number: z.string()
    .length(12, 'Aadhaar must be exactly 12 digits')
    .regex(/^[2-9]\d{11}$/, 'Aadhaar must start with 2-9 and be 12 digits'),
})

const roles = [
  { value: 'CONSUMER', label: 'Consumer', tamil: 'நுகர்வோர்', icon: <Users className="w-5 h-5" />, desc: 'Track purchases & set limits' },
  { value: 'OPERATOR', label: 'Shop Operator', tamil: 'கடை இயக்குநர்', icon: <ShoppingBag className="w-5 h-5" />, desc: 'Manage shop & record sales' },
  { value: 'ADMIN', label: 'Govt. Admin', tamil: 'நிர்வாகி', icon: <BarChart3 className="w-5 h-5" />, desc: 'District analytics & reports' },
  { value: 'DOCTOR', label: 'Doctor', tamil: 'மருத்துவர்', icon: <Stethoscope className="w-5 h-5" />, desc: 'Anonymous health analytics' },
  { value: 'CARETAKER', label: 'Caretaker', tamil: 'பராமரிப்பாளர்', icon: <Shield className="w-5 h-5" />, desc: 'Monitor linked consumer' },
]

const districts = ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Tiruppur', 'Erode', 'Vellore', 'Thanjavur']

const RegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const [step, setStep] = useState(1)
  const [selectedRole, setSelectedRole] = useState('CONSUMER')
  const [formData, setFormData] = useState<any>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register: reg1, handleSubmit: hs1, formState: { errors: e1 } } = useForm({ resolver: zodResolver(step1Schema) })
  const { register: reg2, handleSubmit: hs2, formState: { errors: e2 } } = useForm({ resolver: zodResolver(step2Schema) })

  const textMain = isDark ? '#F0FDF4' : '#1A1A1A'
  const textSub = isDark ? '#9CA3AF' : '#6B7280'
  const cardBg = isDark ? 'rgba(13,31,26,0.95)' : 'white'
  const inputBg = isDark ? 'rgba(26,60,52,0.3)' : '#F9FAFB'
  const inputBorder = isDark ? '#374151' : '#D1D5DB'

  const onStep1 = (data: any) => { setFormData({ ...formData, ...data }); setStep(2) }
  const onStep2 = (data: any) => { setFormData({ ...formData, ...data }); setStep(3) }

  const onSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      const payload = { ...formData, role: selectedRole }
      await consumerApi.register(payload)
      // Registration succeeded — redirect to login
      navigate('/login?registered=1')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = `w-full px-4 py-3 rounded-xl border outline-none transition-all focus:border-orange-400`

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: isDark ? 'linear-gradient(135deg, #0D1F1A, #1A3C34)' : 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' }}>
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <span className="text-2xl font-black" style={{ color: '#F97316' }}>Smart TASMAC</span>
          </Link>
          <h1 className="text-2xl font-bold mb-2" style={{ color: textMain }}>Create Your Account</h1>

          {/* Step indicators */}
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all`}
                  style={{
                    background: step >= s ? '#1A3C34' : isDark ? '#374151' : '#E5E7EB',
                    color: step >= s ? 'white' : textSub,
                  }}>
                  {step > s ? <CheckCircle className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <ChevronRight className="w-4 h-4" style={{ color: textSub }} />}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-8 mt-2 text-xs" style={{ color: textSub }}>
            <span style={{ color: step >= 1 ? '#F97316' : undefined }}>Personal Info</span>
            <span style={{ color: step >= 2 ? '#F97316' : undefined }}>Aadhaar</span>
            <span style={{ color: step >= 3 ? '#F97316' : undefined }}>Role & Confirm</span>
          </div>
        </div>

        <div className="rounded-2xl p-8 border shadow-2xl"
          style={{ background: cardBg, borderColor: isDark ? 'rgba(212,175,55,0.2)' : '#E5E7EB' }}>

          {error && (
            <div className="flex items-center gap-2 p-4 rounded-xl mb-6 border border-red-500/30 bg-red-500/10">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Step 1: Personal Info */}
          {step === 1 && (
            <form onSubmit={hs1(onStep1)} className="space-y-4">
              <h2 className="font-bold text-lg mb-4" style={{ color: textMain }}>Personal Information</h2>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: textMain }}>Full Name *</label>
                <input {...reg1('full_name')} placeholder="Your full name" aria-label="Full name"
                  className={inputClass} style={{ background: inputBg, borderColor: inputBorder, color: textMain }} />
                {e1.full_name && <p className="text-red-400 text-xs mt-1">{e1.full_name.message as string}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: textMain }}>Email Address *</label>
                <input {...reg1('email')} type="email" placeholder="your@email.com" aria-label="Email"
                  className={inputClass} style={{ background: inputBg, borderColor: inputBorder, color: textMain }} />
                {e1.email && <p className="text-red-400 text-xs mt-1">{e1.email.message as string}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: textMain }}>Password *</label>
                <input {...reg1('password')} type="password" placeholder="Min 8 characters" aria-label="Password"
                  className={inputClass} style={{ background: inputBg, borderColor: inputBorder, color: textMain }} />
                {e1.password && <p className="text-red-400 text-xs mt-1">{e1.password.message as string}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: textMain }}>Phone Number</label>
                <input {...reg1('phone')} placeholder="+91 XXXXXXXXXX" aria-label="Phone"
                  className={inputClass} style={{ background: inputBg, borderColor: inputBorder, color: textMain }} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: textMain }}>District</label>
                <select {...reg1('district')} aria-label="District"
                  className={inputClass} style={{ background: inputBg, borderColor: inputBorder, color: textMain }}>
                  <option value="">Select district</option>
                  {districts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 hover:scale-105 transition-all"
                style={{ background: 'linear-gradient(135deg, #1A3C34, #2D6A4F)' }}>
                Next <ChevronRight className="w-5 h-5" />
              </button>
            </form>
          )}

          {/* Step 2: Mock Aadhaar */}
          {step === 2 && (
            <form onSubmit={hs2(onStep2)} className="space-y-4">
              <h2 className="font-bold text-lg mb-1" style={{ color: textMain }}>Mock Aadhaar Verification</h2>
              <div className="p-3 rounded-xl border border-amber-400/30" style={{ background: 'rgba(212,175,55,0.08)' }}>
                <p className="text-xs" style={{ color: '#D4AF37' }}>
                  ⚠️ This is a DEMO platform. Enter any 12-digit number starting with 2-9. No real Aadhaar data is stored.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: textMain }}>Aadhaar Number (12 digits) *</label>
                <input {...reg2('aadhaar_number')} placeholder="XXXX XXXX XXXX" maxLength={12} aria-label="Aadhaar number"
                  className={inputClass} style={{ background: inputBg, borderColor: inputBorder, color: textMain }} />
                {e2.aadhaar_number && <p className="text-red-400 text-xs mt-1">{e2.aadhaar_number.message as string}</p>}
                <p className="text-xs mt-1" style={{ color: textSub }}>Example: 234567890123 (starts with 2-9)</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 py-3.5 rounded-xl font-bold border transition-all"
                  style={{ borderColor: inputBorder, color: textSub }}>
                  Back
                </button>
                <button type="submit" className="flex-1 py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 hover:scale-105 transition-all"
                  style={{ background: 'linear-gradient(135deg, #1A3C34, #2D6A4F)' }}>
                  Next <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Role Selection */}
          {step === 3 && (
            <div>
              <h2 className="font-bold text-lg mb-4" style={{ color: textMain }}>Select Your Role</h2>
              <div className="space-y-3 mb-6">
                {roles.map(role => (
                  <button key={role.value} type="button"
                    onClick={() => setSelectedRole(role.value)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left"
                    style={{
                      background: selectedRole === role.value ? 'rgba(26,60,52,0.3)' : inputBg,
                      borderColor: selectedRole === role.value ? '#F97316' : inputBorder,
                      boxShadow: selectedRole === role.value ? '0 0 20px rgba(249,115,22,0.15)' : 'none',
                    }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: selectedRole === role.value ? '#1A3C34' : 'transparent', color: selectedRole === role.value ? 'white' : textSub, border: `1px solid ${inputBorder}` }}>
                      {role.icon}
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: textMain }}>{role.label}</p>
                      <p className="text-xs" style={{ color: '#F97316', fontFamily: 'Noto Serif Tamil, serif' }}>{role.tamil}</p>
                      <p className="text-xs" style={{ color: textSub }}>{role.desc}</p>
                    </div>
                    {selectedRole === role.value && <CheckCircle className="w-5 h-5 ml-auto flex-shrink-0" style={{ color: '#F97316' }} />}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-3.5 rounded-xl font-bold border transition-all"
                  style={{ borderColor: inputBorder, color: textSub }}>
                  Back
                </button>
                <button onClick={onSubmit} disabled={loading}
                  className="flex-1 py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 hover:scale-105 transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #1A3C34, #2D6A4F)' }}>
                  {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Account'}
                </button>
              </div>
            </div>
          )}

          <p className="text-center text-sm mt-6" style={{ color: textSub }}>
            Already have an account?{' '}
            <Link to="/login" className="font-semibold hover:underline" style={{ color: '#F97316' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
