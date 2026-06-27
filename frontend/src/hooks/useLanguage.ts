import { useState, useCallback } from 'react'
import { t, type Lang, type TranslationKey } from '../utils/i18n'

export const useLanguage = () => {
  const stored = (localStorage.getItem('tasmac-lang') as Lang) || 'en'
  const [lang, setLangState] = useState<Lang>(stored)

  const setLang = useCallback((newLang: Lang) => {
    localStorage.setItem('tasmac-lang', newLang)
    setLangState(newLang)
  }, [])

  const translate = useCallback((key: TranslationKey) => t(lang, key), [lang])

  return { lang, setLang, t: translate }
}
