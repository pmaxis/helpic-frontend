<script setup lang="ts">
/** The dashboard's latest reports: the three newest, each with its status and total. */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useReportsStore } from '@/stores/reports'
import { formatMoney } from '@/utils/money'

defineProps<{ loaded: boolean }>()

const reports = useReportsStore()

const latestReports = computed(() => reports.reports.slice(0, 3))

const REPORT_TONE: Record<string, { pill: string; icon: string }> = {
  draft: {
    pill: 'bg-neutral-100 text-neutral-600 ring-neutral-500/20',
    icon: 'bg-neutral-100 text-neutral-500',
  },
  sent: {
    pill: 'bg-sky-50 text-sky-700 ring-sky-600/20',
    icon: 'bg-sky-50 text-sky-600',
  },
  paid: {
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    icon: 'bg-emerald-50 text-emerald-600',
  },
}
</script>

<template>
  <section class="rounded-2xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] flex flex-col" aria-labelledby="dash-reports">
    <header class="flex items-start justify-between px-5 pt-5 pb-2">
      <div>
        <h2 id="dash-reports" class="text-sm font-semibold text-neutral-900">{{ $t('dashboard.reports') }}</h2>
        <p class="mt-0.5 text-xs text-neutral-500">{{ $t('dashboard.reportsCaption') }}</p>
      </div>
      <RouterLink to="/reports" class="text-xs text-neutral-500 hover:text-neutral-900">{{ $t('dashboard.all') }}</RouterLink>
    </header>
    <ul v-if="latestReports.length" class="px-2 pb-3">
      <li v-for="r in latestReports" :key="r.id">
        <RouterLink
          :to="{ name: 'report-detail', params: { id: r.id } }"
          class="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-neutral-50"
        >
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" :class="REPORT_TONE[r.status].icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-[18px] w-[18px]"
            >
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5M9 13h6M9 17h4" />
            </svg>
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-neutral-900">
              {{ r.title }}
            </p>
            <span class="mt-0.5 inline-block rounded-full px-1.5 py-px text-[11px] font-medium ring-1 ring-inset" :class="REPORT_TONE[r.status].pill">
              {{ $t(`dashboard.reportStatus.${r.status === 'draft' && !r.client ? 'personal' : r.status}`) }}
            </span>
          </div>
          <p class="shrink-0 text-sm font-semibold text-neutral-900 tabular-nums">
            {{ r.total_cents !== null ? formatMoney(r.total_cents, r.currency) : $t('dashboard.tasksCount', { n: r.item_count }, r.item_count) }}
          </p>
        </RouterLink>
      </li>
    </ul>
    <p v-else class="flex flex-1 items-center justify-center px-5 pt-2 pb-8 text-center text-sm text-neutral-400">
      {{ loaded ? $t('dashboard.noReports') : $t('common.loading') }}
    </p>
  </section>
</template>
