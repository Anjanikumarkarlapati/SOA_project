'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Translate } from '@phosphor-icons/react'
import { LANGUAGES } from '@/lib/i18n/core'
import { useI18n } from '@/lib/i18n/react'

/**
 * The small language button. Shows the current language in its own script; opens a list of
 * English and all 22 scheduled Indian languages, each written in its own script so a reader
 * can find theirs without reading English.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('lang.label')}: ${lang.native}`}
        data-testid="language-button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-hairline-strong bg-surface px-3 text-[13px] font-medium transition hover:bg-raised"
      >
        <Translate size={16} />
        <span className="max-w-24 truncate">{lang.native}</span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={t('lang.choose')}
          className="absolute end-0 top-full z-50 mt-2 w-[min(92vw,420px)] rounded-xl border border-border bg-surface p-2 shadow-xl"
        >
          <p className="px-2 pb-2 pt-1 text-xs font-semibold text-muted-foreground">{t('lang.choose')}</p>
          <div className="grid max-h-[60vh] grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
            {LANGUAGES.map((language) => {
              const selected = language.code === lang.code
              return (
                <button
                  key={language.code}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  lang={language.code}
                  dir={language.rtl ? 'rtl' : 'ltr'}
                  data-lang={language.code}
                  onClick={() => {
                    setLang(language.code)
                    setOpen(false)
                  }}
                  className={`flex min-h-11 flex-col items-start justify-center rounded-lg px-2.5 py-1.5 text-start transition ${
                    selected ? 'bg-brand-wash text-brand' : 'hover:bg-raised'
                  }`}
                >
                  <span className="flex w-full items-center gap-1 text-[14px] font-semibold leading-tight">
                    {language.native}
                    {selected ? <Check size={14} className="ms-auto flex-none" /> : null}
                  </span>
                  <span className="text-[11px] text-muted-foreground" dir="ltr">
                    {language.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
