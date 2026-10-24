<script setup lang="ts">
/**
 * The dashboard's lead figure: what was earned (or paid) this month against
 * the last, the months before as a line, and beside it what's sent and not
 * yet paid and the half year together.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import EarningsChart, { type Month } from '@/components/dashboard/EarningsChart.vue'
import { useAuthStore } from '@/stores/auth'
import { useReportsStore } from '@/stores/reports'
import { formatMoney } from '@/utils/money'
import { t as tr } from '@/i18n'
import type { Report } from '@/types/reports'

const props = defineProps<{
  /** The last six months, oldest first, in the lead currency. */
  months: Month[]
  currency: string
  loaded: boolean
}>()

const auth = useAuthStore()
const reports = useReportsStore()

/** This month against the last: the change in percent, or null when there's nothing to compare with. */
const change = computed(() => {
  const [prev, cur] = props.months.slice(-2)
  if (!prev.cents) return null
  return {
    pct: Math.round(((cur.cents - prev.cents) / prev.cents) * 100),
    month: prev.name.split(' ')[0],
  }
})

/** Sums reports' totals by currency, the largest first. */
function sumByCurrency(list: Report[]): { cents: number; currency: string }[] {
  const sums = new Map<string, number>()
  for (const r of list) if (r.total_cents) sums.set(r.currency, (sums.get(r.currency) ?? 0) + r.total_cents)
  return [...sums].map(([currency, cents]) => ({ currency, cents })).sort((a, b) => b.cents - a.cents)
}

const awaiting = computed(() => reports.reports.filter((r) => r.status === 'sent'))

/** What's sent and not yet paid: to come in for the freelancer, to pay for the owner. */
const awaitingText = computed(() => {
  const top = sumByCurrency(awaiting.value)[0]
  return formatMoney(top?.cents ?? 0, top?.currency ?? props.currency, {
    whole: true,
  })
})
const awaitingHint = computed(() => {
  const n = awaiting.value.length
  if (auth.isFreelancer) return n ? tr('dashboard.stats.sentReports', { n }, n) : tr('dashboard.stats.noSent')
  return n ? tr('dashboard.stats.reportsToPay', { n }, n) : tr('dashboard.stats.nothingToPay')
})

/** The six months together, in the lead currency. */
const halfYear = computed(() => props.months.reduce((s, m) => s + m.cents, 0))
</script>

<template>
  <section class="rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] flex flex-col p-6 lg:col-span-2" aria-labelledby="dash-lead">
    <div class="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
      <div class="min-w-0">
        <p id="dash-lead" class="text-sm text-neutral-500">
          {{ auth.isFreelancer ? $t('dashboard.lead.earned') : $t('dashboard.lead.paid') }}
        </p>
        <p class="mt-1.5 truncate text-5xl font-semibold tracking-tight text-neutral-900 tabular-nums">
          {{ loaded ? formatMoney(months[5].cents, currency, { whole: true }) : '–' }}
        </p>
        <p v-if="loaded && change" class="mt-3 flex items-center gap-2 text-sm">
          <!-- up is good for what's earned; for what's paid out it's neither -->
          <span
            class="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset"
            :class="
              !auth.isFreelancer
                ? 'bg-neutral-100 text-neutral-700 ring-neutral-500/20'
                : change.pct >= 0
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                  : 'bg-red-50 text-red-700 ring-red-600/20'
            "
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.6"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-3 w-3"
              aria-hidden="true"
            >
              <path v-if="change.pct >= 0" d="M7 17 17 7M9 7h8v8" />
              <path v-else d="M7 7l10 10M17 9v8H9" />
            </svg>
            {{ Math.abs(change.pct) }}%
          </span>
          <span class="text-neutral-500">{{ $t('dashboard.lead.vs', { month: change.month }) }}</span>
        </p>
      </div>

      <dl class="flex divide-x divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50/60">
        <RouterLink to="/reports" class="group block px-4 py-3 transition-colors hover:bg-neutral-100/70">
          <dt class="text-xs text-neutral-500">
            {{ auth.isFreelancer ? $t('dashboard.stats.awaiting') : $t('dashboard.stats.toPay') }}
          </dt>
          <dd class="mt-0.5 text-lg font-semibold text-neutral-900 tabular-nums">
            {{ loaded ? awaitingText : '–' }}
          </dd>
          <dd class="text-[11px] text-neutral-400 group-hover:text-neutral-500">
            {{ awaitingHint }}
          </dd>
        </RouterLink>
        <div class="px-4 py-3">
          <dt class="text-xs text-neutral-500">
            {{ $t('dashboard.lead.halfYear') }}
          </dt>
          <dd class="mt-0.5 text-lg font-semibold text-neutral-900 tabular-nums">
            {{ loaded ? formatMoney(halfYear, currency, { whole: true }) : '–' }}
          </dd>
          <dd class="text-[11px] text-neutral-400">
            {{ $t('dashboard.lead.halfYearHint') }}
          </dd>
        </div>
      </dl>
    </div>

    <div class="mt-6 min-h-32 flex-1">
      <EarningsChart :months="months" :currency="currency" :label="$t('dashboard.lead.chart')" :empty-text="loaded ? $t('dashboard.lead.none') : ''" />
    </div>
  </section>
</template>
