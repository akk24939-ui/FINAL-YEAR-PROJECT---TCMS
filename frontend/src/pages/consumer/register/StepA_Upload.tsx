import React, { useCallback, useRef, useState } from 'react'
import { Upload, FileImage, X, AlertTriangle, Loader2 } from 'lucide-react'
import { consumerApi } from '../../../api/consumer.api'
import type { OcrExtractResponse } from '../../../types/consumer.types'

interface Props {
  onComplete: (data: OcrExtractResponse) => void
}

const MAX_SIZE_MB = 5
const ACCEPTED = ['image/jpeg', 'image/png', 'application/pdf']

const StepA_Upload: React.FC<Props> = ({ onComplete }) => {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validate = (f: File): string | null => {
    if (!ACCEPTED.includes(f.type)) return 'Only JPG, PNG, or PDF files are accepted.'
    if (f.size > MAX_SIZE_MB * 1024 * 1024) return `File must be smaller than ${MAX_SIZE_MB} MB.`
    return null
  }

  const applyFile = (f: File) => {
    const err = validate(f)
    if (err) { setError(err); return }
    setError(null)
    setFile(f)
    if (f.type !== 'application/pdf') {
      const reader = new FileReader()
      reader.onload = () => setPreview(reader.result as string)
      reader.readAsDataURL(f)
    } else {
      setPreview(null)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files[0]
    if (f) applyFile(f)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) applyFile(f)
  }

  const handleSubmit = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const result = await consumerApi.extractId(fd)
      onComplete(result.data)
    } catch (err: unknown) {
      let msg = (err as any)?.response?.data?.detail
      if (Array.isArray(msg)) {
        msg = msg.map((m: any) => m.msg).join(', ')
      } else if (typeof msg !== 'string') {
        msg = null
      }
      setError(msg ?? 'Failed to extract data. Please try again with a clearer image.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Upload Identity Document</h2>
        <p className="text-sm text-gray-600 dark:text-white/60 mt-1">
          We'll extract your details automatically. You can review and correct them in the next step.
        </p>
      </div>

      {/* Disclaimer banner */}
      <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-400/30 px-4 py-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-amber-200 text-xs leading-relaxed">
          <strong className="text-amber-300">DEMO ONLY:</strong> This is a demonstration system.
          Please upload a <strong>sample or dummy ID image only</strong> — do not upload real Aadhaar
          cards or any genuine identity documents.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => !file && inputRef.current?.click()}
        className={[
          'relative rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer',
          dragActive
            ? 'border-[#F97316] bg-orange-500/10'
            : file
            ? 'border-emerald-500/50 bg-emerald-500/5 cursor-default'
            : 'border-gray-300 dark:border-white/20 bg-gray-50/50 dark:bg-white/5 hover:border-gray-400 dark:hover:border-white/40 hover:bg-gray-100 dark:bg-white/10',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          className="hidden"
          onChange={handleChange}
        />

        {file ? (
          <div className="p-6 flex items-center gap-4">
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="w-20 h-20 object-cover rounded-xl border border-gray-300 dark:border-white/20"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                <FileImage className="w-8 h-8 text-gray-500 dark:text-white/50" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 dark:text-white font-semibold truncate">{file.name}</p>
              <p className="text-gray-500 dark:text-white/50 text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                Ready to upload
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null) }}
              className="p-2 rounded-full hover:bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50 hover:text-gray-900 dark:text-white transition-colors"
              aria-label="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-10 flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-gray-500 dark:text-white/50" />
            </div>
            <div>
              <p className="text-gray-900 dark:text-white font-semibold">Drag & drop or click to upload</p>
              <p className="text-gray-400 dark:text-white/40 text-sm mt-1">Supported: JPG, PNG, PDF — max {MAX_SIZE_MB} MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <X className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!file || loading}
        className={[
          'w-full py-3.5 rounded-xl font-bold text-gray-900 dark:text-white text-sm transition-all duration-200 flex items-center justify-center gap-2',
          !file || loading
            ? 'bg-gray-600 cursor-not-allowed opacity-50'
            : 'bg-gradient-to-r from-[#F97316] to-orange-400 hover:from-orange-500 hover:to-orange-300 shadow-lg hover:shadow-orange-500/25',
        ].join(' ')}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Extracting details…
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            Extract Details
          </>
        )}
      </button>
    </div>
  )
}

export default StepA_Upload
