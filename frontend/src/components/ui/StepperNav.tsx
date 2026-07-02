import React from 'react'
import { Check } from 'lucide-react'

interface StepperNavProps {
  steps: string[]
  currentStep: number // 1-based
}

const StepperNav: React.FC<StepperNavProps> = ({ steps, currentStep }) => {
  return (
    <div className="w-full flex items-center justify-center px-4 py-6">
      {steps.map((label, index) => {
        const stepNum = index + 1
        const isCompleted = stepNum < currentStep
        const isCurrent = stepNum === currentStep
        const isFuture = stepNum > currentStep

        return (
          <React.Fragment key={stepNum}>
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5 min-w-[60px]">
              <div
                className={[
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300',
                  isCompleted
                    ? 'bg-[#1A3C34] text-white shadow-md'
                    : isCurrent
                    ? 'bg-[#F97316] text-white shadow-lg ring-4 ring-orange-200 dark:ring-orange-900'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
                ].join(' ')}
              >
                {isCompleted ? <Check className="w-4 h-4" strokeWidth={3} /> : stepNum}
              </div>
              <span
                className={[
                  'text-[10px] font-semibold uppercase tracking-wide text-center leading-tight max-w-[64px]',
                  isCurrent
                    ? 'text-[#F97316]'
                    : isCompleted
                    ? 'text-[#1A3C34] dark:text-emerald-400'
                    : 'text-gray-400 dark:text-gray-500',
                ].join(' ')}
              >
                {label}
              </span>
            </div>

            {/* Connector line between steps */}
            {index < steps.length - 1 && (
              <div
                className={[
                  'flex-1 h-0.5 mx-2 mb-5 rounded-full transition-all duration-500',
                  isCompleted
                    ? 'bg-[#1A3C34] dark:bg-emerald-600'
                    : 'bg-gray-200 dark:bg-gray-700',
                ].join(' ')}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export default StepperNav
