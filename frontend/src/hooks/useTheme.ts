import { useThemeStore } from '../store/themeStore'

export function useTheme() {
  const { theme, toggleTheme, setTheme } = useThemeStore()
  return { theme, toggleTheme, setTheme, isDark: theme === 'dark' }
}
