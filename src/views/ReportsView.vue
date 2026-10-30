<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ReportIllustration from '@/components/illustrations/ReportIllustration.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import NewReportModal from '@/components/reports/NewReportModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useReportsStore } from '@/stores/reports'
import { formatDate } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Report } from '@/types/reports'

const auth = useAuthStore()
const reports = useReportsStore()
const router = useRouter()
const creating = ref(false)

onMounted(async () => {
  try {
    await reports.fetchReports()
  } catch {
    toast.error(t('reports.loadFailed'))
  }
})

function other(r: Report) {
  return auth.isClient ? r.freelancer : r.client
}

function period(r: Report): string {
  return r.from === r.to ? formatDate(r.from) : `${formatDate(r.from)} – ${formatDate(r.to)}`
}

function onCreated(r: Report) {
  creating.value = false
  void router.push({ name: 'report-detail', params: { id: r.id } })
}
</script>

<template>
  <!-- with no reports the page is filled, so the empty state sits in the middle -->
  <DashboardLayout :fill="reports.loaded && !reports.reports.length">
    <PageHeader :title="$t('reports.title')">
      <template v-if="auth.isFreelancer" #actions>
        <BaseButton size="sm" :block="false" @click="creating = true">{{ $t('reports.new') }}</BaseButton>
      </template>
    </PageHeader>

    <div v-if="reports.loaded && !reports.reports.length" class="mt-6 flex min-h-0 flex-1 flex-col">
      <EmptyState
        class="flex-1 justify-center"
        :title="$t('reports.noneYet')"
        :description="auth.isFreelancer ? $t('reports.noneYetFreelancer') : $t('reports.noneYetClient')"
      >
        <template #illustration>
          <ReportIllustration />
        </template>
        <template v-if="auth.isFreelancer" #default>
          <BaseButton size="sm" :block="false" @click="creating = true">{{ $t('reports.new') }}</BaseButton>
        </template>
      </EmptyState>
    </div>

    <div v-else-if="reports.reports.length" class="mt-6 overflow-hidden rounded-xl border border-neutral-200">
      <div
        class="hidden gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-medium tracking-wide text-neutral-500 uppercase md:grid md:grid-cols-[minmax(0,1fr)_11rem_12rem_5rem_7rem]"
        aria-hidden="true"
      >
        <span>{{ $t('reports.report') }}</span>
        <span>{{ auth.isClient ? $t('reports.freelancer') : $t('reports.client') }}</span>
        <span>{{ $t('reports.period') }}</span>
        <span class="text-right">{{ $t('reports.tasks') }}</span>
        <span class="text-right">{{ $t('reports.status') }}</span>
      </div>
      <ul class="divide-y divide-neutral-100">
        <li v-for="r in reports.reports" :key="r.id">
          <RouterLink
            :to="{ name: 'report-detail', params: { id: r.id } }"
            class="grid grid-cols-1 gap-x-4 gap-y-1.5 px-4 py-3 transition-colors hover:bg-neutral-50 md:grid-cols-[minmax(0,1fr)_11rem_12rem_5rem_7rem] md:items-center"
          >
            <div class="flex min-w-0 items-center gap-3">
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6M8 13h8M8 17h5" />
                </svg>
              </span>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-neutral-900">{{ r.title }}</p>
                <p v-if="r.projects.length" class="truncate text-xs text-neutral-500">{{ r.projects.map((p) => p.name).join(', ') }}</p>
              </div>
            </div>
            <span class="truncate text-sm" :class="other(r) ? 'text-neutral-700' : 'text-neutral-400'">
              {{ other(r) ? other(r)?.name || other(r)?.email : $t('reports.personal') }}
            </span>
            <span class="text-sm text-neutral-600">{{ period(r) }}</span>
            <span class="text-sm text-neutral-700 md:text-right">{{ r.item_count }}</span>
            <span class="md:text-right">
              <span
                class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
                :class="
                  r.status === 'paid'
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                    : r.status === 'sent'
                      ? 'bg-sky-50 text-sky-700 ring-sky-600/20'
                      : 'bg-neutral-100 text-neutral-600 ring-neutral-500/20'
                "
              >
                {{ r.status === 'paid' ? $t('reports.paid') : r.status === 'sent' ? $t('reports.sent') : r.client ? $t('reports.draft') : $t('reports.personal') }}
              </span>
              <span
                v-if="r.open_questions && r.status !== 'paid'"
                class="ml-1.5 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20 ring-inset"
              >
                {{ $t('reportDiscussion.openQuestions', { n: r.open_questions }, r.open_questions) }}
              </span>
            </span>
          </RouterLink>
        </li>
      </ul>
    </div>

    <NewReportModal v-if="creating" @close="creating = false" @created="onCreated" />
  </DashboardLayout>
</template>
