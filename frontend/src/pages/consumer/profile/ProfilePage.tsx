/**
 * ProfilePage.tsx — Full consumer profile view + edit.
 *
 * View mode: Displays all profile fields in grouped info rows.
 * Edit mode: Form with all editable fields including new dashboard fields.
 *
 * New fields (dashboard module):
 *   blood_group, emergency_contact_name, emergency_contact_phone
 * Updated: full_name and mobile_number are now editable.
 */
import React, { useState, useRef, useEffect } from 'react'
import {
  User, Mail, Phone, MapPin, Calendar, Shield,
  Camera, Edit3, Save, X, Loader2, AlertCircle,
  Heart, UserCheck, RefreshCw, Copy, CheckCheck,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useConsumerProfile, PROFILE_QUERY_KEY } from '../../../hooks/useConsumerProfile'
import { consumerApi } from '../../../api/consumer.api'
import type {
  Gender, BeveragePreference, ConsumerProfile, ProfileUpdateRequest
} from '../../../types/consumer.types'

// ── Constants ─────────────────────────────────────────────────────────────────

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
]

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown']

const BEVERAGE_OPTIONS: { value: BeveragePreference; label: string }[] = [
  { value: 'BEER', label: '🍺 Beer' },
  { value: 'WINE', label: '🍷 Wine' },
  { value: 'SPIRITS', label: '🥃 Spirits' },
  { value: 'MIXED', label: '🍹 Mixed' },
  { value: 'NONE', label: '❌ None' },
]

// ── Styles ────────────────────────────────────────────────────────────────────

const inputCls =
  'w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition'

const selectCls =
  'w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition'

// ── Info row (view mode) ──────────────────────────────────────────────────────

const InfoRow: React.FC<{
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}> = ({ icon, label, value }) => (
  <div className="flex items-start gap-4 px-5 py-3.5 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
    <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-0.5">{value || '—'}</p>
    </div>
  </div>
)

// ── Form field ────────────────────────────────────────────────────────────────

const FormField: React.FC<{
  label: string
  children: React.ReactNode
}> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide block">
      {label}
    </label>
    {children}
  </div>
)

// ── Main Page ─────────────────────────────────────────────────────────────────

