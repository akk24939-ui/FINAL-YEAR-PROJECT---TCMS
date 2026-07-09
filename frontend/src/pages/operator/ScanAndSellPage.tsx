/**
 * ScanAndSellPage — The primary operator workflow:
 * 1. Scan consumer QR (camera or paste) → shows consumer limits
 * 2. Select product from TASMAC catalogue
 * 3. Review & confirm → records purchase with limit enforcement
 * 4. Shows receipt / limit warning on success
 */
import React, { useState, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  ScanLine, Search, ShoppingCart, CheckCircle2, AlertTriangle,
  XCircle, ChevronRight, RotateCcw, Loader2, Package,
} from 'lucide-react'
import { operatorConsumerApi, operatorProductsApi, operatorPurchaseApi } from '../../api/operator.api'
import type { ConsumerLookupResult, Product } from '../../types/operator.types'

// ─── Step indicators ──────────────────────────────────────────────────────────
type Step = 'scan' | 'product' | 'confirm' | 'receipt'

const STEPS: { id: Step; label: string }[] = [
  { id: 'scan', label: 'Verify Customer' },
  { id: 'product', label: 'Select Product' },
  { id: 'confirm', label: 'Confirm Sale' },
  { id: 'receipt', label: 'Receipt' },
]

// ─── Limit bar ────────────────────────────────────────────────────────────────
const LimitBar: React.FC<{ label: string; pct: number; warn?: boolean }> = ({ label, pct, warn }) => (
  <div>
    <div className="flex justify-between text-xs mb-1">
      <span className="text-gray-400">{label}</span>
      <span className={`font-bold ${pct >= 75 ? 'text-red-400' : pct >= 50 ? 'text-amber-400' : 'text-emerald-400'}`}>{pct.toFixed(0)}%</span>
    </div>
    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${pct >= 75 ? 'bg-red-500' : pct >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  </div>
)

// ─── Main Page ────────────────────────────────────────────────────────────────
const ScanAndSellPage: React.FC = () => {
  const [step, setStep] = useState<Step>('scan')
  const [qrInput, setQrInput] = useState('')
  const [consumer, setConsumer] = useState<ConsumerLookupResult | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [receipt, setReceipt] = useState<{ purchase_id: string; standard_drinks: number; remaining_daily_ml: number; approaching_limit: boolean } | null>(null)
  const [lookupError, setLookupError] = useState('')
  const qrRef = useRef<HTMLTextAreaElement>(null)

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
    onSuccess: (res) => {
      setConsumer(res.data)
      setLookupError('')
      setStep('product')
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setLookupError(detail || 'Invalid or expired QR code.')
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
    onSuccess: (res) => {
      setReceipt(res.data)
      setStep('receipt')
    },
  })

  const reset = () => {
    setStep('scan')
    setQrInput('')
    setConsumer(null)
    setSelectedProduct(null)
    setProductSearch('')
    setSelectedCategory('All')
    setReceipt(null)
    setLookupError('')
  }

  const inputCls = 'w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 transition'

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white">Scan & Sell</h1>
        <p className="text-sm text-gray-500 mt-1">Verify customer, select product, record sale</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className={`flex items-center gap-2 ${step === s.id ? 'text-white' : STEPS.findIndex(x => x.id === step) > i ? 'text-emerald-400' : 'text-gray-600'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${step === s.id ? 'bg-red-600' : STEPS.findIndex(x => x.id === step) > i ? 'bg-emerald-600' : 'bg-gray-800'}`}>
                {STEPS.findIndex(x => x.id === step) > i ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className="text-xs font-semibold hidden sm:block">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${STEPS.findIndex(x => x.id === step) > i ? 'bg-emerald-600' : 'bg-gray-800'}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* ── STEP 1: Scan QR ─────────────────────────────────────────────────── */}
      {step === 'scan' && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <ScanLine className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="font-bold text-white">Scan Customer QR Code</h2>
              <p className="text-xs text-gray-500">Paste the QR payload or scan with a barcode reader</p>
            </div>
          </div>

          {/* QR paste area */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">QR Code Payload</label>
            <textarea
              ref={qrRef}
              className={`${inputCls} h-28 resize-none font-mono text-xs`}
              placeholder={'Paste QR payload here…\n{"uid":"...","iat":...,"exp":...,"sig":"..."}'}
              value={qrInput}
              onChange={e => setQrInput(e.target.value)}
            />
            <p className="text-[11px] text-gray-600 mt-1">The customer shows their QR on phone — you can scan with a barcode reader into this box</p>
          </div>

          {lookupError && (
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 px-3 py-2.5 rounded-xl border border-red-500/20">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{lookupError}</span>
            </div>
          )}

          <button
            onClick={() => lookupMutation.mutate(qrInput.trim())}
            disabled={!qrInput.trim() || lookupMutation.isPending}
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition"
          >
            {lookupMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : <>Verify Customer <ChevronRight className="w-4 h-4" /></>}
          </button>
        </div>
      )}

      {/* ── STEP 2: Product Selection ────────────────────────────────────────── */}
      {step === 'product' && consumer && (
        <div className="space-y-4">
          {/* Consumer card */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">{consumer.full_name}</h3>
                <p className="text-xs text-gray-500 font-mono">{consumer.aadhaar_masked ?? '—'} · {consumer.district}</p>
              </div>
              {consumer.can_purchase
                ? <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Eligible</span>
                : <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full flex items-center gap-1"><XCircle className="w-3 h-3" /> Limit Reached</span>}
            </div>
            <div className="space-y-2.5">
              <LimitBar label={`Daily: ${consumer.today_consumed_ml.toFixed(0)}ml / ${consumer.daily_limit_ml}ml`} pct={consumer.daily_pct_used} />
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Remaining today</span>
                <span className="font-bold text-white">{consumer.remaining_daily_ml.toFixed(0)}ml</span>
              </div>
            </div>
          </div>

          {/* Limit block */}
          {!consumer.can_purchase && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300 font-semibold">Cannot proceed — customer has reached their daily limit. No sale permitted.</p>
            </div>
          )}

          {consumer.can_purchase && (
            <>
              {/* Category filter */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition ${selectedCategory === cat ? 'bg-red-600 text-white border-red-600' : 'bg-gray-900 text-gray-400 border-gray-700 hover:border-red-500'}`}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input className={`${inputCls} pl-9`} placeholder="Search products…" value={productSearch} onChange={e => setProductSearch(e.target.value)} />
              </div>

              {/* Product grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                {filteredProducts.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-gray-600 text-sm">No products found.</div>
                )}
                {filteredProducts.map(p => {
                  const canAfford = p.volume_ml <= consumer.remaining_daily_ml
                  return (
                    <button
                      key={p.id}
                      onClick={() => { if (canAfford) { setSelectedProduct(p); setStep('confirm') } }}
                      disabled={!canAfford}
                      className={`text-left p-3.5 rounded-xl border transition ${
                        !canAfford ? 'opacity-40 cursor-not-allowed border-gray-800 bg-gray-900'
                        : selectedProduct?.id === p.id ? 'border-red-500 bg-red-500/10'
                        : 'border-gray-800 bg-gray-900 hover:border-red-500/50 hover:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-white leading-tight">{p.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{p.category} · {p.volume_ml}ml · {p.alcohol_pct}%</p>
                        </div>
                        <span className="text-sm font-black text-red-400 whitespace-nowrap">₹{p.price}</span>
                      </div>
                      {!canAfford && <p className="text-[10px] text-red-500 mt-1">Exceeds remaining limit</p>}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          <button onClick={reset} className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-semibold transition">
            ← Start Over
          </button>
        </div>
      )}

      {/* ── STEP 3: Confirm ──────────────────────────────────────────────────── */}
      {step === 'confirm' && consumer && selectedProduct && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-5">
          <h2 className="font-bold text-white text-lg">Confirm Sale</h2>

          {/* Summary card */}
          <div className="bg-gray-800/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-700">
              <Package className="w-5 h-5 text-red-400" />
              <div>
                <p className="font-bold text-white">{selectedProduct.name}</p>
                <p className="text-xs text-gray-400">{selectedProduct.category} · {selectedProduct.volume_ml}ml · {selectedProduct.alcohol_pct}% ABV</p>
              </div>
              <span className="ml-auto text-xl font-black text-white">₹{selectedProduct.price}</span>
            </div>
            {[
              ['Customer', consumer.full_name],
              ['Aadhaar', consumer.aadhaar_masked ?? '—'],
              ['Remaining after sale', `${Math.max(0, consumer.remaining_daily_ml - selectedProduct.volume_ml).toFixed(0)}ml`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-gray-400">{k}</span>
                <span className="text-white font-semibold">{v}</span>
              </div>
            ))}
          </div>

          {(consumer.remaining_daily_ml - selectedProduct.volume_ml) < consumer.daily_limit_ml * 0.25 && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">After this sale, the customer will be near their daily limit. An alert will be sent to them.</p>
            </div>
          )}

          {recordMutation.isError && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {(recordMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Sale failed. Please try again.'}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep('product')} className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-bold transition">← Back</button>
            <button
              onClick={() => recordMutation.mutate()}
              disabled={recordMutation.isPending}
              className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition"
            >
              {recordMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Recording…</> : <><ShoppingCart className="w-4 h-4" /> Confirm Sale</>}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Receipt ──────────────────────────────────────────────────── */}
      {step === 'receipt' && receipt && selectedProduct && consumer && (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-black text-white text-xl">Sale Recorded!</h2>
            <p className="text-xs text-gray-500 font-mono mt-1"># {receipt.purchase_id.slice(0, 8).toUpperCase()}</p>
          </div>

          <div className="bg-gray-800/50 rounded-xl p-4 text-left space-y-2.5">
            {[
              ['Product', selectedProduct.name],
              ['Volume', `${selectedProduct.volume_ml}ml`],
              ['Standard Drinks', `${receipt.standard_drinks.toFixed(2)} SD`],
              ['Price', `₹${selectedProduct.price}`],
              ['Customer', consumer.full_name],
              ['Remaining Daily', `${receipt.remaining_daily_ml.toFixed(0)}ml`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm">
                <span className="text-gray-400">{k}</span>
                <span className="text-white font-semibold">{v}</span>
              </div>
            ))}
          </div>

          {receipt.approaching_limit && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-amber-300 text-left">Customer is approaching their daily limit. Alert sent to their account.</p>
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
