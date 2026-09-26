'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import en from './en'
import {
  LANG_KEY,
  format,
  languageOf,
  loadDictionary,
  setActive,
  type Dict,
  type Language,
  type Msg,
  type Params,
} from './core'

interface I18nValue {
  lang: Language
  t: (key: string, params?: Params) => string
  tm: (message: Msg) => string
  setLang: (code: string) => void
}

const I18nContext = createContext<I18nValue | null>(null)

function applyToDocument(language: Language) {
  document.documentElement.lang = language.code
  document.documentElement.dir = language.rtl ? 'rtl' : 'ltr'
}

/**
 * Holds the chosen language. Changing it swaps the dictionary for every screen at once; the
 * choice is remembered in localStorage so the next visit opens in the same language.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ code: string; dict: Dict }>({ code: 'en', dict: en })

  const setLang = useCallback((code: string) => {
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

  // localStorage is client-only, so the saved language is restored after hydration.
  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem(LANG_KEY)
    } catch {
      saved = null
    }
    if (saved && saved !== 'en') setLang(saved)
  }, [setLang])

  const value = useMemo<I18nValue>(
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
