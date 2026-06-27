import React from 'react'
import { Link } from 'react-router-dom'
import { PhoneCall, Mail, MapPin } from 'lucide-react'
import { useThemeStore } from '../../store/themeStore'

const Footer: React.FC = () => {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  return (
    <footer 
      className="relative border-t"
      style={{
        background: isDark ? '#0D1F1A' : '#F8FAFC',
        borderColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(26,60,52,0.1)',
        color: isDark ? '#D1FAE5' : '#1A3C34',
      }}
    >
      {/* Saffron accent line at the top of the footer */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, #F97316, #D4AF37, #F97316)' }} />

      <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          
          {/* Column 1: Brand & Govt Info */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              <div 
                className="flex items-center justify-center rounded-full bg-white border-2 shrink-0"
                style={{
                  borderColor: isDark ? '#D4AF37' : '#1A3C34',
                  boxShadow: isDark ? '0 0 15px rgba(212,175,55,0.25)' : '0 2px 10px rgba(26,60,52,0.1)',
                  width: '52px', height: '52px'
                }}
              >
                <img src="/tn_logo(1).webp" alt="TN Govt Logo" className="w-full h-full object-contain p-1 rounded-full" />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight" style={{ color: '#F97316' }}>Smart TASMAC</h3>
                <p className="text-xs" style={{ color: isDark ? '#9CA3AF' : '#4B5563' }}>Govt. of Tamil Nadu</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed mb-6" style={{ color: isDark ? '#9CA3AF' : '#4B5563' }}>
              Tamil Nadu State Marketing Corporation Ltd. The official digital platform for consumer identity, regulation, and anonymous health analytics.
            </p>
            <div 
              className="inline-block px-3 py-1.5 rounded-lg border text-xs font-semibold"
              style={{ 
                background: isDark ? 'rgba(249,115,22,0.1)' : 'rgba(249,115,22,0.05)',
                borderColor: 'rgba(249,115,22,0.3)',
                color: '#F97316'
              }}
            >
              For ages 21+ only
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="font-bold mb-6 tracking-wide" style={{ color: isDark ? '#F0FDF4' : '#064E3B' }}>Quick Links</h4>
            <ul className="space-y-3 text-sm">
              {[
                { label: 'Register as Consumer', to: '/register' },
                { label: 'Shop Operator Login', to: '/login' },
                { label: 'District Analytics', to: '/admin' },
                { label: 'Platform Features', to: '/#features' },
              ].map(link => (
                <li key={link.label}>
                  <Link 
                    to={link.to} 
                    className="transition-colors hover:text-orange-400"
                    style={{ color: isDark ? '#9CA3AF' : '#4B5563' }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Important Policies */}
          <div>
            <h4 className="font-bold mb-6 tracking-wide" style={{ color: isDark ? '#F0FDF4' : '#064E3B' }}>Policies</h4>
            <ul className="space-y-3 text-sm">
              {[
                'Terms & Conditions',
                'Privacy Policy (Data)',
                'Caretaker Consent Rules',
                'WCAG Accessibility Statement'
              ].map(link => (
                <li key={link}>
                  <a 
                    href="#" 
                    className="transition-colors hover:text-orange-400"
                    style={{ color: isDark ? '#9CA3AF' : '#4B5563' }}
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contact & Help */}
          <div>
            <h4 className="font-bold mb-6 tracking-wide" style={{ color: isDark ? '#F0FDF4' : '#064E3B' }}>Contact & Support</h4>
            <ul className="space-y-4 text-sm" style={{ color: isDark ? '#9CA3AF' : '#4B5563' }}>
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#F97316' }} />
                <span>
                  <strong>TASMAC Headquarters</strong><br/>
                  CMDA Tower-II, 4th Floor,<br/>
                  Gandhi Irwin Bridge Road, Egmore,<br/>
                  Chennai — 600 008
                </span>
              </li>
              <li className="flex items-center gap-3">
                <PhoneCall className="w-5 h-5 flex-shrink-0" style={{ color: '#F97316' }} />
                <span className="font-mono">1800 425 4477</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 flex-shrink-0" style={{ color: '#F97316' }} />
                <span>support@smart-tasmac.gov.in</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom border and copyright */}
        <div 
          className="mt-12 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,60,52,0.1)' }}
        >
          <p className="text-xs text-center md:text-left" style={{ color: isDark ? '#6B7280' : '#6B7280' }}>
            &copy; {new Date().getFullYear()} Tamil Nadu State Marketing Corporation Ltd. All rights reserved.<br/>
            Educational demonstration project. Not for commercial use.
          </p>
          <div className="flex items-center gap-4 text-xs font-semibold" style={{ color: isDark ? '#6B7280' : '#6B7280' }}>
            <span>Made with <span className="text-red-500">❤️</span> for Tamil Nadu</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
