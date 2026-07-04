import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StepperNav from '../../../components/ui/StepperNav'
import StepA_Upload from './StepA_Upload'
import StepB_ReviewForm from './StepB_ReviewForm'
import StepC_SetPassword from './StepC_SetPassword'
import StepD_Confirm from './StepD_Confirm'
import type { OcrExtractResponse, RegisterFinalRequest } from '../../../types/consumer.types'

const STEPS = ['Upload ID', 'Review Details', 'Set Password', 'Confirm']

const RegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [ocrData, setOcrData] = useState<OcrExtractResponse | null>(null)
  const [formData, setFormData] = useState<Partial<RegisterFinalRequest>>({})

  const handleStepAComplete = (data: OcrExtractResponse) => {
    setOcrData(data)
    setCurrentStep(2)
  }

  const handleStepBComplete = (data: Partial<RegisterFinalRequest>) => {
    setFormData((prev) => ({ ...prev, ...data }))
    setCurrentStep(3)
  }

  const handleStepCComplete = (data: { password: string }) => {
    setFormData((prev) => ({ ...prev, ...data }))
    setCurrentStep(4)
  }

  const handleRegistrationSuccess = () => {
    // Navigate to login after a short pause
    setTimeout(() => navigate('/login'), 3000)
  }

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
          {/* Step progress */}
          <StepperNav steps={STEPS} currentStep={currentStep} />

          {/* Step card */}
          <div className="mt-4 rounded-2xl bg-white dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 shadow-xl dark:shadow-2xl overflow-hidden transition-colors duration-300">
            {currentStep === 1 && (
              <StepA_Upload onComplete={handleStepAComplete} />
            )}
            {currentStep === 2 && ocrData && (
              <StepB_ReviewForm
                ocrData={ocrData}
                onComplete={handleStepBComplete}
                onBack={() => setCurrentStep(1)}
              />
            )}
            {currentStep === 3 && (
              <StepC_SetPassword
                onComplete={handleStepCComplete}
                onBack={() => setCurrentStep(2)}
              />
            )}
            {currentStep === 4 && (
              <StepD_Confirm
                formData={formData as RegisterFinalRequest}
                onSuccess={handleRegistrationSuccess}
                onBack={() => setCurrentStep(3)}
              />
            )}
          </div>

          {/* Already have account */}
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
