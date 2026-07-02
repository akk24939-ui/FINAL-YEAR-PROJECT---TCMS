import React, { useState, useRef } from 'react'
import { User, Mail, Phone, MapPin, Calendar, Shield, Camera, Edit3, Save, X, Loader2 } from 'lucide-react'
import { useConsumerProfile, PROFILE_QUERY_KEY } from '../../../hooks/useConsumerProfile'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { consumerApi } from '../../../api/consumer.api'
import type { BeveragePreference, ConsumerProfile } from '../../../types/consumer.types'

type UpdateProfileRequest = Partial<Pick<ConsumerProfile, 'district' | 'gender' | 'address' | 'beverage_preference' | 'mobile_number'>>

const BEVERAGE_OPTIONS: { value: BeveragePreference; label: string }[] = [
  { value: 'BEER', label: '🍺 Beer' },
  { value: 'WINE', label: '🍷 Wine' },
  { value: 'SPIRITS', label: '🥃 Spirits' },
  { value: 'MIXED', label: '🍹 Mixed' },
  { value: 'NONE', label: '❌ None' },
]

const inputCls =
  'w-full bg-white/5 border border-white/15 hover:border-white/30 focus:border-[#F97316] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-white/30 rounded-lg px-3 py-2.5 text-sm outline-none transition-colors'

const ProfilePage: React.FC = () => {
  const { profile, isLoading, error } = useConsumerProfile()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<UpdateProfileRequest>({})
  const [photoLoading, setPhotoLoading] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const { mutate: updateProfile, isPending: saving } = useMutation({
    mutationFn: (data: UpdateProfileRequest) => consumerApi.updateProfile(data).then(r => r.data),
    onSuccess: (updated) => {
      queryClient.setQueryData<ConsumerProfile>(PROFILE_QUERY_KEY, updated)
      setEditing(false)
    },
  })

  const handlePhotoClick = () => photoInputRef.current?.click()

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoLoading(true)
    try {
      const res = await consumerApi.uploadPhoto(file)
      const photo_path = res.data.photo_path
      queryClient.setQueryData<ConsumerProfile>(PROFILE_QUERY_KEY, (old) =>
        old ? { ...old, photo_path } : old
      )
    } catch {
      // Silent
    } finally {
      setPhotoLoading(false)
    }
  }

  const startEdit = () => {
    if (!profile) return
    setForm({
      district: profile.district ?? '',
      address: profile.address ?? '',
      beverage_preference: profile.beverage_preference,
      mobile_number: profile.mobile_number ?? '',
    })
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setForm({})
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#F97316] animate-spin" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center gap-3 h-64 justify-center text-center">
        <p className="text-red-400 font-semibold">Failed to load profile.</p>
        <p className="text-gray-400 text-sm">Please refresh the page.</p>
      </div>
    )
  }

  const initials = profile.full_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Header card */}
      <div className="rounded-2xl bg-gradient-to-br from-[#1A3C34] to-[#0D2B22] border border-white/10 p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div
              className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#D4AF37]/40 bg-[#1A3C34] flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
              onClick={handlePhotoClick}
              title="Click to change photo"
            >
              {profile.photo_path ? (
                <img
                  src={profile.photo_path}
                  alt={profile.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-black text-[#D4AF37]">{initials}</span>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#F97316] flex items-center justify-center border-2 border-[#0D2B22] cursor-pointer" onClick={handlePhotoClick}>
              {photoLoading
                ? <Loader2 className="w-3 h-3 text-white animate-spin" />
                : <Camera className="w-3 h-3 text-white" />
              }
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>

          {/* Name + badges */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white truncate">{profile.full_name}</h2>
            <p className="text-white/50 text-sm mt-0.5">{profile.email}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${profile.is_teetotaler ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                {profile.is_teetotaler ? '🚫 Teetotaler Active' : '✅ Active Consumer'}
              </span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20">
                ID: {profile.aadhaar_masked}
              </span>
            </div>
          </div>

          {/* Edit toggle */}
          <button
            onClick={editing ? cancelEdit : startEdit}
            className="flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors"
          >
            {editing ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Edit3 className="w-3.5 h-3.5" /> Edit</>}
          </button>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-2xl bg-white dark:bg-[#0D2B22] border border-gray-100 dark:border-white/10 shadow-sm divide-y divide-gray-100 dark:divide-white/10">
        {editing ? (
          <div className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white uppercase tracking-wide">Edit Profile</h3>

            {/* Mobile */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wide">Mobile Number</label>
              <input
                className={inputCls}
                value={form.mobile_number ?? ''}
                onChange={(e) => setForm({ ...form, mobile_number: e.target.value })}
                placeholder="10-digit mobile number"
                inputMode="numeric"
                maxLength={10}
              />
            </div>

            {/* District */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wide">District</label>
              <input
                className={inputCls}
                value={form.district ?? ''}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                placeholder="Your district"
              />
            </div>

            {/* Address */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wide">Address</label>
              <textarea
                className={`${inputCls} resize-none`}
                value={form.address ?? ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                rows={2}
                placeholder="Your address"
              />
            </div>

            {/* Beverage preference */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wide">Beverage Preference</label>
              <div className="flex flex-wrap gap-2">
                {BEVERAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, beverage_preference: opt.value })}
                    className={[
                      'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                      form.beverage_preference === opt.value
                        ? 'bg-[#F97316]/20 border-[#F97316]/50 text-[#F97316]'
                        : 'bg-white/5 border-white/15 text-gray-500 dark:text-white/50 hover:border-white/30',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => updateProfile(form)}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#1A3C34] to-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:from-emerald-700 hover:to-emerald-600"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save Changes</>}
            </button>
          </div>
        ) : (
          <>
            {[
              { icon: <Mail className="w-4 h-4" />, label: 'Email', value: profile.email },
              { icon: <Phone className="w-4 h-4" />, label: 'Mobile', value: profile.mobile_number ?? '—' },
              { icon: <Calendar className="w-4 h-4" />, label: 'Date of Birth', value: profile.dob ?? '—' },
              { icon: <User className="w-4 h-4" />, label: 'Gender', value: profile.gender ?? '—' },
              { icon: <MapPin className="w-4 h-4" />, label: 'District', value: profile.district ?? '—' },
              { icon: <Shield className="w-4 h-4" />, label: 'Aadhaar', value: profile.aadhaar_masked },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-4 px-5 py-4">
                <div className="w-8 h-8 rounded-lg bg-[#1A3C34]/10 dark:bg-white/5 flex items-center justify-center text-[#1A3C34] dark:text-white/40 flex-shrink-0">
                  {row.icon}
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">{row.label}</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white mt-0.5">{row.value}</p>
                </div>
              </div>
            ))}

            {/* Beverage preference */}
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="w-8 h-8 rounded-lg bg-[#1A3C34]/10 dark:bg-white/5 flex items-center justify-center text-[#1A3C34] dark:text-white/40 flex-shrink-0">
                🍺
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">Beverage Preference</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white mt-0.5">
                  {BEVERAGE_OPTIONS.find((o) => o.value === profile.beverage_preference)?.label ?? profile.beverage_preference}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default ProfilePage
