/*
 * Translation core, shared by both dashboards (web/src/lib/i18n and frontend/src/i18n keep
 * identical copies). Strings are looked up by key in the active language, falling back to
 * English, so a missing translation shows English rather than a raw key.
 *
 * `{name}` placeholders are filled from params. A param can itself be a message ({ k, p }),
 * which is translated too - that is how the automation engine hands over sentences that
 * contain a crop name or a temperature band without knowing the language.
 */

import en from './en'

export type Dict = Record<string, string>
export type Msg = { k: string; p?: Params }
export type Params = Record<string, string | number | Msg | null | undefined>

export interface Language {
  code: string
  /** Name in its own script - what the picker shows. */
  native: string
  /** English name, shown beside it. */
  name: string
  /** BCP 47 tag for dates and numbers. */
  locale: string
  rtl?: boolean
}

/** English plus all 22 languages of the Eighth Schedule, most spoken first. */
export const LANGUAGES: Language[] = [
  { code: 'en', native: 'English', name: 'English', locale: 'en-IN' },
  { code: 'hi', native: 'हिन्दी', name: 'Hindi', locale: 'hi-IN' },
  { code: 'bn', native: 'বাংলা', name: 'Bengali', locale: 'bn-IN' },
  { code: 'mr', native: 'मराठी', name: 'Marathi', locale: 'mr-IN' },
  { code: 'te', native: 'తెలుగు', name: 'Telugu', locale: 'te-IN' },
  { code: 'ta', native: 'தமிழ்', name: 'Tamil', locale: 'ta-IN' },
  { code: 'gu', native: 'ગુજરાતી', name: 'Gujarati', locale: 'gu-IN' },
  { code: 'ur', native: 'اردو', name: 'Urdu', locale: 'ur-IN', rtl: true },
  { code: 'kn', native: 'ಕನ್ನಡ', name: 'Kannada', locale: 'kn-IN' },
  { code: 'or', native: 'ଓଡ଼ିଆ', name: 'Odia', locale: 'or-IN' },
  { code: 'ml', native: 'മലയാളം', name: 'Malayalam', locale: 'ml-IN' },
  { code: 'pa', native: 'ਪੰਜਾਬੀ', name: 'Punjabi', locale: 'pa-IN' },
  { code: 'as', native: 'অসমীয়া', name: 'Assamese', locale: 'as-IN' },
  { code: 'mai', native: 'मैथिली', name: 'Maithili', locale: 'mai-IN' },
  { code: 'sat', native: 'ᱥᱟᱱᱛᱟᱲᱤ', name: 'Santali', locale: 'sat-IN' },
  { code: 'ks', native: 'کٲشُر', name: 'Kashmiri', locale: 'ks-IN', rtl: true },
  { code: 'ne', native: 'नेपाली', name: 'Nepali', locale: 'ne-IN' },
  { code: 'sd', native: 'سنڌي', name: 'Sindhi', locale: 'sd-IN', rtl: true },
  { code: 'doi', native: 'डोगरी', name: 'Dogri', locale: 'doi-IN' },
  { code: 'kok', native: 'कोंकणी', name: 'Konkani', locale: 'kok-IN' },
  { code: 'mni', native: 'মৈতৈলোন্', name: 'Manipuri', locale: 'mni-IN' },
  { code: 'brx', native: 'बड़ो', name: 'Bodo', locale: 'brx-IN' },
  { code: 'sa', native: 'संस्कृतम्', name: 'Sanskrit', locale: 'sa-IN' },
]

export const LANG_KEY = 'agritech.lang'

export function languageOf(code: string): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]
}

/** Each language is its own chunk, fetched only when someone picks it. */
const LOADERS: Record<string, () => Promise<{ default: Dict }>> = {
  hi: () => import('./locales/hi'),
  bn: () => import('./locales/bn'),
  mr: () => import('./locales/mr'),
  te: () => import('./locales/te'),
  ta: () => import('./locales/ta'),
  gu: () => import('./locales/gu'),
  ur: () => import('./locales/ur'),
  kn: () => import('./locales/kn'),
  or: () => import('./locales/or'),
  ml: () => import('./locales/ml'),
  pa: () => import('./locales/pa'),
  as: () => import('./locales/as'),
  mai: () => import('./locales/mai'),
  sat: () => import('./locales/sat'),
  ks: () => import('./locales/ks'),
  ne: () => import('./locales/ne'),
  sd: () => import('./locales/sd'),
  doi: () => import('./locales/doi'),
  kok: () => import('./locales/kok'),
  mni: () => import('./locales/mni'),
  brx: () => import('./locales/brx'),
  sa: () => import('./locales/sa'),
}

export async function loadDictionary(code: string): Promise<Dict> {
  const loader = LOADERS[code]
  if (!loader) return en
  try {
    return (await loader()).default
  } catch {
    return en
  }
}

export function format(dict: Dict, key: string, params?: Params): string {
  const template = dict[key] ?? en[key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name]
    if (value == null) return ''
    if (typeof value === 'object') return format(dict, value.k, value.p)
    return String(value)
  })
}

/*
 * The active dictionary lives here as well as in React state, so plain helpers (relative time,
 * durations) translate without a hook. Components still re-render through the provider.
 */
let active: Dict = en
let activeCode = 'en'

export function setActive(code: string, dict: Dict) {
  active = dict
  activeCode = code
}

export function activeLanguage() {
  return languageOf(activeCode)
}

/** Translate with the active language. */
export function tr(key: string, params?: Params) {
  return format(active, key, params)
}

/** Translate a message produced by the engine. */
export function trMsg(message: Msg) {
  return format(active, message.k, message.p)
}

export const msg = (k: string, p?: Params): Msg => ({ k, p })
