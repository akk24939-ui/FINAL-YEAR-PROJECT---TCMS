import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react'
import { authApi } from '../api/auth.api'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

const DEMO_CREDENTIALS = [
  { role: 'Admin', email: 'admin@tasmac.gov.in', password: 'Admin@1234' },
  { role: 'Consumer', email: 'consumer@test.com', password: 'Test@1234' },
  { role: 'Operator', email: 'operator@test.com', password: 'Test@1234' },
  { role: 'Doctor', email: 'doctor@test.com', password: 'Test@1234' },
  { role: 'Caretaker', email: 'caretaker@test.com', password: 'Test@1234' },
]

const ROLE_ROUTES: Record<string, string> = {
  ADMIN: '/admin',
  CONSUMER: '/consumer',
  OPERATOR: '/operator',
  DOCTOR: '/doctor',
  CARETAKER: '/caretaker',
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login(data)
      const { access_token, refresh_token, user_id, role, full_name } = res.data
      login({ id: user_id, full_name, email: data.email, role }, access_token, refresh_token)
      navigate(ROLE_ROUTES[role] || '/')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const cardBg = isDark ? 'rgba(13,31,26,0.95)' : 'white'
  const inputBg = isDark ? 'rgba(26,60,52,0.3)' : '#F9FAFB'
  const inputBorder = isDark ? '#374151' : '#D1D5DB'
  const textMain = isDark ? '#F0FDF4' : '#1A1A1A'
  const textSub = isDark ? '#9CA3AF' : '#6B7280'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: isDark ? 'linear-gradient(135deg, #0D1F1A 0%, #1A3C34 100%)' : 'linear-gradient(135deg, #F0FDF4 0%, #DCFCE7 100%)' }}>

      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: '#F97316' }} />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-10 blur-2xl"
          style={{ background: '#D4AF37' }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <span className="text-3xl font-black" style={{ color: '#F97316' }}>Smart TASMAC</span>
          </Link>
          <h1 className="text-2xl font-bold mb-2" style={{ color: textMain }}>Welcome Back</h1>
          <p style={{ color: textSub }}>Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 border shadow-2xl"
          style={{ background: cardBg, borderColor: isDark ? 'rgba(212,175,55,0.2)' : '#E5E7EB' }}>

          {error && (
            <div className="flex items-center gap-2 p-4 rounded-xl mb-6 border border-red-500/30 bg-red-500/10">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: textMain }}>
                Email Address
              </label>
              <input
                {...register('email')}
                type="email"
                placeholder="admin@tasmac.gov.in"
                className="w-full px-4 py-3 rounded-xl border outline-none transition-all focus:border-orange-400"
                style={{ background: inputBg, borderColor: inputBorder, color: textMain }}
                aria-label="Email address"
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: textMain }}>Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 rounded-xl border outline-none transition-all focus:border-orange-400"
                  style={{ background: inputBg, borderColor: inputBorder, color: textMain }}
                  aria-label="Password"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: textSub }}
                  aria-label="Toggle password visibility">
                  {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-white transition-all hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #1A3C34, #2D6A4F)' }}>
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><LogIn className="w-5 h-5" /> Sign In</>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t" style={{ borderColor: isDark ? '#374151' : '#E5E7EB' }}>
            <p className="text-xs font-semibold mb-3" style={{ color: textSub }}>🔑 Demo Credentials</p>
            <div className="space-y-1.5">
              {DEMO_CREDENTIALS.map((cred) => (
                <button key={cred.role} onClick={() => { setValue('email', cred.email); setValue('password', cred.password) }}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs transition-all hover:border-orange-400 border"
                  style={{ background: inputBg, borderColor: inputBorder, color: textSub }}>
                  <span className="font-semibold" style={{ color: '#F97316' }}>{cred.role}:</span>{' '}
                  {cred.email} / {cred.password}
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-sm mt-6" style={{ color: textSub }}>
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold hover:underline" style={{ color: '#F97316' }}>
              Register here
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
