/**
 * ThemeContext.tsx
 *
 * Bridges the Zustand themeStore into React Context so child components
 * can consume theme state without importing Zustand directly.
 *
 * Usage:
 *   const { theme, toggleTheme } = useTheme()
 */
import React, { createContext, useContext } from 'react'
import { useThemeStore } from '../store/themeStore'

interface ThemeContextValue {
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme, toggleTheme } = useThemeStore()

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
