/** Small helpers the admin charts share. */
import { intlLocale, t } from '@/i18n'
import { formatDate } from '@/utils/format'

/** A Date for a YYYY-MM-DD day, as a local calendar day. */
export function dayDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "15 Oct". */
export function shortDay(day: string): string {
  return dayDate(day).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' })
}

/** A round top for an axis over values up to max, and its ticks: 0 and three more, each 1, 2 or 5 × a power of ten. */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1]
  const rough = max / 3
  const pow = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow
  // Whole numbers only: these are counts of people and things.
  const whole = Math.max(1, Math.round(step))
  const ticks = [0]
  while (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + whole)
  return ticks
}

/** 1,284 / 12.9K: compact from ten thousand up. */
export function compact(n: number): string {
  return new Intl.NumberFormat(intlLocale(), n >= 10_000 ? { notation: 'compact', maximumFractionDigits: 1 } : {}).format(n)
}

/** n out of all, as a whole percent; 0 when there's nothing to be out of. */
export function pct(n: number, all: number): number {
  return all ? Math.round((n / all) * 100) : 0
}

/** The change from before to now, in percent; null when before was nothing. */
export function change(now: number, before: number): number | null {
  if (!before) return null
  return Math.round(((now - before) / before) * 100)
}

/** "Today", "Yesterday", "5 days ago", then the date, for a YYYY-MM-DD day. */
export function timeAgoDay(day: string): string {
  const now = new Date()
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - dayDate(day).getTime()) / 86_400_000)
  if (days <= 0) return t('admin.today')
  if (days === 1) return t('admin.yesterday')
  if (days < 30) return t('admin.daysAgo', { n: days }, days)
  return formatDate(day)
}
