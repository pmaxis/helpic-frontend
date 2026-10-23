<script setup lang="ts">
/**
 * How Helpic is used. Under a line of how things stand right now: four
 * headline figures for the period against the period before (picking one
 * puts it on the trend chart).
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SelectInput from '@/components/ui/SelectInput.vue'
import { toast } from '@/composables/useToasts'
import { formatDate } from '@/utils/format'
import AdminShell from '../components/AdminShell.vue'
import KpiTile from '../components/KpiTile.vue'
import TrendChart, { type TrendPoint } from '../components/TrendChart.vue'
import { compact, shortDay } from '../chart'
import { fetchAdminStats } from '../api'
import { useAdminStore } from '../store'
import type { AdminDay, AdminSeries, AdminStats } from '../types'

const { t } = useI18n()
const admin = useAdminStore()

const PERIODS = ['7', '30', '90', '365'] as const
const period = ref<string>('30')
const periodOptions = computed(() => PERIODS.map((p) => ({ value: p, label: t(`admin.periods.${p}`) })))

const stats = ref<AdminStats | null>(null)
const loading = ref(false)

async function load() {
  if (!admin.canOpen) return
  loading.value = true
  try {
    stats.value = await fetchAdminStats(Number(period.value))
  } catch {
    toast.error(t('admin.loadFailed'))
  } finally {
    loading.value = false
  }
}

watch(period, load)
// Two-factor may have been turned on since the access was asked.
void admin.load(true).then(load)

const range = computed(() => (stats.value ? t('admin.range', { from: formatDate(stats.value.from), to: formatDate(stats.value.to) }) : ''))

// --- right now ----------------------------------------------------------------------

const now = computed(() => {
  const n = stats.value?.totals
  if (!n) return []
  return [
    { label: t('admin.now.accounts'), value: n.users, hint: t('admin.now.split', { freelancers: n.freelancers, clients: n.clients }) },
    { label: t('admin.now.activeToday'), value: n.active_day },
    { label: t('admin.now.active7'), value: n.active_week },
    { label: t('admin.now.active30'), value: n.active_month },
    { label: t('admin.now.unconfirmed'), value: n.pending_signups },
    { label: t('admin.now.tasks'), value: n.tasks },
    { label: t('admin.now.projects'), value: n.projects },
  ]
})

// --- the headline figures and the trend ----------------------------------------------

const SERIES: AdminSeries[] = ['active', 'signups', 'tasks_created', 'tasks_completed']
const series = ref<AdminSeries>('active')

/** Each series' total for the period and the one before. Active users are the distinct people, not a sum of days. */
function total(key: AdminSeries, which: 'period' | 'previous'): number {
  const p = stats.value?.[which]
  if (!p) return 0
  return { active: p.active, signups: p.new_users, tasks_created: p.tasks_created, tasks_completed: p.tasks_completed }[key]
}

/** Long periods go by week: a day is too thin to see over months. */
const weekly = computed(() => (stats.value?.days.length ?? 0) > 62)

interface Bucket {
  first: string
  last: string
  values: Record<AdminSeries, number>
}

/**
 * The days, or weeks of seven days counted back from the last day so the
 * latest week is whole. A week's active users are the average per day (the
 * same person on several days isn't several people); the rest add up.
 */
function buckets(days: AdminDay[]): Bucket[] {
  const size = weekly.value ? 7 : 1
  const out: Bucket[] = []
  for (let end = days.length; end > 0; end -= size) {
    const chunk = days.slice(Math.max(0, end - size), end)
    const sum = (k: AdminSeries) => chunk.reduce((s, d) => s + d[k], 0)
    out.unshift({
      first: chunk[0].day,
      last: chunk[chunk.length - 1].day,
      values: {
        active: Math.round(sum('active') / chunk.length),
        signups: sum('signups'),
        tasks_created: sum('tasks_created'),
        tasks_completed: sum('tasks_completed'),
      },
    })
  }
  return out
}

