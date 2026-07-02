import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QrCode, RefreshCw, ShieldCheck, Clock } from 'lucide-react'
import { consumerApi } from '../../../api/consumer.api'
import { useThemeStore } from '../../../store/themeStore'

const QrPage: React.FC = () => {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const [refreshKey, setRefreshKey] = useState(0)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['consumer-qr', refreshKey],
    queryFn: () => consumerApi.generateQr().then(r => r.data),
    staleTime: 0,
  })

  const expiresAt = data?.expires_at ? new Date(data.expires_at) : null
  const timeLeft = expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)) : 0
  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60

  const cardBg = isDark ? 'rgba(26,60,52,0.5)' : 'white'
  const textMain = isDark ? '#F0FDF4' : '#1A3C34'
  const textSub = isDark ? '#9CA3AF' : '#6B7280'

  return (
    <div className="min-h-screen p-6" style={{ background: isDark ? '#0D1F1A' : '#F8FAFC' }}>
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-2" style={{ color: textMain }}>Your QR Code</h1>
        <p className="text-sm mb-8" style={{ color: textSub }}>
          Show this to the shop operator. No personal data is embedded.
        </p>

        {/* Security notice */}
        <div className="flex items-center gap-3 mb-6 p-4 rounded-xl border" style={{
          background: isDark ? 'rgba(26,60,52,0.3)' : '#F0FDF4',
          borderColor: isDark ? 'rgba(212,175,55,0.2)' : 'rgba(26,60,52,0.2)'
        }}>
          <ShieldCheck className="w-5 h-5 text-green-500 flex-shrink-0" />
          <p className="text-xs" style={{ color: textSub }}>
            This QR contains an HMAC-signed token only — your name, Aadhaar, and personal details are never embedded.
          </p>
        </div>

        {/* QR Card */}
        <div className="rounded-2xl border p-8 text-center" style={{
          background: cardBg,
          borderColor: isDark ? 'rgba(212,175,55,0.2)' : 'rgba(26,60,52,0.1)',
          boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(26,60,52,0.08)'
        }}>
          {isLoading && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
              <p style={{ color: textSub }}>Generating secure QR...</p>
            </div>
          )}

          {error && (
            <div className="py-12">
              <QrCode className="w-16 h-16 mx-auto mb-4 text-red-400" />
              <p className="text-red-400 mb-4">Failed to generate QR code</p>
              <button onClick={() => refetch()}
                className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
                style={{ background: '#1A3C34' }}>
                Try Again
              </button>
            </div>
          )}

          {data && !isLoading && (
            <>
              <div className="inline-block p-4 bg-white rounded-xl shadow-lg mb-4">
                <img
                  src={`data:image/png;base64,${data.qr_image_base64}`}
                  alt="Consumer QR Code"
                  className="w-56 h-56"
                />
              </div>

              {/* Expiry timer */}
              {expiresAt && (
                <div className="flex items-center justify-center gap-2 mb-6">
                  <Clock className="w-4 h-4" style={{ color: timeLeft < 300 ? '#EF4444' : '#22C55E' }} />
                  <span className="font-mono text-sm font-bold" style={{
                    color: timeLeft < 300 ? '#EF4444' : (isDark ? '#22C55E' : '#16A34A')
                  }}>
                    Expires in {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                  </span>
                </div>
              )}

              <button
                onClick={() => { setRefreshKey(k => k + 1) }}
                className="flex items-center gap-2 mx-auto px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #1A3C34, #2D6A4F)' }}
              >
                <RefreshCw className="w-4 h-4" />
                Refresh QR
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default QrPage
