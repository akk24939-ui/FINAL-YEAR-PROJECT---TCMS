/**
 * ShopsPage — Create shops, reset PINs, suspend/reactivate.
 * PIN is shown exactly once in a modal then discarded.
 */
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, KeyRound, PauseCircle, PlayCircle, Search, CheckCircle2, XCircle, AlertTriangle, X, Copy } from 'lucide-react'
import { adminShopsApi } from '../../api/admin.api'
import type { ShopRecord, CreateShopPayload } from '../../types/admin.types'

// ── Modals ────────────────────────────────────────────────────────────────────

const PinRevealModal: React.FC<{ pin: string; shopCode: string; onClose: () => void }> = ({ pin, shopCode, onClose }) => {
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(pin); setCopied(true) }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-7 max-w-sm w-full shadow-2xl">
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-6 h-6 text-amber-500" />
          </div>
          <h3 className="font-black text-gray-900 dark:text-white text-lg">Initial PIN</h3>
          <p className="text-xs text-gray-400 mt-1">Shop code: <strong className="text-gray-700 dark:text-gray-300">{shopCode}</strong></p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-center mb-4">
          <p className="text-4xl font-black tracking-widest text-gray-900 dark:text-white">{pin}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-5">
          <p className="text-xs text-red-600 dark:text-red-400 font-semibold text-center">
            ⚠ This PIN will NOT be shown again. Copy it now and share securely.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={copy} className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border transition ${copied ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            {copied ? <><CheckCircle2 className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition">Done</button>
        </div>
      </div>
    </div>
  )
}

const CreateShopModal: React.FC<{ onClose: () => void; onCreated: (pin: string, code: string) => void }> = ({ onClose, onCreated }) => {
  const qc = useQueryClient()
  const [form, setForm] = useState<CreateShopPayload>({ name: '', district: '', address: '', operator_name: '', operator_phone: '', license_number: '' })
  const [error, setError] = useState('')
  const mutation = useMutation({
    mutationFn: () => adminShopsApi.create(form),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-shops'] })
      onCreated(res.data.initial_pin, res.data.shop.shop_code)
    },
    onError: (err: unknown) => {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to create shop')
    },
  })
  const set = (k: keyof CreateShopPayload, v: string) => setForm(f => ({ ...f, [k]: v }))
  const inputCls = 'w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-gray-900 dark:text-white">Create New Shop</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          {([['name', 'Shop Name'], ['district', 'District'], ['address', 'Address'], ['license_number', 'License Number (optional)'], ['operator_name', 'Operator Full Name'], ['operator_phone', 'Operator Phone']] as [keyof CreateShopPayload, string][]).map(([k, lbl]) => (
            <div key={k}>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">{lbl}</label>
              <input className={inputCls} value={form[k] ?? ''} onChange={e => set(k, e.target.value)} required={k !== 'license_number'} />
            </div>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-bold">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold disabled:opacity-50">
            {mutation.isPending ? 'Creating…' : 'Create Shop'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const ShopsPage: React.FC = () => {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined)
  const [showCreate, setShowCreate] = useState(false)
  const [pinReveal, setPinReveal] = useState<{ pin: string; code: string } | null>(null)
  const [suspendTarget, setSuspendTarget] = useState<ShopRecord | null>(null)
  const [suspendReason, setSuspendReason] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-shops', filterActive],
    queryFn: () => adminShopsApi.list({ is_active: filterActive }).then(r => r.data),
  })

  const resetPin = useMutation({
    mutationFn: (shopId: string) => adminShopsApi.resetPin(shopId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-shops'] })
      setPinReveal({ pin: res.data.new_pin, code: res.data.shop_code })
    },
  })

  const suspend = useMutation({
    mutationFn: () => adminShopsApi.suspend(suspendTarget!.id, suspendReason),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-shops'] }); setSuspendTarget(null); setSuspendReason('') },
  })

  const reactivate = useMutation({
    mutationFn: (shopId: string) => adminShopsApi.reactivate(shopId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-shops'] }),
  })

  const filtered = (data?.shops ?? []).filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.shop_code.toLowerCase().includes(search.toLowerCase()) ||
    s.district.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      {pinReveal && <PinRevealModal pin={pinReveal.pin} shopCode={pinReveal.code} onClose={() => setPinReveal(null)} />}
      {showCreate && <CreateShopModal onClose={() => setShowCreate(false)} onCreated={(pin, code) => { setShowCreate(false); setPinReveal({ pin, code }) }} />}

      {/* Suspend confirm */}
      {suspendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-black text-gray-900 dark:text-white mb-3">Suspend Shop</h3>
            <p className="text-sm text-gray-500 mb-4">Suspending <strong>{suspendTarget.name}</strong> ({suspendTarget.shop_code}). Provide a reason:</p>
            <textarea
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-gray-100 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="Reason for suspension"
              value={suspendReason}
              onChange={e => setSuspendReason(e.target.value)}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setSuspendTarget(null); setSuspendReason('') }} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-bold">Cancel</button>
              <button onClick={() => suspend.mutate()} disabled={!suspendReason.trim() || suspend.isPending} className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold disabled:opacity-50">Suspend</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Shops</h1>
          <p className="text-sm text-gray-400">Manage TASMAC shop operators and PIN access</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition">
          <Plus className="w-4 h-4" /> New Shop
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Search shops…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {[undefined, true, false].map((v, i) => (
          <button key={i} onClick={() => setFilterActive(v)} className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${filterActive === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-400'}`}>
            {v === undefined ? 'All' : v ? 'Active' : 'Suspended'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['Shop Code', 'Name', 'District', 'Operator', 'Status', 'PIN Age', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {isLoading && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No shops found.</td></tr>}
              {filtered.map(shop => {
                const pinOverdue = shop.pin_overdue
                return (
                  <tr key={shop.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600 whitespace-nowrap">{shop.shop_code}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{shop.name}</td>
                    <td className="px-4 py-3 text-gray-500">{shop.district}</td>
                    <td className="px-4 py-3">
                      <p className="text-gray-700 dark:text-gray-300">{shop.operator_name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{shop.operator_phone ?? ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      {shop.is_active
                        ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Active</span>
                        : <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full"><PauseCircle className="w-3 h-3" /> Suspended</span>}
                    </td>
                    <td className="px-4 py-3">
                      {pinOverdue
                        ? <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Overdue</span>
                        : <span className="text-xs text-gray-400">{shop.pin_rotation_due_at ? new Date(shop.pin_rotation_due_at).toLocaleDateString() : '—'}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button onClick={() => resetPin.mutate(shop.id)} title="Reset PIN" className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 hover:bg-amber-100 transition">
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        {shop.is_active
                          ? <button onClick={() => setSuspendTarget(shop)} title="Suspend" className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 hover:bg-orange-100 transition"><PauseCircle className="w-3.5 h-3.5" /></button>
                          : <button onClick={() => reactivate.mutate(shop.id)} title="Reactivate" className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 transition"><PlayCircle className="w-3.5 h-3.5" /></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
          {data?.total ?? 0} total shops
        </div>
      </div>
    </div>
  )
}

export default ShopsPage