const ProfilePage: React.FC = () => {
  const { profile, isLoading, error, refetch } = useConsumerProfile()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ProfileUpdateRequest>({})
  const [photoLoading, setPhotoLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [copied, setCopied] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Sync form when profile loads
  useEffect(() => {
    if (profile && editing) {
      setForm({
        full_name: profile.full_name,
        mobile_number: profile.mobile_number ?? '',
        gender: profile.gender,
        district: profile.district ?? '',
        address: profile.address ?? '',
        blood_group: profile.blood_group ?? '',
        emergency_contact_name: profile.emergency_contact_name ?? '',
        emergency_contact_phone: profile.emergency_contact_phone ?? '',
        beverage_preference: profile.beverage_preference,
      })
    }
  }, [editing, profile])

  const { mutate: updateProfile, isPending: saving } = useMutation({
    mutationFn: (data: ProfileUpdateRequest) =>
      consumerApi.updateProfile(data).then(r => r.data),
    onSuccess: (updated) => {
      queryClient.setQueryData<ConsumerProfile>(PROFILE_QUERY_KEY, updated)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
    },
    onError: (err: Error) => {
      setSaveError(err.message || 'Failed to save. Please try again.')
    },
  })

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoLoading(true)
    try {
      await consumerApi.uploadPhoto(file)
      refetch()
    } catch {
      // Silent — photo upload failures are non-critical
    } finally {
      setPhotoLoading(false)
    }
  }

  const startEdit = () => setEditing(true)
  const cancelEdit = () => {
    setEditing(false)
    setForm({})
    setSaveError('')
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-40 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
        <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="font-semibold text-gray-900 dark:text-gray-100">Failed to load profile</p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 transition"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  const initials = profile.full_name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* ── Header Card ── */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-700 to-blue-900 dark:from-blue-800 dark:to-blue-950 p-6 shadow-lg">
        <div className="flex items-start gap-5">

          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div
              className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/20 bg-blue-800 flex items-center justify-center cursor-pointer hover:opacity-80 transition"
              onClick={() => photoInputRef.current?.click()}
              title="Click to change photo"
            >
              {profile.photo_path ? (
                <img src={profile.photo_path} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-white/90">{initials}</span>
              )}
            </div>
            <div
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center border-2 border-blue-900 cursor-pointer hover:bg-blue-400 transition"
              onClick={() => photoInputRef.current?.click()}
            >
              {photoLoading
                ? <Loader2 className="w-3 h-3 text-white animate-spin" />
                : <Camera className="w-3 h-3 text-white" />
              }
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white truncate">{profile.full_name}</h2>
            <p className="text-blue-200/70 text-sm mt-0.5">{profile.email}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                profile.is_teetotaler
                  ? 'bg-red-500/20 text-red-300 border border-red-400/30'
                  : 'bg-green-500/20 text-green-300 border border-green-400/30'
              }`}>
                {profile.is_teetotaler ? '🚫 Teetotaler' : '✅ Active Consumer'}
              </span>
              {profile.is_self_restricted && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  🔒 Self-Restricted
                </span>
              )}
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/10 text-white/70 border border-white/20 font-mono">
                {profile.aadhaar_masked}
              </span>
            </div>
            {profile.member_since && (
              <p className="text-blue-200/50 text-xs mt-2">
                Member since {formatDate(profile.member_since)}
              </p>
            )}
          </div>

          {/* Edit toggle */}
          <button
            onClick={editing ? cancelEdit : startEdit}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition"
          >
            {editing ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Edit3 className="w-3.5 h-3.5" /> Edit</>}
          </button>
        </div>
      </div>

      {/* ── Success banner ── */}
      {saved && (
        <div className="flex items-center gap-2 text-green-700 dark:text-green-300 text-sm bg-green-50 dark:bg-green-900/10 px-4 py-3 rounded-2xl border border-green-200 dark:border-green-800">
          <Save className="w-4 h-4 flex-shrink-0" /> Profile saved successfully!
        </div>
      )}

      {/* ── View mode ── */}
      {!editing && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden shadow-sm">

          {/* Personal */}
          <div className="px-5 py-3 bg-gray-50/50 dark:bg-gray-800/30">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Personal</p>
          </div>
          <InfoRow icon={<User className="w-4 h-4" />} label="Full Name" value={profile.full_name} />
          <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={profile.email} />
          <InfoRow icon={<Phone className="w-4 h-4" />} label="Mobile" value={profile.mobile_number ?? '—'} />
          <InfoRow icon={<Calendar className="w-4 h-4" />} label="Date of Birth" value={profile.dob ? formatDate(profile.dob) : '—'} />
          <InfoRow icon={<User className="w-4 h-4" />} label="Gender" value={GENDER_OPTIONS.find(g => g.value === profile.gender)?.label ?? profile.gender ?? '—'} />
          <InfoRow icon={<Shield className="w-4 h-4" />} label="Aadhaar" value={profile.aadhaar_masked} />

          {/* Location */}
          <div className="px-5 py-3 bg-gray-50/50 dark:bg-gray-800/30">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Location</p>
          </div>
          <InfoRow icon={<MapPin className="w-4 h-4" />} label="District" value={profile.district ?? '—'} />
          <InfoRow icon={<MapPin className="w-4 h-4" />} label="Address" value={profile.address ?? '—'} />

          {/* Health */}
          <div className="px-5 py-3 bg-gray-50/50 dark:bg-gray-800/30">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Health &amp; Emergency</p>
          </div>
          <InfoRow icon={<Heart className="w-4 h-4" />} label="Blood Group" value={profile.blood_group ?? '—'} />
          <InfoRow icon={<UserCheck className="w-4 h-4" />} label="Emergency Contact" value={profile.emergency_contact_name ?? '—'} />
          <InfoRow icon={<Phone className="w-4 h-4" />} label="Emergency Phone" value={profile.emergency_contact_phone ?? '—'} />

          {/* Preferences */}
          <div className="px-5 py-3 bg-gray-50/50 dark:bg-gray-800/30">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Preferences</p>
          </div>
          <InfoRow
            icon={<span className="text-base">🍺</span>}
            label="Beverage Preference"
            value={BEVERAGE_OPTIONS.find(o => o.value === profile.beverage_preference)?.label ?? profile.beverage_preference}
          />

          {/* Consumer ID — needed for Manual ID lookup at shop */}
          <div className="px-5 py-3 bg-gray-50/50 dark:bg-gray-800/30">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Consumer ID</p>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Your Unique Consumer ID</p>
              <p className="text-xs font-mono text-gray-700 dark:text-gray-300 mt-0.5 break-all">{profile.user_id}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Share this with the shop operator if your QR code is unavailable</p>
            </div>
            <button
              onClick={() => copyId(profile.user_id)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all"
              style={{
                borderColor: copied ? '#10b981' : '#d1d5db',
                color: copied ? '#10b981' : '#6b7280',
                background: copied ? 'rgba(16,185,129,0.05)' : 'transparent',
              }}
              title="Copy Consumer ID"
            >
              {copied
                ? <><CheckCheck className="w-3.5 h-3.5" />Copied!</>
                : <><Copy className="w-3.5 h-3.5" />Copy</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Edit mode ── */}
      {editing && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-5 shadow-sm">

          {/* Section: Personal */}
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Personal</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Full Name">
                <input
                  className={inputCls}
                  value={form.full_name ?? ''}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Your full name"
                />
              </FormField>
              <FormField label="Mobile Number">
                <input
                  className={inputCls}
                  value={form.mobile_number ?? ''}
                  onChange={e => setForm({ ...form, mobile_number: e.target.value })}
                  placeholder="10-digit mobile"
                  inputMode="numeric"
                  maxLength={10}
                />
              </FormField>
              <FormField label="Gender">
                <select
                  className={selectCls}
                  value={form.gender ?? ''}
                  onChange={e => setForm({ ...form, gender: e.target.value as Gender })}
                >
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map(g => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Blood Group">
                <select
                  className={selectCls}
                  value={form.blood_group ?? ''}
                  onChange={e => setForm({ ...form, blood_group: e.target.value })}
                >
                  <option value="">Select blood group</option>
                  {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </FormField>
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          {/* Section: Location */}
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Location</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="District">
                <input
                  className={inputCls}
                  value={form.district ?? ''}
                  onChange={e => setForm({ ...form, district: e.target.value })}
                  placeholder="Your district"
                />
              </FormField>
            </div>
            <div className="mt-4">
              <FormField label="Address">
                <textarea
                  className={`${inputCls} resize-none`}
                  value={form.address ?? ''}
                  onChange={e => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  placeholder="Your address"
                />
              </FormField>
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          {/* Section: Emergency */}
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">Emergency Contact</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Contact Name">
                <input
                  className={inputCls}
                  value={form.emergency_contact_name ?? ''}
                  onChange={e => setForm({ ...form, emergency_contact_name: e.target.value })}
                  placeholder="e.g. Parent / Spouse"
                />
              </FormField>
              <FormField label="Contact Phone">
                <input
                  className={inputCls}
                  value={form.emergency_contact_phone ?? ''}
                  onChange={e => setForm({ ...form, emergency_contact_phone: e.target.value })}
                  placeholder="10-digit mobile"
                  inputMode="numeric"
                  maxLength={10}
                />
              </FormField>
            </div>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          {/* Section: Preferences */}
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Beverage Preference</p>
            <div className="flex flex-wrap gap-2">
              {BEVERAGE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, beverage_preference: opt.value })}
                  className={[
                    'px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all',
                    form.beverage_preference === opt.value
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-300',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {saveError && (
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/10 px-4 py-3 rounded-xl border border-red-200 dark:border-red-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {saveError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={cancelEdit}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => updateProfile(form)}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-60"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Profile</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfilePage
