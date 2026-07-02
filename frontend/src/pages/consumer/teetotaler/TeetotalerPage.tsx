import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle, Leaf } from 'lucide-react'
import { consumerApi } from '../../../api/consumer.api'
import { useThemeStore } from '../../../store/themeStore'

const TeetotalerPage: React.FC = () => {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data: profile } = useQuery({
    queryKey: ['consumer-profile'],
    queryFn: () => consumerApi.getProfile().then(r => r.data),
  })

  const enableMutation = useMutation({
    mutationFn: () => consumerApi.enableTeetotaler(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['consumer-profile'] }); setShowModal(false) },
  })

  const disableMutation = useMutation({
    mutationFn: () => consumerApi.disableTeetotaler(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['consumer-profile'] }),
  })

  const isTeetotaler = profile?.is_teetotaler ?? false
  const textMain = isDark ? '#F0FDF4' : '#1A3C34'
  const textSub = isDark ? '#9CA3AF' : '#6B7280'
  const cardBg = isDark ? 'rgba(26,60,52,0.5)' : 'white'

  return (
    <div className="min-h-screen p-6" style={{ background: isDark ? '#0D1F1A' : '#F8FAFC' }}>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-2" style={{ color: textMain }}>Teetotaler Mode</h1>
        <p className="text-sm mb-8" style={{ color: textSub }}>
          Commit to a alcohol-free life. This setting is enforced at the server level.
        </p>

        {/* Status Card */}
        <div className="rounded-2xl border p-8 text-center mb-6" style={{
          background: cardBg,
          borderColor: isTeetotaler ? 'rgba(34,197,94,0.3)' : 'rgba(26,60,52,0.1)',
          boxShadow: isTeetotaler ? '0 0 30px rgba(34,197,94,0.1)' : '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
            isTeetotaler ? 'bg-green-500/20' : 'bg-gray-500/10'
          }`}>
            {isTeetotaler
              ? <CheckCircle className="w-10 h-10 text-green-500" />
              : <Leaf className="w-10 h-10" style={{ color: textSub }} />
            }
          </div>

          <h2 className="text-xl font-bold mb-2" style={{ color: textMain }}>
            {isTeetotaler ? 'Teetotaler Mode Active' : 'Teetotaler Mode Off'}
          </h2>
          <p className="text-sm mb-6" style={{ color: textSub }}>
            {isTeetotaler
              ? 'All purchases are blocked at the server level. This cannot be bypassed.'
              : 'Enable to commit to being alcohol-free. All purchases will be blocked.'
            }
          </p>

          {isTeetotaler ? (
            <button onClick={() => disableMutation.mutate()}
              disabled={disableMutation.isPending}
              className="px-8 py-3 rounded-xl border font-semibold text-sm transition-all hover:scale-105"
              style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#EF4444', background: 'rgba(239,68,68,0.1)' }}>
              {disableMutation.isPending ? 'Disabling...' : 'Disable Teetotaler Mode'}
            </button>
          ) : (
            <button onClick={() => setShowModal(true)}
              className="px-8 py-3 rounded-xl font-bold text-white text-sm transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #16A34A, #15803D)' }}>
              Enable Teetotaler Mode
            </button>
          )}
        </div>

        {/* Confirmation Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="w-full max-w-sm rounded-2xl p-6" style={{
              background: isDark ? '#0D1F1A' : 'white',
              border: '1px solid rgba(239,68,68,0.2)'
            }}>
              <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
              <h3 className="text-lg font-bold mb-2" style={{ color: textMain }}>
                Enable Teetotaler Mode?
              </h3>
              <p className="text-sm mb-6" style={{ color: textSub }}>
                This will block ALL alcohol purchases at the <strong>server level</strong>.
                Shop operators will be unable to process any sale for your account.
                You can disable this at any time.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl border text-sm font-semibold"
                  style={{ borderColor: 'rgba(255,255,255,0.1)', color: textSub }}>
                  Cancel
                </button>
                <button onClick={() => enableMutation.mutate()}
                  disabled={enableMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #16A34A, #15803D)' }}>
                  {enableMutation.isPending ? 'Enabling...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TeetotalerPage
