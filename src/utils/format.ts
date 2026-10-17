import { intlLocale, t } from '@/i18n'

/** Date formatters by Intl locale, made once each. */
const dateFormats = new Map<string, Intl.DateTimeFormat>()

/** "15 Jan 2030" ("15 січ. 2030 р.") from an ISO timestamp or a YYYY-MM-DD date. */
export function formatDate(value: string): string {
  // A bare date is a calendar day: parse it as local, not UTC midnight.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
  const locale = intlLocale()
  let fmt = dateFormats.get(locale)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    dateFormats.set(locale, fmt)
  }
  return fmt.format(d)
}

/** Whether a YYYY-MM-DD due date is before today. */
export function isOverdue(dueOn: string | null): boolean {
  if (!dueOn) return false
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return dueOn < iso
}

/** Copies text to the clipboard; resolves false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
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
