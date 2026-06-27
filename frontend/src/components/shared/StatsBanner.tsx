import { motion } from 'framer-motion'

const STATS = [
  { label: '6,860+ TASMAC Shops', icon: '🏪' },
  { label: '38 Districts Covered', icon: '🗺️' },
  { label: '5 User Roles', icon: '👥' },
  { label: 'Legal Age: 21+', icon: '⚖️' },
  { label: '100% Secure JWT', icon: '🔐' },
  { label: 'WCAG 2.1 AA', icon: '♿' },
  { label: 'Multilingual Support', icon: '🌐' },
  { label: 'Govt of TN Certified', icon: '✅' },
]

// Duplicate for seamless loop
const ALL_STATS = [...STATS, ...STATS]

export default function StatsBanner() {
  return (
    <div
      className="w-full overflow-hidden bg-gradient-saffron py-3"
      aria-label="Statistics banner"
    >
      <div className="scroll-strip gap-0">
        {ALL_STATS.map((stat, i) => (
          <div
            key={`${stat.label}-${i}`}
            className="flex items-center gap-2 px-6 whitespace-nowrap text-white font-semibold text-sm"
          >
            <span className="text-base">{stat.icon}</span>
            <span>{stat.label}</span>
            <span className="ml-4 text-white/40 font-light">|</span>
          </div>
        ))}
      </div>
    </div>
  )
}
