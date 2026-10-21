import { intlLocale, t } from '@/i18n'

/** Date formatters by Intl locale and style, made once each. */
const dateFormats = new Map<string, Intl.DateTimeFormat>()

function dateFormat(month: 'short' | 'long'): Intl.DateTimeFormat {
  const locale = intlLocale()
  const key = `${locale}:${month}`
  let fmt = dateFormats.get(key)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month, year: 'numeric' })
    dateFormats.set(key, fmt)
  }
  return fmt
}

/** A Date from an ISO timestamp, or from a YYYY-MM-DD date as a local calendar day (not UTC midnight). */
function toDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
}

/** "15 Jan 2030" ("15 січ. 2030 р.") from an ISO timestamp or a YYYY-MM-DD date. */
export function formatDate(value: string): string {
  return dateFormat('short').format(toDate(value))
}

/** The month in full in Ukrainian, as a document reads: "15 Jan 2030", "15 січня 2030". */
function documentFormat(): Intl.DateTimeFormat {
  return dateFormat(intlLocale() === 'uk-UA' ? 'long' : 'short')
}

/** Intl's Ukrainian dates end in "р." (year); a document drops it. */
function dropYearMark(s: string): string {
  return s.replace(/\s*р\.$/, '')
}

/** A date for a document: "15 Jan 2030", "15 січня 2030". */
export function formatDocumentDate(value: string): string {
  return dropYearMark(documentFormat().format(toDate(value)))
}

/** A period for a document: "1–31 Oct 2030", "28 вересня – 3 жовтня 2030", or one day. */
export function formatDocumentPeriod(from: string, to: string): string {
  return dropYearMark(documentFormat().formatRange(toDate(from), toDate(to)))
}

/** Whether a YYYY-MM-DD due date is before today. */
export function isOverdue(dueOn: string | null): boolean {
  if (!dueOn) return false
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return dueOn < iso
}

/** "just now", "5m ago", "3h ago", "2d ago", then the date. */
export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return t('time.justNow')
  if (seconds < 3600) return t('time.minutesAgo', { n: Math.floor(seconds / 60) })
  if (seconds < 86400) return t('time.hoursAgo', { n: Math.floor(seconds / 3600) })
  if (seconds < 7 * 86400) return t('time.daysAgo', { n: Math.floor(seconds / 86400) })
  return formatDate(iso)
}

export type DeviceKind = 'desktop' | 'phone' | 'tablet' | 'unknown'

export interface Device {
  browser: string
  os: string
  kind: DeviceKind
}

/** The first label whose token the user agent contains. */
function match(userAgent: string, table: [string, string][]): string {
  return table.find(([token]) => userAgent.includes(token))?.[1] ?? ''
}

/** What a user agent says about the device: its browser, OS and form factor. */
export function parseDevice(userAgent: string): Device {
  const browser = match(userAgent, [
    ['Edg/', 'Edge'],
    ['OPR/', 'Opera'],
    ['Firefox/', 'Firefox'],
    ['Chrome/', 'Chrome'],
    ['Safari/', 'Safari'],
  ])
  const os = match(userAgent, [
    ['iPhone', 'iOS'],
    ['iPad', 'iPadOS'],
    ['Android', 'Android'],
    ['CrOS', 'ChromeOS'],
    ['Mac OS X', 'macOS'],
    ['Windows', 'Windows'],
    ['Linux', 'Linux'],
  ])
  let kind: DeviceKind = 'unknown'
  if (/iPad|Tablet/.test(userAgent) || (userAgent.includes('Android') && !userAgent.includes('Mobile'))) kind = 'tablet'
  else if (/iPhone|Android|Mobile/.test(userAgent)) kind = 'phone'
  else if (os) kind = 'desktop'
  return { browser, os, kind }
}

/** "Chrome on macOS" from a user agent; "Unknown device" when it says nothing useful. */
export function deviceName(userAgent: string): string {
  const { browser, os } = parseDevice(userAgent)
  if (browser && os) return `${browser} on ${os}`
  return browser || os || t('common.unknownDevice')
}

/** Time spent, to the minute: "1h 30m", "2h", "45m" ("1 год 30 хв"). */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return t('timelog.hm', { h, m })
  if (h) return t('timelog.h', { h })
  return t('timelog.m', { m })
}

/** A running timer's clock: "0:05:09", "1:30:00". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}
