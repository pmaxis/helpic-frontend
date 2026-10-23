import { intlLocale, t } from '@/i18n'

/** When a limit lifts: "21:40 · in 12 min" ("21:40 · через 12 хв"); seconds round up to a minute. */
export function untilText(iso: string): string {
  const at = new Date(iso)
  const time = new Intl.DateTimeFormat(intlLocale(), { hour: '2-digit', minute: '2-digit' }).format(at)
  const minutes = Math.max(1, Math.ceil((at.getTime() - Date.now()) / 60_000))
  const when =
    minutes < 60
      ? t('admin.system.every.min', { n: minutes })
      : minutes % 60
        ? `${t('admin.system.every.h', { n: Math.floor(minutes / 60) })} ${t('admin.system.every.min', { n: minutes % 60 })}`
        : t('admin.system.every.h', { n: minutes / 60 })
  return `${time} · ${t('admin.limits.opensIn', { when })}`
}
