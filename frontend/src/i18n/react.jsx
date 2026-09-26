import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import en from './en'
import { LANG_KEY, format, languageOf, loadDictionary, setActive } from './core'

const I18nContext = createContext(null)

function applyToDocument(language) {
  document.documentElement.lang = language.code
  document.documentElement.dir = language.rtl ? 'rtl' : 'ltr'
}

function savedLanguage() {
  try {
    return localStorage.getItem(LANG_KEY) || 'en'
  } catch {
    return 'en'
  }
}

/**
 * Holds the chosen language. Changing it swaps the dictionary for every screen at once; the
 * choice is remembered in localStorage so the next visit opens in the same language.
 */
export function I18nProvider({ children }) {
  const [state, setState] = useState({ code: 'en', dict: en })

  const setLang = useCallback((code) => {
    loadDictionary(code).then((dict) => {
      setActive(code, dict)
      applyToDocument(languageOf(code))
      setState({ code, dict })
      try {
        localStorage.setItem(LANG_KEY, code)
      } catch {
        // Private browsing: the choice lasts for this visit only.
      }
    })
  }, [])

  useEffect(() => {
    const saved = savedLanguage()
    if (saved !== 'en') setLang(saved)
  }, [setLang])

  const value = useMemo(
    () => ({
      lang: languageOf(state.code),
      t: (key, params) => format(state.dict, key, params),
      tm: (message) => format(state.dict, message.k, message.p),
      setLang,
    }),
    [state, setLang],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used inside I18nProvider')
  return context
}
