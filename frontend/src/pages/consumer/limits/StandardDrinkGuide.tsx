import React from 'react'
import { Info, Beer, Wine, Droplets } from 'lucide-react'

interface DrinkRow {
  icon: React.ReactNode
  drink: string
  volume: string
  note: string
}

const DRINKS: DrinkRow[] = [
  { icon: <Beer className="w-4 h-4" />, drink: 'Beer', volume: '330–355 ml', note: '~5% alcohol' },
  { icon: <Wine className="w-4 h-4" />, drink: 'Wine', volume: '140–150 ml', note: '~12% alcohol' },
  { icon: <Droplets className="w-4 h-4" />, drink: 'Spirits / Hard Liquor', volume: '30–45 ml', note: '~40% alcohol' },
]

const StandardDrinkGuide: React.FC = () => {
  return (
    <div className="rounded-2xl bg-white dark:bg-[#0D2B22] border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-white/10 bg-[#1A3C34]/5 dark:bg-white/5">
        <div className="w-8 h-8 rounded-lg bg-[#1A3C34]/10 dark:bg-white/10 flex items-center justify-center text-[#1A3C34] dark:text-emerald-400">
          <Info className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800 dark:text-white">Standard Drink Reference Guide</h3>
          <p className="text-[11px] text-gray-400 dark:text-white/40">Each row below equals 1 standard drink (~10 g pure alcohol)</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-white/5">
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">Drink</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">Volume</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">Note</th>
              <th className="px-5 py-3 text-center text-[10px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">= 1 SD</th>
            </tr>
          </thead>
          <tbody>
            {DRINKS.map((row, i) => (
              <tr key={i} className="border-t border-gray-100 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[#1A3C34] dark:text-emerald-400">{row.icon}</span>
                    <span className="font-semibold text-gray-800 dark:text-white">{row.drink}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 font-mono text-gray-600 dark:text-white/70">{row.volume}</td>
                <td className="px-5 py-3.5 text-gray-400 dark:text-white/40 text-xs">{row.note}</td>
                <td className="px-5 py-3.5 text-center">
                  <span className="inline-block w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500 font-bold text-xs flex items-center justify-center">
                    ✓
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* WHO reference */}
      <div className="px-5 py-4 border-t border-gray-100 dark:border-white/10 bg-amber-500/5 dark:bg-amber-500/5">
        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-start gap-2">
          <span className="flex-shrink-0 font-bold">WHO Guidelines:</span>
          Max 2 standard drinks per day, 14 standard drinks per week for men; 1/day, 7/week for women.
          Any alcohol has health risks — moderation is key.
        </p>
      </div>
    </div>
  )
}

export default StandardDrinkGuide
