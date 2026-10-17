<script setup lang="ts">
/** A report's history, one line per change. Its client sees only the sending and the payment. */
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
  return e.actor.id === auth.user?.id ? 'You' : e.actor.name || e.actor.email
}

const KIND_NAMES: Record<string, string> = { basic: 'Basic', detailed: 'Detailed' }

/** What happened, after the actor's name; `value` parts are set off. */
function describe(e: ReportEvent): { text: string; value?: string }[] {
  const d = e.data
  switch (e.kind) {
    case 'created':
      return [{ text: 'created the report' }]
    case 'title':
      return [{ text: 'renamed it to ' }, { text: '', value: `“${d.to}”` }]
    case 'summary':
      return [{ text: 'edited the summary' }]
    case 'kind':
      return [{ text: 'made it ' }, { text: '', value: KIND_NAMES[d.to ?? ''] ?? String(d.to) }]
    case 'item_notes':
      return [{ text: 'edited the notes on ' }, { text: '', value: `“${d.task}”` }]
    case 'item_removed':
      return [{ text: 'took ' }, { text: '', value: `“${d.task}”` }, { text: ' out of the report' }]
    case 'sent':
      return [{ text: 'sent the report' }]
    case 'paid':
      return d.tasks
        ? [{ text: 'marked it paid — ' }, { text: '', value: `${d.tasks} ${d.tasks === 1 ? 'task' : 'tasks'}` }, { text: ' moved to Paid' }]
        : [{ text: 'marked it paid' }]
    default:
      return [{ text: 'changed the report' }]
  }
}
</script>

<template>
  <section v-if="events.length" class="border-t border-neutral-200 px-5 py-4" aria-labelledby="report-history">
    <h3 id="report-history" class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">History</h3>
    <ol class="mt-2 space-y-2">
      <li v-for="e in events" :key="e.id" class="text-xs leading-snug text-neutral-600">
        <span class="font-medium text-neutral-900">{{ who(e) }}</span>
        {{ ' ' }}
        <template v-for="(part, i) in describe(e)" :key="i">{{ part.text }}<span v-if="part.value" class="font-medium text-neutral-800">{{ part.value }}</span></template>
        <time class="ml-1 whitespace-nowrap text-neutral-400" :datetime="e.created_at" :title="formatDate(e.created_at)">{{ timeAgo(e.created_at) }}</time>
      </li>
    </ol>
  </section>
</template>
