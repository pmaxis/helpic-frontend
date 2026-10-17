/**
 * The interface's language: English or Ukrainian. A signed-in user's comes
 * from their account (it also decides their emails and Telegram messages); a
 * guest's is what they picked here before, or else their browser's. The API
 * client sends it as Accept-Language, so server errors come back in it too.
 *
 * Messages live by area in ./messages, English and Ukrainian side by side;
 * the Ukrainian must have every key the English has. Message syntax treats
 * { } @ $ | as special: write {'@'} for a literal @.
 */
import { createI18n } from 'vue-i18n'
import { en, uk, type MessageSchema } from './messages'

declare module 'vue-i18n' {
  // Typed keys for t() and $t().
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefineLocaleMessage extends MessageSchema {}
}

export const LOCALES = ['en', 'uk'] as const
export type Locale = (typeof LOCALES)[number]

/** Each language named in itself, for the switchers. */
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', uk: 'Українська' }

const STORAGE_KEY = 'helpic:locale'

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'uk'
}

/** A guest's language: picked here before, or the browser's. */
function detect(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    // storage may be unavailable (private mode)
  }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
  return langs.some((l) => l?.toLowerCase().startsWith('uk')) ? 'uk' : 'en'
}

/**
 * Ukrainian has three plural forms: one (1, 21), few (2–4, 22–24), many
 * (5–20, 25…). Its messages give them as "one | few | many".
 */
function ukrainianPlural(choice: number, choicesLength: number): number {
  if (choicesLength < 3) return choice === 1 ? 0 : 1
  const n = Math.abs(choice) % 100
  if (n >= 11 && n <= 14) return 2
  if (n % 10 === 1) return 0
  if (n % 10 >= 2 && n % 10 <= 4) return 1
  return 2
}

const initial = detect()

export const i18n = createI18n<[MessageSchema], Locale, false>({
  legacy: false,
  globalInjection: true,
  locale: initial,
  fallbackLocale: 'en',
  messages: { en, uk },
  pluralRules: { uk: ukrainianPlural },
})

/** The language the interface is in now. */
export function currentLocale(): Locale {
  return i18n.global.locale.value
}

/** Switches the interface's language and remembers it in this browser. */
export function setLocale(locale: Locale): void {
  i18n.global.locale.value = locale
  document.documentElement.lang = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // the choice then lasts for this visit
  }
}

document.documentElement.lang = initial

/** The locale Intl formats dates in: British English, or Ukrainian. */
export function intlLocale(): string {
  return currentLocale() === 'uk' ? 'uk-UA' : 'en-GB'
}

/** t() for code outside components: stores, services, validation rules. */
export const t = i18n.global.t
