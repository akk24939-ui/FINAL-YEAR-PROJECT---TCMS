import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingBag, Settings, BarChart3, Stethoscope, Users,
  Shield, QrCode, Bell, FileText, Globe, Moon,
  CheckCircle, ArrowRight, Building2, Zap,
} from 'lucide-react'
import ThirukkuralBanner from '../components/shared/ThirukkuralBanner'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import { useThemeStore } from '../store/themeStore'
import { useLanguage } from '../hooks/useLanguage'

// ─── Stats Ticker ──────────────────────────────────────────────────────────────
const statItems = [
  '🏪 6,860+ TASMAC Shops',
  '🗺️ 38 Districts Covered',
  '👥 5 User Roles',
  '⚖️ Legal Age 21+',
  '🔐 JWT + bcrypt Security',
  '♿ WCAG 2.1 AA Accessible',
  '📊 Real-time Analytics',
  '📱 QR Consumer Identity',
]

const StatsTicker: React.FC = () => (
  <div className="overflow-hidden" style={{ background: 'linear-gradient(90deg, #1A3C34, #2D6A4F, #1A3C34)' }}>
    <div className="flex">
      <div className="stats-scroll flex gap-0 py-3 whitespace-nowrap">
        {[...statItems, ...statItems].map((item, i) => (
          <span key={i} className="text-white font-medium text-sm flex-shrink-0 flex items-center gap-6 px-6">
            {item}
            <span className="opacity-30 text-orange-300">|</span>
          </span>
        ))}
      </div>
    </div>
  </div>
)

// ─── Roles ─────────────────────────────────────────────────────────────────────
const roles = [
  { icon: <Users className="w-7 h-7" />, title: 'Consumer', tamil: 'நுகர்வோர்', desc: 'Track purchases, set personal limits, use QR identity at every outlet.', color: '#1A3C34', lightBg: '#ECFDF5' },
  { icon: <ShoppingBag className="w-7 h-7" />, title: 'Shop Operator', tamil: 'கடை இயக்குநர்', desc: 'Verify consumers via QR scan. Record sales. Prevent over-limit purchases.', color: '#1E40AF', lightBg: '#EFF6FF' },
  { icon: <BarChart3 className="w-7 h-7" />, title: 'Govt. Admin', tamil: 'அரசு நிர்வாகி', desc: 'District analytics, revenue reports, compliance data across 38 districts.', color: '#7C3AED', lightBg: '#F5F3FF' },
  { icon: <Stethoscope className="w-7 h-7" />, title: 'Doctor', tamil: 'மருத்துவர்', desc: 'Anonymous health trend data and addiction risk analytics by district.', color: '#0369A1', lightBg: '#EFF6FF' },
  { icon: <Shield className="w-7 h-7" />, title: 'Caretaker', tamil: 'பராமரிப்பாளர்', desc: "Monitor your loved one's limits with their consent. Get real-time alerts.", color: '#B45309', lightBg: '#FFFBEB' },
]

// ─── Features ──────────────────────────────────────────────────────────────────
const features = [
  { icon: <Settings className="w-5 h-5" />, label: 'Self-Limit Setting', sub: 'Daily / Weekly / Monthly' },
  { icon: <QrCode className="w-5 h-5" />, label: 'QR Consumer Profile', sub: 'Instant verification' },
  { icon: <Shield className="w-5 h-5" />, label: 'Teetotaler Mode', sub: 'Voluntary self-restriction' },
  { icon: <FileText className="w-5 h-5" />, label: 'PDF History Report', sub: 'Downloadable records' },
  { icon: <Bell className="w-5 h-5" />, label: 'Real-time Alerts', sub: 'Limit approach warnings' },
  { icon: <Users className="w-5 h-5" />, label: 'Caretaker Consent', sub: 'Privacy-first monitoring' },
  { icon: <BarChart3 className="w-5 h-5" />, label: 'Govt. Dashboard', sub: 'District analytics' },
  { icon: <Stethoscope className="w-5 h-5" />, label: 'Health Trends', sub: 'Anonymized data' },
  { icon: <Globe className="w-5 h-5" />, label: 'Bilingual Platform', sub: 'Tamil + English' },
  { icon: <Moon className="w-5 h-5" />, label: 'Dark & Light Mode', sub: 'WCAG 2.1 AA' },
]

