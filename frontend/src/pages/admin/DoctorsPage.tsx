/**
 * DoctorsPage — Create, activate, deactivate/revoke doctors.
 * Temp password shown once on creation.
 */
import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, CheckCircle2, XCircle, Copy, X, Search } from 'lucide-react'
import { adminDoctorsApi } from '../../api/admin.api'
import type { CreateDoctorPayload, DoctorRecord } from '../../types/admin.types'

const TempPasswordModal: React.FC<{ email: string; password: string; mrn: string; onClose: () => void }> = ({ email, password, mrn, onClose }) => {
  const [copied, setCopied] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-7 max-w-sm w-full shadow-2xl">
        <h3 className="font-black text-gray-900 dark:text-white text-lg mb-1">Doctor Created</h3>
        <p className="text-xs text-gray-400 mb-5">Share these credentials securely with the doctor.</p>
        <div className="space-y-3 mb-5">
          {[['Login Email', email], ['Reg. Number', mrn], ['Temp Password', password]].map(([label, val]) => (
            <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
              <p className="text-sm font-mono font-bold text-gray-900 dark:text-white break-all">{val}</p>
            </div>
          ))}
        </div>
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-5">
          <p className="text-xs text-red-600 dark:text-red-400 font-semibold">⚠ Temp password shown once only. Doctor must change it on first login. Account is inactive until you activate it.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`); setCopied(true) }} className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border transition ${copied ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'}`}>
            <Copy className="w-4 h-4" /> {copied ? 'Copied!' : 'Copy'}
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm">Done</button>
        </div>
      </div>
    </div>
  )
}

const CreateDoctorModal: React.FC<{ onClose: () => void; onCreated: (email: string, pw: string, mrn: string) => void }> = ({ onClose, onCreated }) => {
  const qc = useQueryClient()
  const [form, setForm] = useState<CreateDoctorPayload>({ full_name: '', specialization: '', contact_phone: '', hospital_name: '' })
  const [error, setError] = useState('')
  const mutation = useMutation({
    mutationFn: () => adminDoctorsApi.create(form),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-doctors'] })
      onCreated(res.data.login_email, res.data.temp_password, res.data.doctor.profile.medical_reg_number)
    },
    onError: (err: unknown) => setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed'),
  })
  const inputCls = 'w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-gray-900 dark:text-white">Create Doctor Account</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          {([['full_name', 'Full Name', true], ['specialization', 'Specialization', false], ['hospital_name', 'Hospital / Clinic', false], ['contact_phone', 'Contact Phone', false]] as [keyof CreateDoctorPayload, string, boolean][]).map(([k, lbl, req]) => (
            <div key={k}>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">{lbl}{req && ' *'}</label>
              <input className={inputCls} value={form[k] ?? ''} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} required={req} />
            </div>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-bold">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold disabled:opacity-50">{mutation.isPending ? 'Creating…' : 'Create'}</button>
        </div>
      </div>
    </div>
  )
}

const DoctorsPage: React.FC = () => {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined)
  const [showCreate, setShowCreate] = useState(false)
  const [createdInfo, setCreatedInfo] = useState<{ email: string; pw: string; mrn: string } | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<DoctorRecord | null>(null)
  const [deactivateReason, setDeactivateReason] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-doctors', filterActive],
    queryFn: () => adminDoctorsApi.list({ is_active: filterActive }).then(r => r.data),
  })

  const activate = useMutation({
    mutationFn: (id: string) => adminDoctorsApi.activate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-doctors'] }),
  })

  const deactivate = useMutation({
    mutationFn: () => adminDoctorsApi.deactivate(deactivateTarget!.user_id, deactivateReason, true),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-doctors'] }); setDeactivateTarget(null); setDeactivateReason('') },
  })

  const filtered = (data?.doctors ?? []).filter(d =>
    d.full_name.toLowerCase().includes(search.toLowerCase()) ||
    d.profile.medical_reg_number.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      {createdInfo && <TempPasswordModal email={createdInfo.email} password={createdInfo.pw} mrn={createdInfo.mrn} onClose={() => setCreatedInfo(null)} />}
      {showCreate && <CreateDoctorModal onClose={() => setShowCreate(false)} onCreated={(email, pw, mrn) => { setShowCreate(false); setCreatedInfo({ email, pw, mrn }) }} />}

      {deactivateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-black text-gray-900 dark:text-white mb-3">Deactivate Doctor</h3>
            <p className="text-sm text-gray-500 mb-4">Deactivating <strong>{deactivateTarget.full_name}</strong>. All active tokens will be revoked.</p>
            <textarea className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm h-20 resize-none focus:outline-none focus:ring-2 focus:ring-red-500" placeholder="Reason" value={deactivateReason} onChange={e => setDeactivateReason(e.target.value)} />
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setDeactivateTarget(null); setDeactivateReason('') }} className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-bold">Cancel</button>
              <button onClick={() => deactivate.mutate()} disabled={!deactivateReason.trim() || deactivate.isPending} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-50">Deactivate + Revoke</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Doctors</h1>
          <p className="text-sm text-gray-400">Provision and manage doctor accounts</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition">
          <Plus className="w-4 h-4" /> New Doctor
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Search doctors…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {[undefined, true, false].map((v, i) => (
          <button key={i} onClick={() => setFilterActive(v)} className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${filterActive === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-400'}`}>
            {v === undefined ? 'All' : v ? 'Active' : 'Inactive'}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['Name', 'Reg. No', 'Specialization', 'Hospital', 'Status', 'Last Login', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {isLoading && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No doctors found.</td></tr>}
              {filtered.map(doc => (
                <tr key={doc.user_id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition">
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{doc.full_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{doc.profile.medical_reg_number}</td>
                  <td className="px-4 py-3 text-gray-500">{doc.profile.specialization ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{doc.profile.hospital_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {doc.profile.is_active
                      ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Active</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" /> Inactive</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{doc.last_login_at ? new Date(doc.last_login_at).toLocaleDateString() : 'Never'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {!doc.profile.is_active
                        ? <button onClick={() => activate.mutate(doc.user_id)} className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 transition">Activate</button>
                        : <button onClick={() => setDeactivateTarget(doc)} className="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-100 transition">Deactivate</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">{data?.total ?? 0} total doctors</div>
      </div>
    </div>
  )
}

export default DoctorsPage
