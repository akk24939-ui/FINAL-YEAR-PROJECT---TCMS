/**
 * ScanAndSellPage — 5-step operator workflow with THREE scan methods:
 *   Mode 1: 📷 Camera (html5-qrcode — live camera scan)
 *   Mode 2: 📋 Paste  (paste QR JSON from clipboard — auto-wraps missing braces)
 *   Mode 3: 🔢 Manual (type consumer ID directly, for hardware scanner output)
 *
 * Steps: Scan QR → Eligibility → Product → Confirm → Receipt
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Html5Qrcode } from 'html5-qrcode'
import {
  ScanLine, Search, ShoppingCart, CheckCircle2, AlertTriangle,
  XCircle, ChevronRight, RotateCcw, Loader2, Package,
  User, ShieldOff, Ban, Gauge, CalendarClock, BadgeCheck,
  Camera, ClipboardPaste, Hash, CameraOff,
} from 'lucide-react'
import { operatorConsumerApi, operatorProductsApi, operatorPurchaseApi } from '../../api/operator.api'
import type { ConsumerLookupResult, Product } from '../../types/operator.types'

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = 'scan' | 'eligibility' | 'product' | 'confirm' | 'receipt'
type ScanMode = 'camera' | 'paste' | 'manual'

const STEPS: { id: Step; label: string }[] = [
  { id: 'scan',        label: 'Scan QR'    },
  { id: 'eligibility', label: 'Eligibility'},
  { id: 'product',     label: 'Product'    },
  { id: 'confirm',     label: 'Confirm'    },
  { id: 'receipt',     label: 'Receipt'    },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Auto-wraps raw QR text in { } if missing, handles copy-paste from QR display */
const normalizeQrPayload = (raw: string): string => {
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) return trimmed
  // QR scanner may return plain text without braces
  if (trimmed.startsWith('"uid"')) return `{${trimmed}}`
  return trimmed
}

