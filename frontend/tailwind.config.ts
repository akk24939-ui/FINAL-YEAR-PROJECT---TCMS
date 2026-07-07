import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1A3C34',
          50: '#E8F5F2',
          100: '#C5E4DC',
          200: '#8FC9BA',
          300: '#5AAF98',
          400: '#2D8A72',
          500: '#1A3C34',
          600: '#15302A',
          700: '#0F241F',
          800: '#0A1815',
          900: '#050C0A',
        },
        secondary: {
          DEFAULT: '#F97316',
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA6C0E',
          700: '#C2580B',
          800: '#9A4408',
          900: '#7C3606',
        },
        dark: {
          bg: '#0D1F1A',
          card: '#122820',
          border: '#1E3D33',
          text: '#F0FDF4',
        },
      },
      fontFamily: {
        tamil: ['"Noto Serif Tamil"', 'serif'],
        english: ['"Inter"', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #1A3C34 0%, #0D1F1A 100%)',
        'gradient-saffron': 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
        'gradient-hero': 'linear-gradient(160deg, #0D1F1A 0%, #1A3C34 50%, #0D1F1A 100%)',
      },
      borderRadius: {
        card: '8px',
        pill: '20px',
      },
      animation: {
        'scroll-x': 'scrollX 30s linear infinite',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'underline-grow': 'underlineGrow 1s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.25s ease-out forwards',
      },
      keyframes: {
        scrollX: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(249, 115, 22, 0)' },
          '50%': { boxShadow: '0 0 20px 8px rgba(249, 115, 22, 0.3)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        underlineGrow: {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
