/**
 * ShopLoginPage — Shop Operator / POS portal login.
 * Route: /login/shop
 *
 * Full light + dark mode support.
 * Brand colour: Red (TASMAC POS).
 * Separate from admin and consumer portals.
 */
import React, { useState, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Loader2, Store, AlertCircle, ShieldAlert, Sun, Moon } from 'lucide-react'
import { useOperatorAuthStore } from '../../store/operatorAuthStore'
import { operatorAuthApi } from '../../api/operator.api'
import { useTheme } from '../../hooks/useTheme'
import { getErrorMessage } from '../../utils/getErrorMessage'

const PIN_LENGTH = 6

const ShopLoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { setAuth } = useOperatorAuthStore()
  const { theme, toggleTheme } = useTheme()

  const [shopCode, setShopCode] = useState('')
  const [pin, setPin] = useState<string[]>(Array(PIN_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const pinRefs = useRef<(HTMLInputElement | null)[]>([])
  const pinString = pin.join('')

  // ── PIN handlers ─────────────────────────────────────────────────────────────
  const handlePinChange = useCallback((index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newPin = [...pin]
    newPin[index] = value.slice(-1)
    setPin(newPin)
    if (value && index < PIN_LENGTH - 1) pinRefs.current[index + 1]?.focus()
  }, [pin])

  const handlePinKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) pinRefs.current[index - 1]?.focus()
  }, [pin])

  const handlePinPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH)
    const newPin = Array(PIN_LENGTH).fill('')
    pasted.split('').forEach((ch, i) => { newPin[i] = ch })
    setPin(newPin)
    pinRefs.current[Math.min(pasted.length, PIN_LENGTH - 1)]?.focus()
  }, [])

  // ── Submit ───────────────────────────────────────────────────────────────────
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
      if (data.must_change_password) {
        navigate('/shop/change-password')
      } else {
        navigate('/shop')
      }
    } catch (err: unknown) {
      setServerError(getErrorMessage(err, 'Invalid shop code or PIN. Please try again.'))
      setPin(Array(PIN_LENGTH).fill(''))
      pinRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    /* ── Page wrapper — light: warm white, dark: deep charcoal ─────────────── */
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 transition-colors duration-300">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shadow-md shadow-red-600/30">
            <Store className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-gray-900 dark:text-white text-sm tracking-tight">
            TASMAC <span className="text-red-600">POS</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500 font-medium">Shop Operator Portal</span>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">

          {/* Brand badge */}
          <div className="text-center mb-8">
            <div className="inline-flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-red-600 shadow-lg shadow-red-600/25 flex items-center justify-center">
                <Store className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                  Operator Sign In
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  TASMAC Point of Sale — Verified Operators Only
                </p>
              </div>
            </div>
          </div>

          {/* Card */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-800 p-8">

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Shop Code */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                  Shop Code
                </label>
                <input
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm font-mono uppercase tracking-widest outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500/20 hover:border-gray-300 dark:hover:border-gray-600"
                  placeholder="TSM-MAD-XXXXX"
                  value={shopCode}
                  onChange={e => setShopCode(e.target.value.toUpperCase())}
                  autoComplete="username"
                  autoCapitalize="characters"
                />
              </div>

              {/* 6-digit PIN boxes */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                  6-Digit PIN
                </label>
                <div className="grid grid-cols-6 gap-2">
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
                      className={[
                        'w-full h-12 text-center text-xl font-bold rounded-xl border outline-none transition-all',
                        'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white',
                        pin[i]
                          ? 'border-red-500 ring-2 ring-red-500/20 dark:border-red-500'
                          : 'border-gray-200 dark:border-gray-700 focus:border-red-400 focus:ring-2 focus:ring-red-500/20',
                      ].join(' ')}
                      aria-label={`PIN digit ${i + 1}`}
                    />
                  ))}
                </div>
                <p className="text-gray-400 dark:text-gray-500 text-[11px]">
                  Type digit-by-digit or paste your 6-digit PIN. Auto-advances between boxes.
                </p>
              </div>

              {/* Server error */}
              {serverError && (
                <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {serverError}
                </div>
              )}

              {/* Security note */}
              <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400 text-xs bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-3 py-2.5">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                5 wrong PIN attempts will lock this account. Contact your administrator to reset.
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || pinString.length !== PIN_LENGTH || !shopCode.trim()}
                className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-red-300 dark:disabled:bg-red-900/50 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 hover:shadow-red-600/30 transition-all duration-200"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                  : <><Store className="w-4 h-4" /> Operator Sign In</>
                }
              </button>
            </form>
          </div>

          {/* Portal links */}
          <div className="mt-6 flex justify-center items-center gap-4 text-xs text-gray-400 dark:text-gray-600">
            <Link to="/login" className="hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
              Consumer Portal
            </Link>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            <Link to="/login/admin" className="hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
              Admin Portal
            </Link>
          </div>
        </div>
      </main>

      {/* ── Footer strip ─────────────────────────────────────────────────────── */}
      <footer className="py-3 text-center text-[11px] text-gray-400 dark:text-gray-600 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        Tamil Nadu State Marketing Corporation · Authorised Personnel Only
      </footer>
    </div>
  )
}

export default ShopLoginPage
