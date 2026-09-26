import { useCallback, useState } from 'react'
import { Check, Translate } from '@phosphor-icons/react'
import { LANGUAGES } from './core'
import { useI18n } from './react'
import { useClickAway } from '../components'

/**
 * The small language button: the current language in its own script, opening a list of English
 * and all 22 scheduled Indian languages, each written in its own script.
 */
export default function LanguageSwitcher({ className = '' }) {
  const { lang, setLang, t } = useI18n()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useClickAway(open, close)

  return (
    <div className={`lang-switch ${className}`} ref={ref}>
      <button
        type="button"
        className="lang-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('lang.label')}: ${lang.native}`}
        data-testid="language-button"
        onClick={() => setOpen((v) => !v)}
      >
        <Translate size={16} />
        <span>{lang.native}</span>
      </button>

      {open ? (
        <div className="lang-panel" role="listbox" aria-label={t('lang.choose')}>
          <p className="lang-panel-title">{t('lang.choose')}</p>
          <div className="lang-grid">
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
                  className="lang-option"
                  onClick={() => {
                    setLang(language.code)
                    close()
                  }}
                >
                  <span className="lang-native">
                    {language.native}
                    {selected ? <Check size={14} /> : null}
                  </span>
                  <span className="lang-name" dir="ltr">
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
