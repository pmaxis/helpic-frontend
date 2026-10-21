<script setup lang="ts">
/**
 * The people on the other side — a freelancer's clients, a client's
 * freelancers — ranked by what they brought (or were paid) over the last six
 * months: the top few, each with a small line of those months, the total and
 * how it moved against the month before (its share when there's nothing to
 * compare). For those who don't see money they
 * rank by open tasks, with a bar instead of the line.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import Sparkline from '@/components/dashboard/Sparkline.vue'
import { formatMoney } from '@/utils/money'
import type { Party } from '@/types/people'

export interface Person {
  party: Party
  open: number
  overdue: number
  /** What the ranking is by: cents paid over the months, or open tasks. */
  value: number
  /** The months' values, oldest first; absent when ranking by tasks. */
  series?: number[]
}

const props = defineProps<{
  title: string
  /** What the ranking is by, under the title. */
  caption: string
  /** Where "All" goes: the clients or the freelancers page. */
  to: string
  people: Person[]
  /** The currency of the values; none when they count tasks. */
  currency?: string
  loaded: boolean
  emptyText: string
  /** A way to add someone, shown when there's nobody yet. */
  addText?: string
}>()

const SHOWN = 3

const total = computed(() => props.people.reduce((s, p) => s + p.value, 0))
const top = computed(() => Math.max(...props.people.map((p) => p.value), 0))
const shown = computed(() => props.people.slice(0, SHOWN))
const rest = computed(() => props.people.length - shown.value.length)

function share(v: number): string {
  if (!total.value || !v) return ''
  const p = (v / total.value) * 100
  return p < 1 ? '<1%' : `${Math.round(p)}%`
}

function amount(v: number): string {
  return props.currency ? formatMoney(v, props.currency, { whole: true }) : String(v)
}

/** This month against the last, in percent; null when there's nothing to compare. */
function trend(series?: number[]): number | null {
  if (!series || series.length < 2) return null
  const [prev, cur] = series.slice(-2)
  if (!prev) return null
  return Math.round(((cur - prev) / prev) * 100)
}

function initials(p: Party): string {
  const words = (p.name || p.email).split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : (p.name || p.email).slice(0, 2)).toUpperCase()
}
</script>

<template>
  <section class="flex flex-col rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)]" aria-labelledby="dash-people">
    <header class="flex items-start justify-between px-5 pt-5 pb-2">
      <div>
        <h2 id="dash-people" class="text-sm font-semibold text-neutral-900">{{ title }}</h2>
        <p class="mt-0.5 text-xs text-neutral-500">{{ caption }}</p>
      </div>
      <RouterLink :to="to" class="text-xs text-neutral-500 hover:text-neutral-900">{{ $t('dashboard.all') }}</RouterLink>
    </header>

    <ol v-if="people.length" class="flex flex-1 flex-col px-2 pb-3">
      <li v-for="(p, i) in shown" :key="p.party.id">
        <RouterLink :to="to" class="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-neutral-50">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            :class="i === 0 && p.value ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700'"
            aria-hidden="true"
          >
            {{ initials(p.party) }}
          </span>

          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-neutral-900">{{ p.party.name || p.party.email }}</p>
            <p class="truncate text-xs text-neutral-500">
              {{ $t('dashboard.people.open', { n: p.open }, p.open) }}
              <span v-if="p.overdue" class="font-medium text-red-600">· {{ $t('dashboard.people.overdue', { n: p.overdue }) }}</span>
            </p>
          </div>

          <!-- the months, or for tasks a bar against the busiest -->
          <Sparkline v-if="p.series" class="hidden w-14 shrink-0 sm:block" :values="p.series" />
          <div v-else class="hidden h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-neutral-100 sm:block" aria-hidden="true">
            <div class="h-full rounded-full bg-neutral-900" :style="{ width: top ? `${(p.value / top) * 100}%` : '0%' }" />
          </div>

          <div class="shrink-0 text-right">
            <p class="text-sm font-semibold text-neutral-900 tabular-nums">{{ amount(p.value) }}</p>
            <p class="flex items-center justify-end gap-1 text-[11px] tabular-nums">
              <template v-if="trend(p.series) !== null">
                <span :class="trend(p.series)! >= 0 ? 'text-emerald-600' : 'text-red-600'">{{ trend(p.series)! >= 0 ? '↗' : '↘' }} {{ Math.abs(trend(p.series)!) }}%</span>
              </template>
              <span v-else-if="share(p.value)" class="text-neutral-400">{{ share(p.value) }}</span>
            </p>
          </div>
        </RouterLink>
      </li>
      <li v-if="rest > 0" class="mt-auto px-3 pt-2 text-xs">
        <RouterLink :to="to" class="text-neutral-500 hover:text-neutral-900">{{ $t('dashboard.people.others', { n: rest }, rest) }} →</RouterLink>
      </li>
    </ol>

    <p v-else class="flex flex-1 items-center justify-center px-5 pt-2 pb-8 text-center text-sm text-neutral-400">
      <template v-if="!loaded">{{ $t('common.loading') }}</template>
      <template v-else>
        {{ emptyText }}
        <RouterLink v-if="addText" :to="to" class="font-medium text-neutral-700 underline-offset-4 hover:underline">{{ addText }}</RouterLink>
      </template>
    </p>
  </section>
</template>
