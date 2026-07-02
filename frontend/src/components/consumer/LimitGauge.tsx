import React from 'react'

interface LimitGaugeProps {
  value: number   // current consumption in standard drinks
  max: number     // limit in standard drinks
  label: string   // e.g. 'Daily'
  unit?: string   // default 'std drinks'
}

const LimitGauge: React.FC<LimitGaugeProps> = ({ value, max, label, unit = 'std drinks' }) => {
  const safeMax = max > 0 ? max : 1
  const pct = Math.min(1, value / safeMax)
  const percentage = Math.round(pct * 100)

  // Color thresholds
  const color =
    pct < 0.6
      ? '#22C55E'  // green
      : pct < 0.8
      ? '#F97316'  // amber/saffron
      : '#EF4444'  // red

  // SVG arc params
  const size = 120
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = Math.PI * radius // half-circle arc length
  const offset = circumference * (1 - pct)

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size / 2 + strokeWidth} viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}>
        {/* Background arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
          strokeLinecap="round"
        />
        {/* Foreground arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        />
        {/* Center text */}
        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          fontSize="20"
          fontWeight="800"
          fill={color}
        >
          {percentage}%
        </text>
      </svg>

      <div className="text-center">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-sm font-bold text-gray-800 dark:text-gray-100 mt-0.5">
          <span style={{ color }}>{value}</span>
          <span className="text-gray-400 dark:text-gray-500"> / {max}</span>
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500">{unit}</p>
      </div>
    </div>
  )
}

export default LimitGauge
