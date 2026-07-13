/**
 * ShopLoginPage — Shop Operator / POS portal login.
 * Route: /login/shop
 *
 * Isolated from admin and consumer portals.
 * Posts to /api/v1/shop/auth/login (shop_code + 6-digit PIN).
 * Individual PIN digit boxes with auto-advance and paste support.
 * Shows must_change_password notice if operator must change password on first login.
 */
import React, { useState, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2, Store, AlertCircle, ShieldAlert } from 'lucide-react'
import { useOperatorAuthStore } from '../../store/operatorAuthStore'
import { operatorAuthApi } from '../../api/operator.api'

const PIN_LENGTH = 6

// ─── Component ────────────────────────────────────────────────────────────────
const ShopLoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { setAuth } = useOperatorAuthStore()

  const [shopCode, setShopCode] = useState('')
  const [pin, setPin] = useState<string[]>(Array(PIN_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // refs for PIN digit inputs
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])

  const pinString = pin.join('')

  // ── PIN input handlers ──────────────────────────────────────────────────────
  const handlePinChange = useCallback((index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newPin = [...pin]
    newPin[index] = value.slice(-1)
    setPin(newPin)
    if (value && index < PIN_LENGTH - 1) {
      pinRefs.current[index + 1]?.focus()
    }
  }, [pin])

  const handlePinKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs.current[index - 1]?.focus()
    }
  }, [pin])

  const handlePinPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH)
    const newPin = Array(PIN_LENGTH).fill('')
    pasted.split('').forEach((ch, i) => { newPin[i] = ch })
    setPin(newPin)
    const focusIdx = Math.min(pasted.length, PIN_LENGTH - 1)
    pinRefs.current[focusIdx]?.focus()
  }, [])

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shopCode.trim()) { setServerError('Enter your shop code.'); return }
    if (pinString.length !== PIN_LENGTH) { setServerError('Enter all 6 PIN digits.'); return }

    setLoading(true)
    setServerError(null)
    try {
      const resp = await operatorAuthApi.login(shopCode.trim().toUpperCase(), pinString)
      const data = resp.data
      setAuth(data.access_token, data.shop, data.pin_rotation_warning ?? null)

      // Feature 2: Redirect to forced change-password screen if flagged
      if (data.must_change_password) {
        navigate('/shop/change-password')
      } else {
        navigate('/shop')
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setServerError(msg ?? 'Invalid shop code or PIN. Please try again.')
      setPin(Array(PIN_LENGTH).fill(''))
      pinRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #1a0505 0%, #3b0a0a 50%, #1a0505 100%)' }}>

      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)' }}>
            <Store className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Shop Operator Portal</h1>
          <p className="text-white/50 text-sm mt-1">TASMAC Point of Sale — Verified Operators Only</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl shadow-2xl p-8"
          style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}>

          <h2 className="text-xl font-bold text-white mb-1">Operator Sign In</h2>
          <p className="text-sm text-white/40 mb-6">Enter your shop code and 6-digit PIN.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Shop Code */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                Shop Code
              </label>
              <input
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm font-mono uppercase tracking-widest outline-none transition-all focus:border-red-400 hover:border-white/30"
                placeholder="TSM-MAD-XXXXX"
                value={shopCode}
                onChange={e => setShopCode(e.target.value.toUpperCase())}
                autoComplete="username"
                autoCapitalize="characters"
              />
            </div>

            {/* PIN */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide">
                6-Digit PIN
              </label>
              <div className="flex gap-2 justify-between">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <input
                    key={i}
                    ref={el => { pinRefs.current[i] = el }}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={pin[i]}
                    onChange={e => handlePinChange(i, e.target.value)}
                    onKeyDown={e => handlePinKeyDown(i, e)}
                    onPaste={i === 0 ? handlePinPaste : undefined}
                    className="flex-1 h-12 text-center text-lg font-bold text-white rounded-xl border outline-none transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      borderColor: pin[i] ? 'rgba(220,38,38,0.7)' : 'rgba(255,255,255,0.12)',
                    }}
                    aria-label={`PIN digit ${i + 1}`}
                  />
                ))}
              </div>
              <p className="text-white/30 text-[11px]">
                Paste your 6-digit PIN or type digit by digit. Auto-advances between boxes.
              </p>
            </div>

            {/* Server error */}
            {serverError && (
              <div className="flex items-start gap-2 text-red-400 text-sm rounded-xl px-4 py-3"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {serverError}
              </div>
            )}

            {/* Security warning */}
            <div className="flex items-start gap-2 text-amber-400/80 text-xs rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              5 wrong PIN attempts will lock this account. Contact your administrator to reset.
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || pinString.length !== PIN_LENGTH || !shopCode.trim()}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, #b91c1c, #ef4444)',
                boxShadow: '0 4px 20px rgba(220,38,38,0.3)',
              }}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
              ) : (
                <><Store className="w-4 h-4" /> Operator Sign In</>
              )}
            </button>
          </form>
        </div>

        {/* Portal links */}
        <div className="mt-5 flex justify-center gap-4 text-xs text-white/25">
          <Link to="/login" className="hover:text-white/50 transition-colors">Consumer Portal</Link>
          <span>·</span>
          <Link to="/login/admin" className="hover:text-white/50 transition-colors">Admin Portal</Link>
        </div>
      </div>
    </div>
  )
}

export default ShopLoginPage