// ─── Steps ─────────────────────────────────────────────────────────────────────
const steps = [
  { step: '01', title: 'Register', desc: 'Create your account with mock Aadhaar verification. Age check ensures 21+ compliance.', icon: <Users className="w-6 h-6" /> },
  { step: '02', title: 'Set Limits', desc: 'Configure daily, weekly, monthly limits. Enable teetotaler mode or link a caretaker.', icon: <Settings className="w-6 h-6" /> },
  { step: '03', title: 'Stay in Control', desc: 'Every TASMAC purchase is recorded. Receive alerts. Download history as PDF anytime.', icon: <CheckCircle className="w-6 h-6" /> },
]

// ─── TN Stats ──────────────────────────────────────────────────────────────────
const tnStats = [
  { label: 'TASMAC Retail Outlets', value: '6,860+', icon: '🏪' },
  { label: 'Districts Covered', value: '38', icon: '🗺️' },
  { label: 'Legal Drinking Age', value: '21+', icon: '⚖️' },
  { label: 'Platform Roles', value: '5', icon: '👥' },
  { label: 'Security Standard', value: 'JWT+AES', icon: '🔐' },
  { label: 'Accessibility', value: 'WCAG 2.1 AA', icon: '♿' },
]

// ─── InView hook ───────────────────────────────────────────────────────────────
const useInView = () => {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold: 0.08 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return { ref, inView }
}

// ─── Section heading ───────────────────────────────────────────────────────────
interface SectionHeadingProps {
  eyebrow: string
  title: string
  isDark: boolean
}
const SectionHeading: React.FC<SectionHeadingProps> = ({ eyebrow, title, isDark }) => (
  <div className="text-center mb-12">
    <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#F97316' }}>
      {eyebrow}
    </span>
    <h2 className="text-3xl md:text-4xl font-extrabold mt-2 mb-5" style={{ color: isDark ? '#F0FDF4' : '#064E3B' }}>
      {title}
    </h2>
    <div className="w-20 h-1 mx-auto rounded-full" style={{ background: 'linear-gradient(90deg, #1A3C34, #F97316)' }} />
  </div>
)

