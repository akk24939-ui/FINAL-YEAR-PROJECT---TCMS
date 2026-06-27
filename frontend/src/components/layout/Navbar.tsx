import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Moon, Sun, Globe, Menu, X } from 'lucide-react'
import { useThemeStore } from '../../store/themeStore'
import { useLanguage } from '../../hooks/useLanguage'

const Navbar: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore()
  const { lang, setLang, t } = useLanguage()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isDark = theme === 'dark'

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = [
    { label: t('nav_home'), href: '/#home' },
    { label: t('nav_about'), href: '/#about' },
    { label: t('nav_features'), href: '/#features' },
  ]

  // Design tokens
  const navBg = scrolled
    ? isDark
      ? 'rgba(13,31,26,0.95)'
      : 'rgba(255,255,255,0.96)'
    : 'transparent'
  const navBorder = scrolled
    ? isDark ? 'rgba(212,175,55,0.12)' : 'rgba(26,60,52,0.10)'
    : 'transparent'
  const textColor  = isDark ? '#D1FAE5' : '#064E3B'
  const logoText   = '#F97316'
  const mutedText  = isDark ? '#6B7280' : '#6B7280'

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: navBg,
        borderBottom: `1px solid ${navBorder}`,
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none',
        boxShadow: scrolled
          ? isDark
            ? '0 4px 24px rgba(0,0,0,0.4)'
            : '0 4px 24px rgba(26,60,52,0.10)'
          : 'none',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* ── Logo ── */}
          <Link to="/" className="flex items-center gap-2.5 group" aria-label="Smart TASMAC home">
            <div
              className="flex items-center justify-center transition-all group-hover:scale-105 rounded-full bg-white border-2 shrink-0"
              style={{
                borderColor: isDark ? '#D4AF37' : '#1A3C34',
                boxShadow: isDark ? '0 0 15px rgba(212,175,55,0.3)' : '0 2px 10px rgba(26,60,52,0.15)',
                width: '46px', height: '46px'
              }}
            >
              <img src="/tn_logo(1).webp" alt="TN Govt Logo" className="w-full h-full object-contain p-1 rounded-full" />
            </div>
            <div>
              <span className="font-extrabold text-lg leading-none" style={{ color: logoText }}>
                Smart TASMAC
              </span>
              <span
                className="hidden md:block text-xs leading-none mt-0.5"
                style={{ color: mutedText, fontFamily: 'Noto Serif Tamil, serif' }}
              >
                நுகர்வோர் கட்டுப்பாட்டு அமைப்பு
              </span>
            </div>
          </Link>

          {/* ── Desktop Nav Links ── */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium transition-colors hover:text-orange-400"
                style={{ color: textColor }}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* ── Right Controls ── */}
          <div className="flex items-center gap-2">

            {/* Language Toggle */}
            <button
              id="lang-toggle"
              onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all hover:scale-105"
              style={{
                borderColor: isDark ? 'rgba(212,175,55,0.40)' : 'rgba(26,60,52,0.30)',
                color: isDark ? '#D4AF37' : '#1A3C34',
                background: isDark ? 'rgba(212,175,55,0.08)' : 'rgba(26,60,52,0.06)',
              }}
              aria-label="Toggle language"
            >
              <Globe className="w-3.5 h-3.5" />
              {lang === 'en' ? 'தமிழ்' : 'EN'}
            </button>

            {/* ── Theme Toggle — THE STAR OF THE SHOW ── */}
            <button
              id="theme-toggle"
              onClick={toggleTheme}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all hover:scale-105"
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #1A3C34, #2D6A4F)'
                  : 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
                borderColor: isDark ? 'rgba(212,175,55,0.40)' : 'rgba(217,119,6,0.35)',
                color: isDark ? '#FDE68A' : '#92400E',
                boxShadow: isDark
                  ? '0 0 12px rgba(26,60,52,0.6)'
                  : '0 0 12px rgba(251,191,36,0.35)',
              }}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            {/* Auth Buttons (desktop) */}
            <Link
              to="/login"
              id="nav-login"
              className="hidden md:block px-4 py-2 rounded-xl text-sm font-semibold border transition-all hover:scale-105"
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,60,52,0.20)',
                color: isDark ? '#D1FAE5' : '#1A3C34',
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(26,60,52,0.04)',
              }}
            >
              {t('nav_login')}
            </Link>
            <Link
              to="/register"
              id="nav-register"
              className="hidden md:block px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, #1A3C34, #2D6A4F)',
                boxShadow: isDark ? '0 4px 14px rgba(26,60,52,0.5)' : '0 4px 14px rgba(26,60,52,0.25)',
              }}
            >
              {t('nav_register')}
            </Link>

            {/* Mobile hamburger */}
            <button
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border transition-all"
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(26,60,52,0.20)',
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(26,60,52,0.04)',
              }}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle mobile menu"
            >
              {menuOpen
                ? <X className="w-5 h-5" style={{ color: '#F97316' }} />
                : <Menu className="w-5 h-5" style={{ color: isDark ? '#D1FAE5' : '#1A3C34' }} />
              }
            </button>
          </div>
        </div>

        {/* ── Mobile Menu ── */}
        {menuOpen && (
          <div
            className="md:hidden py-4 border-t"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,60,52,0.10)' }}
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="block py-3 text-sm font-medium transition-colors hover:text-orange-400"
                style={{ color: textColor }}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="flex gap-3 pt-4">
              <Link
                to="/login"
                className="flex-1 text-center py-2.5 border rounded-xl text-sm font-semibold transition-all"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,60,52,0.20)',
                  color: isDark ? '#D1FAE5' : '#1A3C34',
                }}
              >
                {t('nav_login')}
              </Link>
              <Link
                to="/register"
                className="flex-1 text-center py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #1A3C34, #2D6A4F)' }}
              >
                {t('nav_register')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar
