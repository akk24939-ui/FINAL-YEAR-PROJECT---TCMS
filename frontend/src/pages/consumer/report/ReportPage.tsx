/**
 * ReportPage.tsx — PDF purchase report download.
 * Lets the consumer select a date range and download a PDF.
 */
import React, { useState } from 'react'
import { FileDown, Calendar, Download, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { consumerApi } from '../../../api/consumer.api'

const PRESET_RANGES: { label: string; getDates: () => [string, string] }[] = [
  {
    label: 'Last 7 days',
    getDates: () => {
      const end = new Date()
      const start = new Date(Date.now() - 7 * 86_400_000)
      return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]]
    },
  },
  {
    label: 'Last 30 days',
    getDates: () => {
      const end = new Date()
      const start = new Date(Date.now() - 30 * 86_400_000)
      return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]]
    },
  },
  {
    label: 'This month',
    getDates: () => {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      return [start, now.toISOString().split('T')[0]]
    },
  },
  {
    label: 'Last 3 months',
    getDates: () => {
      const end = new Date()
      const start = new Date(Date.now() - 90 * 86_400_000)
      return [start.toISOString().split('T')[0], end.toISOString().split('T')[0]]
    },
  },
]

const ReportPage: React.FC = () => {
  const today = new Date().toISOString().split('T')[0]
  const thirtyAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0]

  const [startDate, setStartDate] = useState(thirtyAgo)
  const [endDate, setEndDate] = useState(today)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const applyPreset = (preset: typeof PRESET_RANGES[0]) => {
    const [s, e] = preset.getDates()
    setStartDate(s)
    setEndDate(e)
  }

  const handleDownload = async () => {
    if (!startDate || !endDate) return
    if (startDate > endDate) {
      setError('Start date must be before end date.')
      return
    }
    setError('')
    setLoading(true)
    setSuccess(false)
    try {
      const res = await consumerApi.downloadPdf(startDate, endDate)
      const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `TASMAC_Purchase_Report_${startDate}_to_${endDate}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
    } catch {
      setError('Failed to generate report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <FileDown className="w-5 h-5 text-green-600 dark:text-green-400" />
          Download Report
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Download your purchase history as a PDF report.
        </p>
      </div>

      {/* Main card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 space-y-5">
        {/* Preset buttons */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Quick ranges</p>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_RANGES.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className="py-2 px-3 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600 transition text-left"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date pickers */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
              Start Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
              End Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={today}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Error / success */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/10 px-4 py-3 rounded-xl border border-red-200 dark:border-red-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300 text-sm bg-green-50 dark:bg-green-900/10 px-4 py-3 rounded-xl border border-green-200 dark:border-green-800">
            <CheckCircle className="w-4 h-4 flex-shrink-0" /> Report downloaded successfully!
          </div>
        )}

        {/* Download button */}
        <button
          onClick={handleDownload}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating PDF…</>
            : <><Download className="w-4 h-4" /> Download PDF Report</>
          }
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 text-xs text-blue-800 dark:text-blue-200 leading-relaxed">
        The report includes all your purchase records for the selected period, organised by date, shop, and product.
        Data is fetched directly from TASMAC servers and cannot be altered.
      </div>
    </div>
  )
}

export default ReportPage
