/**
 * ShopLoginPage — Shop Operator portal login via shop_code + 6-digit PIN.
 *
 * Distinct design: dark slate/red accent to differentiate from consumer (green)
 * and admin (navy blue) portals.
 */
import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, Eye, EyeOff, Loader2, AlertCircle, Sun, Moon, AlertTriangle } from 'lucide-react'
import { operatorAuthApi } from '../../api/operator.api'
import { useOperatorAuthStore } from '../../store/operatorAuthStore'
import { useTheme } from '../../hooks/useTheme'

const ShopLoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const setAuth = useOperatorAuthStore(s => s.setAuth)

  const [shopCode, setShopCode] = useState('')
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [showPin, setShowPin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])

  // PIN digit box handler
  const handlePinChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return
    const next = [...pin]
    next[i] = val.slice(-1)
    setPin(next)
    if (val && i < 5) pinRefs.current[i + 1]?.focus()
  }

  const handlePinKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[i] && i > 0) {
      pinRefs.current[i - 1]?.focus()
    }
  }

  const handlePinPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setPin(text.split(''))
      pinRefs.current[5]?.focus()
    }
    e.preventDefault()
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const pinStr = pin.join('')
    if (pinStr.length < 6) { setError('Enter all 6 PIN digits'); return }
    setError('')
    setLoading(true)
    try {
      const res = await operatorAuthApi.login(shopCode.trim().toUpperCase(), pinStr)
      const { access_token, shop, pin_rotation_warning } = res.data
      setAuth(access_token, shop, pin_rotation_warning ?? null)
      navigate('/shop', { replace: true })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail || 'Login failed. Check your shop code and PIN.')
      setPin(['', '', '', '', '', ''])
      pinRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 transition'

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 flex items-center justify-center p-4">
      {/* Theme toggle */}
      <button onClick={toggleTheme} className="fixed top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition">
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-600 shadow-lg shadow-red-600/30 mb-4">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Shop Operator Portal</h1>
          <p className="text-gray-500 text-sm mt-1">Smart TASMAC Consumer Regulation System</p>
        </div>

        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-6">Sign In</h2>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Shop Code */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">
                Shop Code
              </label>
              <input
                className={inputCls}
                type="text"
                placeholder="e.g. TN-CHN-001"
                value={shopCode}
                onChange={e => setShopCode(e.target.value.toUpperCase())}
                required
                autoComplete="username"
                autoFocus
              />
            </div>

            {/* PIN entry */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">6-Digit PIN</label>
                <button type="button" onClick={() => setShowPin(s => !s)} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1">
                  {showPin ? <><EyeOff className="w-3 h-3" /> Hide</> : <><Eye className="w-3 h-3" /> Show</>}
                </button>
              </div>
              <div className="flex gap-2" onPaste={handlePinPaste}>
                {pin.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => { pinRefs.current[i] = el }}
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handlePinChange(i, e.target.value)}
                    onKeyDown={e => handlePinKeyDown(i, e)}
                    className="w-full h-12 text-center text-xl font-black bg-gray-800/60 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition"
                  />
                ))}
              </div>
              <p className="text-[11px] text-gray-600 mt-1.5">You can paste a 6-digit PIN directly</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 px-3 py-2.5 rounded-xl border border-red-500/20">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 mt-2"
            >
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : 'Sign In to Shop Portal'}
            </button>
          </form>

          <div className="mt-6 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400/80">
              5 incorrect PIN attempts will lock this account for 15 minutes. Never share your PIN.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-700 mt-6">
          This portal is for authorised TASMAC shop operators only.
        </p>
      </div>
    </div>
  )
}

export default ShopLoginPage
