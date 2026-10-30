<script setup lang="ts">
import { t } from '@/i18n'
/** A report's history, one line per change. Its client sees what happened once it reached them. */
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useReportsStore } from '@/stores/reports'
import { formatDate, timeAgo } from '@/utils/format'
import type { ReportEvent } from '@/types/reports'

const props = defineProps<{
  reportId: string
  /** Changes whenever the report does, so the history reloads. */
  version: number
}>()

const auth = useAuthStore()
const reports = useReportsStore()
const events = ref<ReportEvent[]>([])

watch(
  () => [props.reportId, props.version] as const,
  async ([id]) => {
    try {
      const list = await reports.fetchHistory(id)
      if (id === props.reportId) events.value = list
    } catch {
      // The history is a nice-to-have here; the report itself still works.
    }
  },
  { immediate: true },
)

function who(e: ReportEvent): string {
  return e.actor.id === auth.user?.id ? t('common.you_capital') : e.actor.name || e.actor.email
}

/** What happened, as a message with {value} set off. */
function describe(e: ReportEvent): { key: string; value: string } {
  const d = e.data
  switch (e.kind) {
    case 'created':
      return { key: 'reportHistory.created', value: '' }
    case 'title':
      return { key: 'reportHistory.title_', value: `“${d.to}”` }
    case 'summary':
      return { key: 'reportHistory.summary', value: '' }
    case 'kind':
      return { key: 'reportHistory.kind', value: d.to === 'detailed' ? t('report.detailed') : d.to === 'basic' ? t('report.basic') : String(d.to) }
    case 'item_notes':
      return { key: 'reportHistory.itemNotes', value: `“${d.task}”` }
    case 'item_removed':
      return { key: 'reportHistory.itemRemoved', value: `“${d.task}”` }
    case 'sent':
      return { key: 'reportHistory.sent', value: '' }
    case 'question':
      return { key: 'reportHistory.question', value: `“${d.task}”` }
    case 'resolved':
      return { key: 'reportHistory.resolved', value: `“${d.task}”` }
    case 'recalled':
      return { key: 'reportHistory.recalled', value: '' }
    case 'approved':
      return { key: 'reportHistory.approved', value: '' }
    case 'changes_requested':
      return { key: 'reportHistory.changesRequested', value: '' }
    case 'changes_declined':
      return { key: 'reportHistory.changesDeclined', value: '' }
    case 'paid':
      return d.tasks
        ? { key: 'reportHistory.paidTasks', value: t('reportHistory.tasks', { n: d.tasks }, d.tasks) }
        : { key: 'reportHistory.paid', value: '' }
    default:
      return { key: 'reportHistory.other', value: '' }
  }
}
</script>

<template>
  <section v-if="events.length" class="border-t border-neutral-200 px-5 py-4" aria-labelledby="report-history">
    <h3 id="report-history" class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">{{ $t('reportHistory.title') }}</h3>
    <ol class="mt-2 space-y-2">
      <li v-for="e in events" :key="e.id" class="text-xs leading-snug text-neutral-600">
        <i18n-t :keypath="describe(e).key" scope="global">
          <template #who><span class="font-medium text-neutral-900">{{ who(e) }}</span></template>
          <template #value><span class="font-medium text-neutral-800">{{ describe(e).value }}</span></template>
        </i18n-t>
        <time class="ml-1 whitespace-nowrap text-neutral-400" :datetime="e.created_at" :title="formatDate(e.created_at)">{{ timeAgo(e.created_at) }}</time>
      </li>
    </ol>
  </section>
</template>
