import React from 'react'
import { useThemeStore } from '../../store/themeStore'

interface Props {
  lang: 'en' | 'ta'
}

const ThirukkuralBanner: React.FC<Props> = ({ lang }) => {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  return (
    <div
      className="relative w-full min-h-screen flex flex-col overflow-hidden"
      style={{
        background: isDark
          ? 'linear-gradient(135deg, #0D1F1A 0%, #1A3C34 55%, #0D2B22 100%)'
          : 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 40%, #A7F3D0 70%, #6EE7B7 100%)',
      }}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: isDark
            ? `radial-gradient(circle at 20% 50%, rgba(249,115,22,0.10) 0%, transparent 50%),
               radial-gradient(circle at 80% 20%, rgba(212,175,55,0.07) 0%, transparent 50%)`
            : `radial-gradient(circle at 20% 50%, rgba(249,115,22,0.12) 0%, transparent 50%),
               radial-gradient(circle at 80% 30%, rgba(26,60,52,0.08) 0%, transparent 50%),
               radial-gradient(circle at 50% 80%, rgba(212,175,55,0.10) 0%, transparent 50%)`,
        }}
      />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, ${isDark ? '#F97316' : '#1A3C34'} 0px, ${isDark ? '#F97316' : '#1A3C34'} 1px, transparent 1px, transparent 80px),
            repeating-linear-gradient(90deg, ${isDark ? '#F97316' : '#1A3C34'} 0px, ${isDark ? '#F97316' : '#1A3C34'} 1px, transparent 1px, transparent 80px)`,
        }}
      />

      {/* ── Top Bar ── */}
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between px-6 md:px-14 pt-24 md:pt-28 gap-4">
        {/* TN Govt Emblem */}
        <div className="flex items-center gap-3">
          <div 
            className="flex items-center justify-center rounded-full bg-white border-2 shrink-0"
            style={{
              borderColor: isDark ? '#D4AF37' : '#1A3C34',
              boxShadow: isDark ? '0 0 25px rgba(212,175,55,0.4)' : '0 4px 15px rgba(26,60,52,0.15)',
              width: '76px', height: '76px'
            }}
          >
            <img src="/tn_logo(1).webp" alt="TN Govt Logo" className="w-full h-full object-contain p-1.5 rounded-full" />
          </div>
          <div>
            <p
              className="text-xs font-bold tracking-widest uppercase"
              style={{ color: isDark ? '#D4AF37' : '#1A3C34' }}
            >
              Government of Tamil Nadu
            </p>
            <p
              className="text-xs"
              style={{ color: isDark ? 'rgba(212,175,55,0.65)' : 'rgba(26,60,52,0.65)' }}
            >
              Prohibition &amp; Excise Department
            </p>
          </div>
        </div>

        {/* TASMAC Wordmark */}
        <div className="flex flex-col items-end">
          <span
            className="text-2xl md:text-3xl font-black tracking-widest"
            style={{
              color: '#F97316',
              fontFamily: 'Poppins, sans-serif',
              textShadow: isDark
                ? '0 0 30px rgba(249,115,22,0.5)'
                : '0 2px 12px rgba(249,115,22,0.3)',
            }}
          >
            TASMAC
          </span>
          <span
            className="text-xs tracking-wider"
            style={{ color: isDark ? 'rgba(212,175,55,0.6)' : 'rgba(26,60,52,0.55)' }}
          >
            Tamil Nadu State Marketing Corp.
          </span>
        </div>
      </div>

      {/* ── Main Kural Content ── */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 md:px-12 py-14 text-center">

        {/* Decorative line + label */}
        <div className="flex items-center gap-4 mb-8">
          <div
            className="h-px w-16 md:w-28"
            style={{ background: `linear-gradient(90deg, transparent, ${isDark ? '#D4AF37' : '#1A3C34'})` }}
          />
          <span
            className="text-xs tracking-widest uppercase font-semibold"
            style={{ color: isDark ? '#D4AF37' : '#1A3C34' }}
          >
            Thirukkural 922
          </span>
          <div
            className="h-px w-16 md:w-28"
            style={{ background: `linear-gradient(90deg, ${isDark ? '#D4AF37' : '#1A3C34'}, transparent)` }}
          />
        </div>

        {/* Chapter badge */}
        <div
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-10 border"
          style={{
            background: isDark ? 'rgba(212,175,55,0.10)' : 'rgba(26,60,52,0.07)',
            borderColor: isDark ? 'rgba(212,175,55,0.35)' : 'rgba(26,60,52,0.25)',
          }}
        >
          <span className="text-xs font-semibold" style={{ color: isDark ? '#D4AF37' : '#1A3C34' }}>
            Chapter 93
          </span>
          <span style={{ color: isDark ? 'rgba(212,175,55,0.4)' : 'rgba(26,60,52,0.4)' }}>•</span>
          <span
            className="text-sm"
            style={{ color: isDark ? '#FDE68A' : '#065F46', fontFamily: 'Noto Serif Tamil, serif' }}
          >
            கள்ளுண்ணாமை
          </span>
          <span style={{ color: isDark ? 'rgba(212,175,55,0.4)' : 'rgba(26,60,52,0.4)' }}>•</span>
          <span className="text-xs italic" style={{ color: isDark ? '#D4AF37' : '#1A3C34' }}>
            On Avoiding Alcohol
          </span>
        </div>

        {/* Tamil Kural Lines */}
        <div className="mb-6 max-w-3xl">
          <p
            className="text-2xl md:text-4xl lg:text-5xl font-semibold leading-relaxed"
            style={{
              color: isDark ? '#F0FDF4' : '#064E3B',
              fontFamily: 'Noto Serif Tamil, serif',
              textShadow: isDark ? '0 2px 20px rgba(0,0,0,0.5)' : '0 1px 8px rgba(0,0,0,0.08)',
            }}
          >
            களித்தறியேன் என்பது கைவிடுக — நெஞ்சத்து
          </p>
          <p
            className="text-2xl md:text-4xl lg:text-5xl font-semibold leading-relaxed"
            style={{
              color: isDark ? '#F0FDF4' : '#064E3B',
              fontFamily: 'Noto Serif Tamil, serif',
              textShadow: isDark ? '0 2px 20px rgba(0,0,0,0.5)' : '0 1px 8px rgba(0,0,0,0.08)',
            }}
          >
            வளர்த்தது வாய்க்கும் மதி.
          </p>
          {/* Gold underline */}
          <div
            className="mx-auto mt-4 h-1 rounded-full"
            style={{
              width: '240px',
              background: isDark
                ? 'linear-gradient(90deg, transparent, #D4AF37, transparent)'
                : 'linear-gradient(90deg, transparent, #1A3C34, transparent)',
            }}
          />
        </div>

        {/* English Translation */}
        <div className="max-w-2xl mb-5">
          <p
            className="text-base md:text-lg font-light italic leading-relaxed"
            style={{ color: isDark ? '#9CA3AF' : '#374151' }}
          >
            "A mind that rejects intoxication grows in wisdom;
          </p>
          <p
            className="text-base md:text-lg font-light italic leading-relaxed"
            style={{ color: isDark ? '#9CA3AF' : '#374151' }}
          >
            only clear thought can fulfill what the heart aspires to."
          </p>
        </div>

        {/* Attribution */}
        <p
          className="text-sm md:text-base font-medium mb-10"
          style={{ color: isDark ? 'rgba(212,175,55,0.75)' : 'rgba(26,60,52,0.65)' }}
        >
          — Thiruvalluvar, Thirukkural 922
        </p>

        {/* Tagline pill */}
        <div
          className="px-8 py-3 rounded-full inline-flex items-center gap-3 font-semibold text-base md:text-xl"
          style={{
            background: isDark
              ? 'rgba(249,115,22,0.15)'
              : 'rgba(26,60,52,0.09)',
            border: `1.5px solid ${isDark ? 'rgba(249,115,22,0.4)' : 'rgba(26,60,52,0.3)'}`,
          }}
        >
          <span style={{ color: '#F97316' }}>உரிமையோடு பொறுப்பு</span>
          <span style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)' }}>—</span>
          <span style={{ color: isDark ? '#FDE68A' : '#065F46' }}>Privilege with Responsibility</span>
        </div>
      </div>

      {/* Bottom saffron accent */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1.5"
        style={{ background: 'linear-gradient(90deg, #1A3C34, #F97316, #D4AF37, #F97316, #1A3C34)' }}
      />

      {/* Scroll indicator */}
      <div className="relative z-10 flex flex-col items-center pb-8 animate-bounce">
        <span
          className="text-xs tracking-widest uppercase mb-2"
          style={{ color: isDark ? 'rgba(212,175,55,0.5)' : 'rgba(26,60,52,0.45)' }}
        >
          Scroll to explore
        </span>
        <svg
          className="w-5 h-5"
          style={{ color: isDark ? 'rgba(212,175,55,0.5)' : 'rgba(26,60,52,0.45)' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}

export default ThirukkuralBanner
