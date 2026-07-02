import React, { useState } from 'react'
import { FileDown, Calendar, Loader2, CheckCircle } from 'lucide-react'
import { consumerApi } from '../../../api/consumer.api'
import { useThemeStore } from '../../../store/themeStore'

const PdfDownloadPage: React.FC = () => {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  const [startDate, setStartDate] = useState(thirtyDaysAgo)
  const [endDate, setEndDate] = useState(today)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const textMain = isDark ? '#F0FDF4' : '#1A3C34'
  const textSub = isDark ? '#9CA3AF' : '#6B7280'
  const cardBg = isDark ? 'rgba(26,60,52,0.5)' : 'white'
  const inputBg = isDark ? 'rgba(26,60,52,0.3)' : '#F9FAFB'
  const inputBorder = isDark ? '#374151' : '#D1D5DB'

  const handleDownload = async () => {
    if (!startDate || !endDate) return
    setLoading(true)
    setError('')
    setSuccess(false)
    try {
      const res = await consumerApi.downloadPdf(startDate, endDate)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tasmac_report_${startDate}_${endDate}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Failed to generate report. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-6" style={{ background: isDark ? '#0D1F1A' : '#F8FAFC' }}>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-2" style={{ color: textMain }}>Download Report</h1>
        <p className="text-sm mb-8" style={{ color: textSub }}>
          Generate a PDF summary of your consumption history.
        </p>

        <div className="rounded-2xl border p-8" style={{
          background: cardBg,
          borderColor: isDark ? 'rgba(212,175,55,0.2)' : 'rgba(26,60,52,0.1)',
          boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.3)' : '0 8px 32px rgba(26,60,52,0.06)'
        }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(249,115,22,0.1)' }}>
              <FileDown className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h2 className="font-bold" style={{ color: textMain }}>Consumption Report</h2>
              <p className="text-xs" style={{ color: textSub }}>PDF with charts and purchase table</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: textSub }}>
                <Calendar className="w-3 h-3 inline mr-1" />Start Date
              </label>
              <input type="date" value={startDate} max={endDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none"
                style={{ background: inputBg, borderColor: inputBorder, color: textMain }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: textSub }}>
                <Calendar className="w-3 h-3 inline mr-1" />End Date
              </label>
              <input type="date" value={endDate} min={startDate} max={today}
                onChange={e => setEndDate(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm border outline-none"
                style={{ background: inputBg, borderColor: inputBorder, color: textMain }} />
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button onClick={handleDownload} disabled={loading || !startDate || !endDate}
            className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: success ? '#16A34A' : 'linear-gradient(135deg, #1A3C34, #2D6A4F)' }}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> :
             success ? <><CheckCircle className="w-5 h-5" />Downloaded!</> :
             <><FileDown className="w-5 h-5" />Download PDF Report</>}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PdfDownloadPage
