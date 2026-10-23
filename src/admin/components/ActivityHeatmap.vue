<script setup lang="ts">
/**
 * The days someone used Helpic, week by week like a calendar: a column per
 * week from Monday, a filled square for a day they were active. Days still
 * to come are left out.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { intlLocale } from '@/i18n'
import { dayDate } from '../chart'
import { formatDate } from '@/utils/format'

const props = defineProps<{
  /** A Monday, YYYY-MM-DD. */
  since: string
  /** The days they were active, YYYY-MM-DD. */
  days: string[]
}>()
const { t } = useI18n()

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const today = iso(new Date())

const weeks = computed(() => {
  const active = new Set(props.days)
  const out: { key: string; month: string; days: { day: string; active: boolean; future: boolean }[] }[] = []
  const d = dayDate(props.since)
  let lastMonth = d.getMonth()
  // A month is named on its first whole week, three weeks clear of the last name so they never run together.
  let lastLabel = -3
  while (iso(d) <= today) {
    const week = { key: iso(d), month: '', days: [] as { day: string; active: boolean; future: boolean }[] }
    const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 6)
    if (sunday.getMonth() !== lastMonth && out.length - lastLabel >= 3) {
      week.month = sunday.toLocaleDateString(intlLocale(), { month: 'short' })
      lastLabel = out.length
    }
    lastMonth = sunday.getMonth()
    for (let i = 0; i < 7; i++) {
      const day = iso(d)
      week.days.push({ day, active: active.has(day), future: day > today })
      d.setDate(d.getDate() + 1)
    }
    out.push(week)
  }
  return out
})
</script>

<template>
  <div class="overflow-x-auto">
    <div class="inline-flex flex-col gap-1">
      <div class="flex gap-[3px] text-[10px] text-neutral-400" aria-hidden="true">
        <span v-for="w in weeks" :key="w.key" class="w-2.5 overflow-visible whitespace-nowrap">{{ w.month }}</span>
      </div>
      <div class="flex gap-[3px]" role="img" :aria-label="t('admin.account.activeDays', { n: days.length }, days.length)">
        <div v-for="w in weeks" :key="w.key" class="flex flex-col gap-[3px]">
          <span
            v-for="d in w.days"
            :key="d.day"
            class="h-2.5 w-2.5 rounded-[3px]"
            :class="d.future ? 'invisible' : d.active ? 'bg-emerald-500' : 'bg-neutral-100'"
            :title="d.future ? undefined : `${formatDate(d.day)}${d.active ? ' · ' + t('admin.account.wasActive') : ''}`"
          />
        </div>
      </div>
    </div>
  </div>
</template>
