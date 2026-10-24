import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentLocale, intlLocale, isLocale, setLocale, t } from '@/i18n'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('i18n', () => {
  it('switches the language, the page’s lang and the Intl locale, and remembers it', () => {
    setLocale('uk')
    expect([currentLocale(), document.documentElement.lang, intlLocale()]).toEqual(['uk', 'uk', 'uk-UA'])
    expect(localStorage.getItem('helpic:locale')).toBe('uk')
    setLocale('en')
    expect(intlLocale()).toBe('en-GB')
  })

  it('knows its two languages', () => {
    expect([isLocale('en'), isLocale('uk'), isLocale('de'), isLocale(undefined)]).toEqual([true, true, false, false])
  })

  it('has Ukrainian’s three plural forms', () => {
    setLocale('uk')
    // The word's form, without the number: one (1, 21), few (2–4, 22–24), many (5–20, 11–14, 25…).
    const form = (n: number) => t('reportPdf.completedCount', { n }, n).replace(String(n), '#')
    const [one, few, many] = [form(1), form(2), form(5)]
    expect(new Set([one, few, many]).size).toBe(3)
    expect([21, 31].map(form)).toEqual([one, one])
    expect([3, 4, 22, 24].map(form)).toEqual([few, few, few, few])
    expect([11, 12, 14, 20, 25, 0].map(form)).toEqual([many, many, many, many, many, many])
  })

  it('has every English message in Ukrainian too', async () => {
    const { en, uk } = await import('@/i18n/messages')
    const keys = (o: object, prefix = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]))
    const missing = keys(en).filter((k) => !new Set(keys(uk)).has(k))
    expect(missing).toEqual([])
  })

  it('starts a guest in the language they picked before, else in their browser’s', async () => {
    localStorage.setItem('helpic:locale', 'uk')
    expect((await import('@/i18n')).currentLocale()).toBe('uk')

    vi.resetModules()
    localStorage.clear()
    vi.stubGlobal('navigator', { languages: ['uk-UA', 'en'], language: 'uk-UA' })
    expect((await import('@/i18n')).currentLocale()).toBe('uk')

    vi.resetModules()
    vi.stubGlobal('navigator', { languages: [], language: 'de-DE' })
    expect((await import('@/i18n')).currentLocale()).toBe('en')
  })
})