// ─── LimitBar ─────────────────────────────────────────────────────────────────
const LimitBar: React.FC<{ label: string; pct: number }> = ({ label, pct }) => {
  const colour = pct >= 90 ? 'bg-red-500' : pct >= 65 ? 'bg-amber-500' : 'bg-emerald-500'
  const textCol = pct >= 90 ? 'text-red-400' : pct >= 65 ? 'text-amber-400' : 'text-emerald-400'
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <span className={`font-bold ${textCol}`}>{Math.min(pct, 100).toFixed(0)}%</span>
      </div>
      <div className="h-2.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colour}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ eligible: boolean; label: string }> = ({ eligible, label }) => (
  <span className={`
    inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border
    ${eligible
      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
      : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'}
  `}>
    {eligible ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
    {label}
  </span>
)

// ─── Camera Scanner Sub-Component ─────────────────────────────────────────────
const CameraScanner: React.FC<{ onScan: (payload: string) => void; onError: (msg: string) => void }> = ({ onScan, onError }) => {
  const [started, setStarted]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [camError, setCamError] = useState('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const mountedRef = useRef(true)

  const startCamera = useCallback(async () => {
    setLoading(true); setCamError('')
    try {
      const scanner = new Html5Qrcode('qr-camera-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          if (mountedRef.current) {
            onScan(normalizeQrPayload(decoded))
          }
        },
        () => { /* ignore non-QR frames */ }
      )
      if (mountedRef.current) setStarted(true)
    } catch (err) {
      const msg = String(err)
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setCamError('Camera permission denied. Please allow camera access in your browser and try again.')
      } else if (msg.includes('NotFound')) {
        setCamError('No camera found on this device. Use Paste or Manual mode instead.')
      } else {
        setCamError('Could not start camera. Use Paste mode to enter the QR payload.')
      }
      if (mountedRef.current) onError(camError)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [onScan, onError, camError])

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch { /* ignore */ }
      scannerRef.current = null
    }
    if (mountedRef.current) setStarted(false)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopCamera()
    }
  }, [stopCamera])

  return (
    <div className="space-y-4">
      {/* Camera viewport */}
      <div
        id="qr-camera-reader"
        className="w-full rounded-xl overflow-hidden bg-black"
        style={{ minHeight: started ? 280 : 0, display: started ? 'block' : 'none' }}
      />

      {!started && !loading && (
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 p-8 text-center">
          <Camera className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Camera QR Scanner</p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mb-4">
            Point the camera at the consumer's QR code. Works on phone & desktop.
          </p>
          {camError && (
            <p className="text-xs text-red-500 dark:text-red-400 mb-4 bg-red-50 dark:bg-red-500/10 px-3 py-2 rounded-lg">{camError}</p>
          )}
          <button
            onClick={startCamera}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition"
          >
            <Camera className="w-4 h-4" /> Open Camera
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Starting camera…</span>
        </div>
      )}

      {started && (
        <button
          onClick={stopCamera}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-semibold transition"
        >
          <CameraOff className="w-4 h-4" /> Stop Camera
        </button>
      )}

      {started && (
        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          Scanning — align the QR code in the viewfinder. Detection is automatic.
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const ScanAndSellPage: React.FC = () => {
  const [step, setStep]               = useState<Step>('scan')
  const [scanMode, setScanMode]       = useState<ScanMode>('camera')
  const [qrInput, setQrInput]         = useState('')
  const [manualId, setManualId]       = useState('')
  const [consumer, setConsumer]       = useState<ConsumerLookupResult | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [productSearch, setProductSearch]     = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [receipt, setReceipt] = useState<{
    purchase_id: string; standard_drinks: number
    remaining_daily_ml: number; approaching_limit: boolean
  } | null>(null)
  const [lookupError, setLookupError] = useState('')

  // Product catalogue
  const { data: productsData } = useQuery({
    queryKey: ['operator-products'],
    queryFn: () => operatorProductsApi.list().then(r => r.data),
    staleTime: 5 * 60_000,
  })

  const products = productsData?.products ?? []
  const categories = ['All', ...Array.from(new Set(products.map(p => p.category))).sort()]
  const filteredProducts = products.filter(p =>
    (selectedCategory === 'All' || p.category === selectedCategory) &&
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  )

  // Consumer lookup
  const lookupMutation = useMutation({
    mutationFn: (payload: string) => operatorConsumerApi.lookupByQR(payload),
    onSuccess: (res) => { setConsumer(res.data); setLookupError(''); setStep('eligibility') },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setLookupError(detail || 'Invalid or expired QR code. Ask the consumer to refresh their QR.')
    },
  })

  // Record purchase
  const recordMutation = useMutation({
    mutationFn: () => operatorPurchaseApi.record({
      consumer_user_id: consumer!.consumer_user_id,
      product_name: selectedProduct!.name,
      quantity_ml: selectedProduct!.volume_ml,
      price: selectedProduct!.price,
      alcohol_pct: selectedProduct!.alcohol_pct,
      product_id: selectedProduct!.id,
    }),
    onSuccess: (res) => { setReceipt(res.data); setStep('receipt') },
  })

  const handleQrScanned = useCallback((payload: string) => {
    setLookupError('')
    lookupMutation.mutate(payload)
  }, [lookupMutation])

  const reset = () => {
    setStep('scan'); setQrInput(''); setManualId(''); setConsumer(null)
    setSelectedProduct(null); setProductSearch(''); setSelectedCategory('All')
    setReceipt(null); setLookupError('')
  }

  const cardCls = 'bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6'
  const inputCls = 'w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 transition'
  const stepIdx = STEPS.findIndex(s => s.id === step)

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Scan & Sell</h1>
        <p className="text-sm text-gray-500 mt-1">Verify customer eligibility via QR, then record the sale</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className={`flex items-center gap-1.5 ${
              step === s.id ? 'text-gray-900 dark:text-white'
              : stepIdx > i ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-gray-400 dark:text-gray-600'}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                step === s.id ? 'bg-red-600 text-white'
                : stepIdx > i ? 'bg-emerald-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800'}`}
              >
                {stepIdx > i ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className="text-xs font-semibold hidden sm:block">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1.5 ${stepIdx > i ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-800'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── STEP 1: Scan QR ─────────────────────────────────────────────────── */}
      {step === 'scan' && (
        <div className={`${cardCls} space-y-5`}>

          {/* Mode tabs */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
            {([
              { id: 'camera' as ScanMode, icon: Camera,          label: 'Camera'       },
              { id: 'paste'  as ScanMode, icon: ClipboardPaste,  label: 'Paste QR'     },
              { id: 'manual' as ScanMode, icon: Hash,            label: 'Manual ID'    },
            ] as const).map(m => (
              <button
                key={m.id}
                onClick={() => { setScanMode(m.id); setLookupError('') }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                  scanMode === m.id
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <m.icon className="w-3.5 h-3.5" />
                {m.label}
              </button>
            ))}
          </div>

          {/* ── Camera mode ── */}
          {scanMode === 'camera' && (
            <>
              <CameraScanner
                onScan={handleQrScanned}
                onError={setLookupError}
              />
              {lookupMutation.isPending && (
                <div className="flex items-center gap-2 justify-center text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying consumer…
                </div>
              )}
            </>
          )}

          {/* ── Paste mode ── */}
          {scanMode === 'paste' && (
            <>
              <div>
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-1.5">
                  QR Code Payload
                </label>
                <textarea
                  className={`${inputCls} h-32 resize-none font-mono text-xs`}
                  placeholder={'Paste the QR payload here.\nAccepted formats:\n  {"uid":"...","iat":...,"exp":...,"sig":"..."}\n  OR just paste what the QR scanner gives you.'}
                  value={qrInput}
                  onChange={e => setQrInput(e.target.value)}
                  onPaste={e => {
                    // Auto-submit on paste for fast workflow
                    const pasted = e.clipboardData.getData('text')
                    if (pasted.trim()) {
                      e.preventDefault()
                      const normalized = normalizeQrPayload(pasted)
                      setQrInput(normalized)
                    }
                  }}
                />
                <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1">
                  💡 The consumer shows their QR on phone. Scan it with a USB barcode scanner → it types into this box automatically.
                  Missing <code>{'{}'}</code> braces are auto-added.
                </p>
              </div>

              <button
                onClick={() => lookupMutation.mutate(normalizeQrPayload(qrInput.trim()))}
                disabled={!qrInput.trim() || lookupMutation.isPending}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition"
              >
                {lookupMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying…</>
                  : <>Verify Customer <ChevronRight className="w-4 h-4" /></>}
              </button>
            </>
          )}

          {/* ── Manual ID mode ── */}
          {scanMode === 'manual' && (
            <>
              <div className="space-y-3">
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-4 py-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    ⚠️ Manual override — use only if the consumer's QR is unavailable.
                    Ask the consumer for their registered <strong>Consumer ID</strong> from the app.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest block mb-1.5">
                    Consumer User ID (UUID)
                  </label>
                  <input
                    className={`${inputCls} font-mono`}
                    placeholder="e.g. c60c9977-527d-409b-87e9-9e033b586196"
                    value={manualId}
                    onChange={e => setManualId(e.target.value.trim())}
                  />
                  <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1">
                    Found in the consumer's app under Profile → Consumer ID.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  // Build a manual lookup payload — wraps UUID as QR-style payload
                  // The backend consumer/lookup endpoint accepts user ID directly
                  const fakeQr = JSON.stringify({
                    uid: manualId,
                    iat: Math.floor(Date.now() / 1000),
                    exp: Math.floor(Date.now() / 1000) + 1800,
                    manual: true,
                  })
                  lookupMutation.mutate(fakeQr)
                }}
                disabled={!manualId.trim() || lookupMutation.isPending}
                className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition"
              >
                {lookupMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Looking up…</>
                  : <>Look Up Consumer <ChevronRight className="w-4 h-4" /></>}
              </button>
            </>
          )}

          {/* Error display */}
          {lookupError && (
            <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-500/10 px-3 py-2.5 rounded-xl border border-red-200 dark:border-red-500/20">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{lookupError}</p>
                {lookupError.includes('expired') && (
                  <p className="text-xs mt-1 text-red-500 dark:text-red-500">
                    Ask the consumer to open their TASMAC app → QR Code page → tap "Refresh QR"
                  </p>
                )}
              </div>
            </div>
          )}

          {/* How-to help box */}
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl px-4 py-3 space-y-1.5">
            <p className="text-xs font-bold text-blue-700 dark:text-blue-400">📖 How to scan</p>
            <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
              <li><strong>Camera</strong> — Click "Open Camera", point at QR on consumer's phone. Auto-detects.</li>
              <li><strong>Paste QR</strong> — Use a USB barcode scanner (it types the QR data here) or paste manually.</li>
              <li><strong>Manual ID</strong> — Ask consumer for their UUID from the app (Profile page) if QR unavailable.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── STEP 2: ELIGIBILITY SCREEN ──────────────────────────────────────── */}
      {step === 'eligibility' && consumer && (
        <div className="space-y-4">
          {/* Overall status banner */}
          {!consumer.can_purchase ? (
            <div className="flex items-center gap-3 bg-red-600 rounded-2xl p-4 text-white shadow-lg shadow-red-600/20">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Ban className="w-6 h-6" />
              </div>
              <div>
                <p className="font-black text-lg leading-tight">SALE BLOCKED</p>
                <p className="text-sm text-red-100">
                  {consumer.is_teetotaler
                    ? 'Registered teetotaler — no alcohol purchase permitted'
                    : 'Daily limit reached — no further purchase allowed today'}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-emerald-600 rounded-2xl p-4 text-white shadow-lg shadow-emerald-600/20">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <BadgeCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="font-black text-lg leading-tight">ELIGIBLE TO PURCHASE</p>
                <p className="text-sm text-emerald-100">Consumer is verified and within daily limits</p>
              </div>
            </div>
          )}

          {/* Consumer identity card */}
          <div className={cardCls}>
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-gray-900 dark:text-white text-lg leading-tight">{consumer.full_name}</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">
                  {consumer.aadhaar_masked ?? 'XXXX-XXXX-XXXX'} · {consumer.district}
                </p>
              </div>
              <StatusBadge eligible={consumer.can_purchase} label={consumer.can_purchase ? 'Eligible' : 'Blocked'} />
            </div>

            {/* Restriction flags */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={`rounded-xl px-4 py-3 border ${consumer.is_teetotaler ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldOff className={`w-4 h-4 ${consumer.is_teetotaler ? 'text-red-500' : 'text-gray-400'}`} />
                  <span className={`text-xs font-bold ${consumer.is_teetotaler ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>Teetotaler</span>
                </div>
                <p className={`text-sm font-black ${consumer.is_teetotaler ? 'text-red-700 dark:text-red-300' : 'text-gray-400 dark:text-gray-500'}`}>
                  {consumer.is_teetotaler ? 'YES — Blocked' : 'No'}
                </p>
              </div>

              <div className={`rounded-xl px-4 py-3 border ${!consumer.can_purchase && !consumer.is_teetotaler ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Ban className={`w-4 h-4 ${!consumer.can_purchase && !consumer.is_teetotaler ? 'text-amber-500' : 'text-gray-400'}`} />
                  <span className={`text-xs font-bold ${!consumer.can_purchase && !consumer.is_teetotaler ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}`}>Self-Restriction</span>
                </div>
                <p className={`text-sm font-black ${!consumer.can_purchase && !consumer.is_teetotaler ? 'text-amber-700 dark:text-amber-300' : 'text-gray-400 dark:text-gray-500'}`}>
                  {!consumer.can_purchase && !consumer.is_teetotaler ? 'Active' : 'None'}
                </p>
              </div>
            </div>

            {/* Consumption meters */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Consumption Status</span>
              </div>
              <LimitBar label={`Daily: ${consumer.today_consumed_ml.toFixed(0)} ml of ${consumer.daily_limit_ml} ml`} pct={consumer.daily_pct_used} />
              <LimitBar
                label={`Weekly: ${(consumer.week_consumed_ml ?? 0).toFixed(0)} ml of ${consumer.weekly_limit_ml} ml`}
                pct={consumer.weekly_limit_ml > 0 ? ((consumer.week_consumed_ml ?? 0) / consumer.weekly_limit_ml) * 100 : 0}
              />
            </div>

            {/* Remaining stats */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <CalendarClock className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Remaining Today</span>
                </div>
                <p className={`text-xl font-black ${consumer.remaining_daily_ml > 300 ? 'text-emerald-600 dark:text-emerald-400' : consumer.remaining_daily_ml > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                  {consumer.remaining_daily_ml.toFixed(0)} ml
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <CalendarClock className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Remaining Week</span>
                </div>
                <p className={`text-xl font-black ${(consumer.remaining_weekly_ml ?? 0) > 500 ? 'text-emerald-600 dark:text-emerald-400' : (consumer.remaining_weekly_ml ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                  {(consumer.remaining_weekly_ml ?? 0).toFixed(0)} ml
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-bold transition">
              ← Scan Again
            </button>
            {consumer.can_purchase && (
              <button onClick={() => setStep('product')} className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-red-600/20">
                Proceed to Sale <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 3: Product Selection ────────────────────────────────────────── */}
      {step === 'product' && consumer && (
        <div className="space-y-4">
          <div className={`${cardCls} py-3 flex items-center justify-between`}>
            <div>
              <p className="font-bold text-sm text-gray-900 dark:text-white">{consumer.full_name}</p>
              <p className="text-xs text-gray-400">{consumer.remaining_daily_ml.toFixed(0)} ml remaining today</p>
            </div>
            <StatusBadge eligible={true} label="Eligible" />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition ${selectedCategory === cat ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-red-400'}`}>
                {cat}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className={`${inputCls} pl-9`} placeholder="Search products…" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
            {filteredProducts.length === 0 && <div className="col-span-2 text-center py-8 text-gray-400 text-sm">No products found.</div>}
            {filteredProducts.map(p => {
              const canAfford = p.volume_ml <= consumer.remaining_daily_ml
              return (
                <button key={p.id}
                  onClick={() => { if (canAfford) { setSelectedProduct(p); setStep('confirm') } }}
                  disabled={!canAfford}
                  className={`text-left p-3.5 rounded-xl border transition ${!canAfford ? 'opacity-40 cursor-not-allowed border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-red-400 dark:hover:border-red-500/50 hover:bg-red-50/50 dark:hover:bg-gray-800'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{p.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.category} · {p.volume_ml}ml · {p.alcohol_pct}%</p>
                    </div>
                    <span className="text-sm font-black text-red-600 dark:text-red-400 whitespace-nowrap">₹{p.price}</span>
                  </div>
                  {!canAfford && <p className="text-[10px] text-red-500 mt-1">Exceeds remaining daily limit</p>}
                </button>
              )
            })}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('eligibility')} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold transition">← Back</button>
            <button onClick={reset} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm font-semibold transition">Start Over</button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Confirm ──────────────────────────────────────────────────── */}
      {step === 'confirm' && consumer && selectedProduct && (
        <div className={`${cardCls} space-y-5`}>
          <h2 className="font-bold text-gray-900 dark:text-white text-lg">Confirm Sale</h2>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
              <Package className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-bold text-gray-900 dark:text-white">{selectedProduct.name}</p>
                <p className="text-xs text-gray-400">{selectedProduct.category} · {selectedProduct.volume_ml}ml · {selectedProduct.alcohol_pct}% ABV</p>
              </div>
              <span className="ml-auto text-xl font-black text-gray-900 dark:text-white">₹{selectedProduct.price}</span>
            </div>
            {[
              ['Customer', consumer.full_name],
              ['Aadhaar', consumer.aadhaar_masked ?? '—'],
              ['Remaining after sale', `${Math.max(0, consumer.remaining_daily_ml - selectedProduct.volume_ml).toFixed(0)} ml`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-gray-400">{k}</span>
                <span className="text-gray-900 dark:text-white font-semibold">{v}</span>
              </div>
            ))}
          </div>

          {(consumer.remaining_daily_ml - selectedProduct.volume_ml) < consumer.daily_limit_ml * 0.25 && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">After this sale, customer will be near their daily limit. An alert will be sent.</p>
            </div>
          )}

          {recordMutation.isError && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {(recordMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Sale failed. Please try again.'}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep('product')} className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-bold transition">← Back</button>
            <button onClick={() => recordMutation.mutate()} disabled={recordMutation.isPending}
              className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition">
              {recordMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Recording…</> : <><ShoppingCart className="w-4 h-4" />Confirm Sale</>}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 5: Receipt ──────────────────────────────────────────────────── */}
      {step === 'receipt' && receipt && selectedProduct && consumer && (
        <div className={`${cardCls} space-y-5 text-center`}>
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="font-black text-gray-900 dark:text-white text-xl">Sale Recorded!</h2>
            <p className="text-xs text-gray-400 font-mono mt-1"># {receipt.purchase_id.slice(0, 8).toUpperCase()}</p>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-left space-y-2.5">
            {[
              ['Product',         selectedProduct.name],
              ['Volume',          `${selectedProduct.volume_ml} ml`],
              ['Standard Drinks', `${receipt.standard_drinks.toFixed(2)} SD`],
              ['Price',           `₹${selectedProduct.price}`],
              ['Customer',        consumer.full_name],
              ['Remaining Daily', `${receipt.remaining_daily_ml.toFixed(0)} ml`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-gray-400">{k}</span>
                <span className="text-gray-900 dark:text-white font-semibold">{v}</span>
              </div>
            ))}
          </div>

          {receipt.approaching_limit && (
            <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-xs text-amber-700 dark:text-amber-300 text-left">Customer is approaching their daily limit. Alert sent.</p>
            </div>
          )}

          <button onClick={reset} className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition">
            <RotateCcw className="w-4 h-4" /> New Sale
          </button>
        </div>
      )}
    </div>
  )
}

export default ScanAndSellPage
