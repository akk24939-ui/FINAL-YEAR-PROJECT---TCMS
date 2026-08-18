import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, RefreshCw, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { consumerApi } from '../../../api/consumer.api'
import type { QrResponse } from '../../../types/consumer.types'
import { getErrorMessage } from '../../../utils/getErrorMessage'

// ── Component ────────────────────────────────────────────────────────────────
export default function QrPage() {
  const qc = useQueryClient()
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false)
  const [revokeError, setRevokeError] = useState('')
  const [revokeSuccess, setRevokeSuccess] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['consumer-qr'],
    queryFn: () => consumerApi.generateQr().then((r) => r.data),
    // QR is permanent — no auto-refresh needed
    staleTime: Infinity,
    retry: 2,
  })

  const revokeMut = useMutation({
    mutationFn: () => consumerApi.revokeQr(),
    onSuccess: (res) => {
      setShowRevokeConfirm(false)
      setRevokeError('')
      setRevokeSuccess(true)
      // res is AxiosResponse<QrResponse>
      qc.setQueryData<QrResponse>(['consumer-qr'], res.data)
    },
    onError: (err: unknown) => {
      setRevokeError(getErrorMessage(err, 'Failed to regenerate QR. Please try again.'))
    },
  })

  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My QR Code</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Show this at the shop counter to verify your identity.
        </p>
      </div>

      {/* Success banner */}
      {revokeSuccess && (
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 rounded-xl px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Your QR has been regenerated. The old one will no longer work at shops.
        </div>
      )}

      {/* QR Image card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 flex flex-col items-center gap-4">
        {isLoading && (
          <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm">Loading your QR…</span>
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-2 py-8 text-red-500">
            <AlertTriangle className="w-8 h-8" />
            <span className="text-sm font-medium">Could not load QR code.</span>
            <button
              className="text-xs underline mt-1"
              onClick={() => qc.invalidateQueries({ queryKey: ['consumer-qr'] })}
            >
              Try again
            </button>
          </div>
        )}

        {data?.qr_image_base64 && (
          <>
            <img
              src={`data:image/png;base64,${data.qr_image_base64}`}
              alt="Your TASMAC Consumer QR Code"
              className="w-56 h-56 rounded-lg border-4 border-emerald-100 dark:border-emerald-900 shadow"
            />

            {/* Permanent badge */}
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Permanent QR — no expiry</span>
            </div>
          </>
        )}
      </div>

      {/* Security panel */}
      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Your QR is secured with an HMAC signature — tampering is instantly detected.
            If you believe your QR was photographed by someone else, regenerate it below.
          </p>
        </div>

        {revokeError && (
          <p className="text-xs text-red-500 dark:text-red-400">{revokeError}</p>
        )}

        {/* Revoke dialog trigger */}
        {!showRevokeConfirm ? (
          <button
            onClick={() => { setRevokeSuccess(false); setShowRevokeConfirm(true) }}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg border border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Regenerate QR (Security Action)
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">
              ⚠ Your current QR will stop working immediately at all shop counters. Proceed?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => revokeMut.mutate()}
                disabled={revokeMut.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-60 transition-colors"
              >
                {revokeMut.isPending
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Regenerating…</>
                  : 'Yes, Regenerate'
                }
              </button>
              <button
                onClick={() => setShowRevokeConfirm(false)}
                disabled={revokeMut.isPending}
                className="flex-1 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
