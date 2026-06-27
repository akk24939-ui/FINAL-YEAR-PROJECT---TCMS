import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'

interface RoleCardProps {
  icon: LucideIcon
  title: string
  description: string
  color?: string
  delay?: number
}

export default function RoleCard({
  icon: Icon,
  title,
  description,
  color = '#1A3C34',
  delay = 0,
}: RoleCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="group relative rounded-card p-6 bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border
        hover:border-primary/50 dark:hover:border-secondary/50 transition-all duration-300
        hover:shadow-2xl hover:shadow-primary/20 dark:hover:shadow-secondary/10 cursor-pointer"
    >
      {/* Glow background */}
      <div
        className="absolute inset-0 rounded-card opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at top left, ${color}15, transparent 70%)`,
        }}
      />

      {/* Icon */}
      <div
        className="relative w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
        style={{ backgroundColor: `${color}18` }}
      >
        <Icon
          size={28}
          style={{ color }}
          className="transition-colors duration-300"
        />
      </div>

      {/* Content */}
      <h3 className="relative text-base font-bold text-gray-900 dark:text-dark-text mb-2 group-hover:text-primary dark:group-hover:text-secondary transition-colors duration-300">
        {title}
      </h3>
      <p className="relative text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        {description}
      </p>

      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500 rounded-b-card"
        style={{ backgroundColor: color }}
      />
    </motion.div>
  )
}