const current = computed(() => buckets(stats.value?.days ?? []))
const previous = computed(() => buckets(stats.value?.previous_days ?? []))

function bucketTitle(b: Bucket | undefined): string {
  if (!b) return ''
  return weekly.value ? t('admin.trend.weekOf', { day: shortDay(b.first) }) : formatDate(b.first)
}

const points = computed<TrendPoint[]>(() =>
  current.value.map((b, i) => ({
    key: b.first,
    label: shortDay(b.first),
    title: bucketTitle(b),
    previousTitle: bucketTitle(previous.value[i]),
    current: b.values[series.value],
    previous: previous.value[i]?.values[series.value] ?? 0,
  })),
)

const seriesName = computed(() => t(`admin.kpi.${series.value}`))
const trendTitle = computed(() => t(weekly.value ? 'admin.trend.byWeek' : 'admin.trend.byDay', { series: seriesName.value }))

const card = 'rounded-xl border border-neutral-200 bg-white p-5'
</script>

<template>
  <AdminShell :description="$t('admin.statsDescription')">
    <template #actions>
      <SelectInput v-model="period" :options="periodOptions" size="sm" class="w-44" :aria-label="$t('admin.period')" />
    </template>

    <!-- a first load shows the frame with dashes; a reload dims what's there -->
    <div class="space-y-6 transition-opacity" :class="loading && stats ? 'opacity-60' : ''">
      <!-- right now: one quiet line, it doesn't depend on the period -->
      <section aria-labelledby="admin-now">
        <h2 id="admin-now" class="sr-only">{{ $t('admin.now.title') }}</h2>
        <dl class="grid grid-cols-2 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50/60 sm:grid-cols-4 lg:grid-cols-7">
          <div v-for="item in now" :key="item.label" class="border-neutral-200 px-4 py-3 not-last:border-r max-lg:[&:nth-child(4n)]:border-r-0">
            <dt class="truncate text-[11px] text-neutral-500">{{ item.label }}</dt>
            <dd class="mt-0.5 text-lg font-semibold text-neutral-900">{{ compact(item.value) }}</dd>
            <dd v-if="item.hint" class="text-[11px] leading-snug text-neutral-400">{{ item.hint }}</dd>
          </div>
          <template v-if="!now.length">
            <div v-for="i in 7" :key="i" class="px-4 py-3">
              <div class="h-3 w-16 animate-pulse rounded bg-neutral-200/70" />
              <div class="mt-2 h-5 w-10 animate-pulse rounded bg-neutral-200/70" />
            </div>
          </template>
        </dl>
      </section>

      <!-- the period: four figures that also pick what the chart shows -->
      <section aria-labelledby="admin-period">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="admin-period" class="text-sm font-semibold text-neutral-900">{{ $t(`admin.periods.${period}`) }}</h2>
          <p class="text-xs text-neutral-500 tabular-nums">{{ range }}</p>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiTile
            v-for="s in SERIES"
            :key="s"
            :label="$t(`admin.kpi.${s}`)"
            :value="total(s, 'period')"
            :previous="total(s, 'previous')"
            :series="current.map((b) => b.values[s])"
            :selected="series === s"
            @select="series = s"
          />
        </div>

        <div :class="[card, 'mt-3']">
          <h3 class="text-sm font-semibold text-neutral-900">{{ trendTitle }}</h3>
          <p v-if="weekly && series === 'active'" class="mt-0.5 text-xs text-neutral-500">{{ $t('admin.trend.averageNote') }}</p>
          <div class="mt-4 h-64">
            <TrendChart
              :points="points"
              :label="trendTitle"
              :current-name="$t('admin.trend.current')"
              :previous-name="$t('admin.trend.previous')"
              :empty-text="stats ? $t('admin.trend.empty') : ''"
            />
          </div>
        </div>
      </section>

    </div>
  </AdminShell>
</template>