// ═══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════════════════════════════
const LandingPage: React.FC = () => {
  const { theme } = useThemeStore()
  const { lang, t } = useLanguage()
  const isDark = theme === 'dark'

  // Theme-aware design tokens
  const pageBg        = isDark ? '#0D1F1A'                          : '#FFFFFF'
  const altBg         = isDark ? 'rgba(26,60,52,0.18)'              : '#F0FDF9'
  const cardBg        = isDark ? 'rgba(26,60,52,0.40)'              : '#FFFFFF'
  const cardBorder    = isDark ? 'rgba(212,175,55,0.13)'            : 'rgba(26,60,52,0.12)'
  const cardShadow    = isDark ? 'none'                              : '0 4px 24px rgba(26,60,52,0.08)'
  const textPrimary   = isDark ? '#F0FDF4'                          : '#064E3B'
  const textSecondary = isDark ? '#9CA3AF'                          : '#374151'
  const textMuted     = isDark ? '#6B7280'                          : '#6B7280'
  const subHeroBg     = isDark ? '#0A1A14'                          : '#F0FDF9'
  const inputBorder   = isDark ? 'rgba(212,175,55,0.20)'            : 'rgba(26,60,52,0.18)'

  const aboutRef   = useInView()
  const rolesRef   = useInView()
  const featRef    = useInView()
  const stepsRef   = useInView()
  const statsRef   = useInView()

  const animClass = (inView: boolean) =>
    `transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`

  return (
    <div style={{ background: pageBg, color: textPrimary, minHeight: '100vh' }}>
      <Navbar />

      {/* ══ SECTION 1 — HERO ══════════════════════════════════════════════════ */}
      <section id="home">
        <ThirukkuralBanner lang={lang} />

        {/* Sub-hero: tagline + CTAs + ticker */}
        <div style={{ background: subHeroBg }}>
          {/* Gradient divider between hero and sub-hero */}
          <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, #1A3C34, #F97316, #1A3C34, transparent)' }} />

          <div className="text-center py-16 px-6 max-w-4xl mx-auto">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-semibold tracking-wide border"
              style={{
                background: isDark ? 'rgba(249,115,22,0.10)' : 'rgba(249,115,22,0.08)',
                borderColor: isDark ? 'rgba(249,115,22,0.30)' : 'rgba(249,115,22,0.25)',
                color: '#F97316',
              }}
            >
              🏛️ Tamil Nadu's First Digital Alcohol Regulation Platform
            </div>

            <h2
              className="text-2xl md:text-3xl font-light leading-relaxed mb-10"
              style={{ color: textSecondary }}
            >
              {t('hero_subtitle')}
            </h2>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link
                to="/register"
                id="cta-register"
                className="px-8 py-4 rounded-2xl font-bold text-white text-lg transition-all hover:scale-105 flex items-center gap-2 justify-center"
                style={{
                  background: 'linear-gradient(135deg, #1A3C34, #2D6A4F)',
                  boxShadow: isDark
                    ? '0 8px 32px rgba(26,60,52,0.5)'
                    : '0 8px 32px rgba(26,60,52,0.25)',
                }}
              >
                {t('cta_register')}
              </Link>
              <Link
                to="/login"
                id="cta-operator"
                className="px-8 py-4 rounded-2xl font-bold text-lg transition-all hover:scale-105 flex items-center gap-2 justify-center border-2"
                style={{
                  borderColor: '#F97316',
                  color: '#F97316',
                  background: isDark ? 'rgba(249,115,22,0.08)' : 'rgba(249,115,22,0.05)',
                }}
              >
                {t('cta_operator')}
              </Link>
            </div>

            {/* Stats ticker */}
            <StatsTicker />
          </div>
        </div>
      </section>

      {/* ══ SECTION 2 — ABOUT ════════════════════════════════════════════════ */}
      <section id="about" className="section-padding" style={{ background: pageBg }}>
        <div className="max-w-7xl mx-auto">
          <div ref={aboutRef.ref} className={animClass(aboutRef.inView)}>
            <SectionHeading eyebrow="About the Platform" title={t('about_title')} isDark={isDark} />

            <div className="grid md:grid-cols-2 gap-14 items-center">
              <div>
                <p className="text-lg leading-relaxed mb-7" style={{ color: textSecondary }}>
                  {t('about_body')}
                </p>
                <ul className="space-y-3">
                  {[
                    'Consumers set daily, weekly & monthly personal limits',
                    'Shop operators verify identity via QR code scan',
                    'Doctors access anonymous, privacy-safe health analytics',
                    'Caretakers monitor with explicit consumer consent only',
                    'Govt. admins view district revenue & compliance data',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#F97316' }} />
                      <span style={{ color: textSecondary }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                {/* Authority card */}
                <div
                  className="rounded-2xl p-6 border"
                  style={{ background: cardBg, borderColor: cardBorder, boxShadow: cardShadow }}
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(249,115,22,0.12)', color: '#F97316' }}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <span className="font-bold" style={{ color: textPrimary }}>Official Authority</span>
                  </div>
                  {[
                    { dot: '#F97316', label: 'TASMAC', sub: '— Tamil Nadu State Marketing Corporation Ltd.' },
                    { dot: '#D4AF37', label: 'Prohibition & Excise Dept.', sub: '' },
                    { dot: '#1A3C34', label: 'Government of Tamil Nadu', sub: '' },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: row.dot }} />
                      <span className="font-semibold text-sm" style={{ color: textPrimary }}>{row.label}</span>
                      {row.sub && <span className="text-sm" style={{ color: textSecondary }}>{row.sub}</span>}
                    </div>
                  ))}
                </div>

                {/* HQ Card */}
                <div
                  className="rounded-2xl p-6 border"
                  style={{ background: cardBg, borderColor: cardBorder, boxShadow: cardShadow }}
                >
                  <p className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: '#F97316' }}>
                    TASMAC Headquarters
                  </p>
                  <p className="font-bold" style={{ color: textPrimary }}>No. 800, Anna Salai</p>
                  <p style={{ color: textSecondary }}>Chennai — 600 002, Tamil Nadu, India</p>
                  <div
                    className="mt-4 p-3 rounded-xl border"
                    style={{
                      background: isDark ? 'rgba(212,175,55,0.07)' : '#FFFBEB',
                      borderColor: isDark ? 'rgba(212,175,55,0.2)' : '#FDE68A',
                    }}
                  >
                    <p className="text-xs" style={{ color: isDark ? '#D4AF37' : '#92400E' }}>
                      ⚠️ Educational demo only. Uses mock Aadhaar data. No real identity services.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ SECTION 3 — USER ROLES ═══════════════════════════════════════════ */}
      <section id="roles" className="section-padding" style={{ background: altBg }}>
        <div className="max-w-7xl mx-auto">
          <div ref={rolesRef.ref} className={animClass(rolesRef.inView)}>
            <SectionHeading eyebrow="User Roles" title={t('roles_title')} isDark={isDark} />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {roles.map((role, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-6 border cursor-pointer group transition-all duration-300"
                  style={{
                    background: cardBg,
                    borderColor: cardBorder,
                    boxShadow: cardShadow,
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.borderColor = '#F97316'
                    el.style.transform = 'translateY(-6px)'
                    el.style.boxShadow = isDark
                      ? '0 20px 40px rgba(249,115,22,0.15)'
                      : '0 20px 40px rgba(26,60,52,0.14)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.borderColor = cardBorder
                    el.style.transform = 'translateY(0)'
                    el.style.boxShadow = cardShadow
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                    style={{
                      background: isDark ? `${role.color}22` : role.lightBg,
                      color: role.color,
                    }}
                  >
                    {role.icon}
                  </div>
                  <h3 className="font-bold mb-1" style={{ color: textPrimary }}>{role.title}</h3>
                  <p className="text-xs mb-3" style={{ color: '#F97316', fontFamily: 'Noto Serif Tamil, serif' }}>
                    {role.tamil}
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: textSecondary }}>{role.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ SECTION 4 — KEY FEATURES ════════════════════════════════════════ */}
      <section id="features" className="section-padding" style={{ background: pageBg }}>
        <div className="max-w-7xl mx-auto">
          <div ref={featRef.ref} className={animClass(featRef.inView)}>
            <SectionHeading eyebrow="Platform Features" title={t('features_title')} isDark={isDark} />

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {features.map((f, i) => (
                <div
                  key={i}
                  className="rounded-xl p-5 border text-center group transition-all duration-300 cursor-default"
                  style={{
                    background: cardBg,
                    borderColor: cardBorder,
                    boxShadow: cardShadow,
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.borderColor = '#1A3C34'
                    el.style.transform = 'translateY(-4px)'
                    el.style.boxShadow = isDark
                      ? '0 12px 30px rgba(26,60,52,0.35)'
                      : '0 12px 30px rgba(26,60,52,0.12)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.borderColor = cardBorder
                    el.style.transform = 'translateY(0)'
                    el.style.boxShadow = cardShadow
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 transition-transform duration-300 group-hover:scale-110"
                    style={{ background: 'rgba(249,115,22,0.10)', color: '#F97316' }}
                  >
                    {f.icon}
                  </div>
                  <p className="font-semibold text-sm" style={{ color: textPrimary }}>{f.label}</p>
                  <p className="text-xs mt-1" style={{ color: textMuted }}>{f.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ SECTION 5 — HOW IT WORKS ════════════════════════════════════════ */}
      <section className="section-padding" style={{ background: altBg }}>
        <div className="max-w-5xl mx-auto">
          <div ref={stepsRef.ref} className={animClass(stepsRef.inView)}>
            <SectionHeading eyebrow="Process" title={t('how_title')} isDark={isDark} />

            <div className="relative">
              {/* Connecting line (desktop) */}
              <div
                className="hidden md:block absolute top-10 left-[18%] right-[18%] h-0.5"
                style={{ background: 'linear-gradient(90deg, #1A3C34, #F97316, #1A3C34)', opacity: 0.4 }}
              />

              <div className="grid md:grid-cols-3 gap-10">
                {steps.map((s, i) => (
                  <div key={i} className="text-center">
                    <div
                      className="relative inline-flex w-20 h-20 rounded-2xl items-center justify-center mb-6 mx-auto shadow-lg"
                      style={{
                        background: isDark
                          ? 'linear-gradient(135deg, #1A3C34, #2D6A4F)'
                          : 'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
                        color: isDark ? 'white' : '#065F46',
                        border: `2px solid ${isDark ? 'rgba(212,175,55,0.2)' : 'rgba(26,60,52,0.15)'}`,
                        boxShadow: isDark
                          ? '0 8px 24px rgba(26,60,52,0.5)'
                          : '0 8px 24px rgba(26,60,52,0.12)',
                      }}
                    >
                      {s.icon}
                      <span
                        className="absolute -top-3 -right-3 w-7 h-7 rounded-full text-xs font-black flex items-center justify-center text-white shadow"
                        style={{ background: '#F97316' }}
                      >
                        {s.step}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-3" style={{ color: textPrimary }}>{s.title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: textSecondary }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ SECTION 6 — TN STATISTICS ══════════════════════════════════════ */}
      <section
        className="section-padding"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, #1A3C34 0%, #0D2B22 100%)'
            : 'linear-gradient(135deg, #064E3B 0%, #065F46 60%, #047857 100%)',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div ref={statsRef.ref} className={animClass(statsRef.inView)}>
            <div className="text-center mb-12">
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#FCD34D' }}>
                Statistics
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold mt-2 mb-5 text-white">
                {t('stats_title')}
              </h2>
              <div
                className="w-20 h-1 mx-auto rounded-full"
                style={{ background: 'linear-gradient(90deg, #F97316, #D4AF37)' }}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
              {tnStats.map((s, i) => (
                <div
                  key={i}
                  className="text-center rounded-2xl p-6 border transition-all duration-300 hover:scale-105"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    borderColor: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <div className="text-3xl mb-3">{s.icon}</div>
                  <p className="text-2xl md:text-3xl font-black mb-1" style={{ color: '#FCD34D' }}>{s.value}</p>
                  <p className="text-xs text-green-200 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ SECTION 7 — GOVERNMENT TRUST BAND ════════════════════════════════ */}
      <section className="section-padding" style={{ background: pageBg }}>
        <div className="max-w-5xl mx-auto text-center">
          <div className="mb-6">
            <Zap className="w-10 h-10 mx-auto mb-4" style={{ color: '#F97316' }} />
            <h2 className="text-3xl md:text-4xl font-extrabold mb-6" style={{ color: textPrimary }}>
              {t('trust_title')}
            </h2>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {[
              { label: 'Govt. of Tamil Nadu', icon: '🏛️' },
              { label: 'TASMAC', icon: '🏪' },
              { label: 'Prohibition & Excise', icon: '⚖️' },
            ].map((badge, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-6 py-3 rounded-full border-2 font-semibold transition-all duration-300 hover:scale-105"
                style={{
                  borderColor: '#1A3C34',
                  color: isDark ? '#F0FDF4' : '#1A3C34',
                  background: isDark ? 'rgba(26,60,52,0.20)' : 'rgba(236,253,245,0.8)',
                  boxShadow: isDark ? 'none' : '0 2px 12px rgba(26,60,52,0.08)',
                }}
              >
                <span>{badge.icon}</span>
                <span>{badge.label}</span>
              </div>
            ))}
          </div>

          {/* Tech stack + disclaimer card */}
          <div
            className="rounded-2xl p-8 border"
            style={{ background: cardBg, borderColor: cardBorder, boxShadow: cardShadow }}
          >
            <div className="mb-6">
              <p className="font-bold text-lg mb-1" style={{ color: textPrimary }}>Designed & Developed By</p>
              <p className="font-black text-xl tracking-wide" style={{ color: '#F97316' }}>Akash KK & Dinesh SM</p>
            </div>
            
            <p className="text-sm font-bold mb-4 mt-6 pt-6 border-t" style={{ borderColor: isDark ? '#374151' : '#E5E7EB', color: '#F97316' }}>🛠️ Powered By</p>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {['React 18', 'TypeScript', 'FastAPI', 'PostgreSQL 15', 'SQLAlchemy 2.0', 'JWT Auth', 'bcrypt', 'Docker', 'Tailwind CSS'].map(tech => (
                <span
                  key={tech}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border"
                  style={{
                    borderColor: isDark ? '#374151' : '#D1FAE5',
                    color: textSecondary,
                    background: isDark ? 'rgba(26,60,52,0.3)' : '#F0FDF9',
                  }}
                >
                  {tech}
                </span>
              ))}
            </div>
            <p className="text-xs italic" style={{ color: textMuted }}>
              ⚠️ Educational demonstration only. Uses mock Aadhaar data. Not affiliated with UIDAI or actual Aadhaar services.
            </p>
          </div>

          {/* Final CTA */}
          <div className="mt-14">
            <Link
              to="/register"
              id="cta-final"
              className="inline-flex items-center gap-3 px-12 py-5 rounded-2xl font-bold text-xl text-white transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #1A3C34, #2D6A4F)',
                boxShadow: isDark
                  ? '0 20px 50px rgba(26,60,52,0.5)'
                  : '0 20px 50px rgba(26,60,52,0.28)',
              }}
            >
              Get Started Today <ArrowRight className="w-6 h-6" />
            </Link>
            <p className="mt-4 text-sm" style={{ color: textMuted }}>
              Free to use • Educational demo • No real personal data collected
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

export default LandingPage
