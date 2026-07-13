/**
 * RegisterPage — Multi-step consumer registration.
 *
 * Step 0: Mode picker (Manual entry vs OCR/ID-card upload)
 * Step 1: Collect details (either StepA_Manual or StepA_Upload)
 * Step 2: Review & correct (StepB_ReviewForm)
 * Step 3: Set password (StepC_SetPassword)
 * Step 4: Confirm & submit (StepD_Confirm)
 */
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScanLine, PenLine, ChevronRight } from 'lucide-react'
import StepperNav from '../../../components/ui/StepperNav'
import StepA_Upload from './StepA_Upload'
import StepA_Manual from './StepA_Manual'
import StepB_ReviewForm from './StepB_ReviewForm'
import StepC_SetPassword from './StepC_SetPassword'
import StepD_Confirm from './StepD_Confirm'
import type { OcrExtractResponse, RegisterFinalRequest } from '../../../types/consumer.types'

type Mode = 'OCR' | 'MANUAL' | null

const STEPS = ['Your Details', 'Review', 'Set Password', 'Confirm']

// ─── Mode Picker ──────────────────────────────────────────────────────────────
const ModePicker: React.FC<{ onSelect: (mode: Mode) => void }> = ({ onSelect }) => (
  <div className="p-6 sm:p-8 space-y-6">
    <div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white">How would you like to register?</h2>
      <p className="text-sm text-gray-600 dark:text-white/60 mt-1">
        Choose a method. You can switch between them at any time before submitting.
      </p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Manual entry */}
      <button
        onClick={() => onSelect('MANUAL')}
        className="group flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-gray-200 dark:border-white/10 hover:border-[#F97316] dark:hover:border-[#F97316] bg-gray-50/50 dark:bg-white/5 hover:bg-orange-50/30 dark:hover:bg-[#F97316]/5 transition-all duration-200 text-left"
      >
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-orange-100 dark:bg-[#F97316]/20 group-hover:scale-110 transition-transform">
          <PenLine className="w-7 h-7 text-[#F97316]" />
        </div>
        <div>
          <p className="font-bold text-gray-900 dark:text-white">Manual Entry</p>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-1">
            Type your details directly. Works without a camera or scanner.
          </p>
        </div>
        <div className="mt-auto flex items-center gap-1 text-[#F97316] text-sm font-semibold">
          Select <ChevronRight className="w-4 h-4" />
        </div>
      </button>

      {/* OCR upload */}
      <button
        onClick={() => onSelect('OCR')}
        className="group flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-gray-200 dark:border-white/10 hover:border-emerald-500 dark:hover:border-emerald-400 bg-gray-50/50 dark:bg-white/5 hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5 transition-all duration-200 text-left"
      >
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-100 dark:bg-emerald-500/20 group-hover:scale-110 transition-transform">
          <ScanLine className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="font-bold text-gray-900 dark:text-white">Upload ID Card (OCR)</p>
          <p className="text-sm text-gray-500 dark:text-white/50 mt-1">
            Upload your Aadhaar card image — details are extracted automatically.
          </p>
        </div>
        <div className="mt-auto flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
          Select <ChevronRight className="w-4 h-4" />
        </div>
      </button>
    </div>
  </div>
)

// ─── RegisterPage ─────────────────────────────────────────────────────────────
const RegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>(null)
  const [currentStep, setCurrentStep] = useState(0)   // 0=mode picker, 1=data, 2=review, 3=password, 4=confirm
  const [ocrData, setOcrData] = useState<OcrExtractResponse | null>(null)
  const [formData, setFormData] = useState<Partial<RegisterFinalRequest>>({})

  const handleModeSelect = (selectedMode: Mode) => {
    setMode(selectedMode)
    setCurrentStep(1)
  }

  const handleStepAComplete = (data: OcrExtractResponse) => {
    setOcrData(data)
    setCurrentStep(2)
  }

  const handleStepBComplete = (data: Partial<RegisterFinalRequest>) => {
    setFormData(prev => ({ ...prev, ...data }))
    setCurrentStep(3)
  }

  const handleStepCComplete = (data: { password: string }) => {
    setFormData(prev => ({ ...prev, ...data }))
    setCurrentStep(4)
  }

  const handleRegistrationSuccess = () => {
    setTimeout(() => navigate('/login'), 3000)
  }

  // Steps shown in the stepper only once mode is selected
  const stepIndex = Math.max(0, currentStep - 1)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gradient-to-br dark:from-[#0D1F1A] dark:via-[#1A3C34] dark:to-[#0D2B22] flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-200 dark:border-white/10 bg-white dark:bg-transparent transition-colors duration-300">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-700 dark:text-white/80 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <span className="text-2xl">🏛️</span>
          <span className="font-bold text-lg tracking-tight hidden sm:block">Smart TASMAC</span>
        </button>
        <span className="text-emerald-700 dark:text-[#D4AF37] text-sm font-semibold">Consumer Registration</span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start px-4 py-8">
        <div className="w-full max-w-2xl">
          {/* Mode label */}
          {mode && currentStep > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wide">
                {mode === 'MANUAL' ? '✏️ Manual Entry' : '📷 OCR Upload'} mode
              </span>
              <button
                onClick={() => { setMode(null); setCurrentStep(0); setOcrData(null); setFormData({}) }}
                className="text-xs text-[#F97316] hover:text-orange-300 font-semibold transition-colors"
              >
                Change method
              </button>
            </div>
          )}

          {/* Step progress — only show after mode is selected */}
          {currentStep > 0 && <StepperNav steps={STEPS} currentStep={stepIndex} />}

          {/* Step card */}
          <div className="mt-4 rounded-2xl bg-white dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-xl dark:shadow-2xl overflow-hidden transition-colors duration-300">

            {/* Step 0: Mode picker */}
            {currentStep === 0 && (
              <ModePicker onSelect={handleModeSelect} />
            )}

            {/* Step 1: Data collection */}
            {currentStep === 1 && mode === 'MANUAL' && (
              <StepA_Manual
                onComplete={handleStepAComplete}
                onSwitchToOcr={() => { setMode('OCR') }}
              />
            )}
            {currentStep === 1 && mode === 'OCR' && (
              <StepA_Upload onComplete={handleStepAComplete} onSwitchToManual={() => { setMode('MANUAL') }} />
            )}

            {/* Step 2: Review & correct */}
            {currentStep === 2 && ocrData && (
              <StepB_ReviewForm
                ocrData={ocrData}
                onComplete={handleStepBComplete}
                onBack={() => setCurrentStep(1)}
              />
            )}

            {/* Step 3: Set password */}
            {currentStep === 3 && (
              <StepC_SetPassword
                onComplete={handleStepCComplete}
                onBack={() => setCurrentStep(2)}
              />
            )}

            {/* Step 4: Confirm & submit */}
            {currentStep === 4 && (
              <StepD_Confirm
                formData={formData as RegisterFinalRequest}
                onSuccess={handleRegistrationSuccess}
                onBack={() => setCurrentStep(3)}
              />
            )}
          </div>

          {/* Sign in link */}
          {currentStep < 4 && (
            <p className="text-center text-gray-600 dark:text-white/50 text-sm mt-6">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-[#F97316] hover:text-orange-300 font-semibold transition-colors"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </main>
    </div>
  )
}

export default RegisterPage
