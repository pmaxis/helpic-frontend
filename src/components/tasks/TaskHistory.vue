<script setup lang="ts">
/** A task's history, one line per change: who did what, and when. */
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { fetchHistory } from '@/services/history'
import { formatDate, timeAgo } from '@/utils/format'
import { formatMoney } from '@/utils/money'
import { columnName, priorityLabel } from '@/constants/tasks'
import { t } from '@/i18n'
import type { TaskPriority } from '@/types/tasks'
import { toast } from '@/composables/useToasts'
import type { TaskEvent } from '@/types/history'

const props = defineProps<{
  taskId: string
  /** Changes when the task does, so the history reloads. */
  version?: string
}>()

const auth = useAuthStore()
const events = ref<TaskEvent[]>([])
const loaded = ref(false)

async function load(taskId: string) {
  try {
    const list = await fetchHistory(taskId)
    if (taskId === props.taskId) events.value = list
  } catch {
    toast.error(t('history.loadFailed'))
  } finally {
    loaded.value = true
  }
}

watch(
  () => [props.taskId, props.version] as const,
  ([id]) => void load(id),
  { immediate: true },
)

function who(e: TaskEvent): string {
  return e.actor.id === auth.user?.id ? t('common.you_capital') : e.actor.name || e.actor.email
}

function quote(v: unknown): string {
  return `“${v}”`
}

/**
 * What happened, as a message with the values set off: its key, the values,
 * and a count when it has plural forms.
 */
function describe(e: TaskEvent): { key: string; values: Record<string, string>; plural?: number } {
  const { from, to } = e.data
  const money = (v: unknown) => formatMoney(Number(v), e.data.currency ?? 'USD')
  const date = (v: unknown) => formatDate(String(v))
  const priority = (v: unknown) => (v ? priorityLabel(v as TaskPriority) : String(v))
  const pair = (key: string, f: string, t_: string) => ({ key, values: { from: f, to: t_ } })
  switch (e.kind) {
    case 'created':
      return { key: 'history.created', values: {} }
    case 'title':
      return pair('history.title', quote(from), quote(to))
    case 'description':
      return { key: 'history.description', values: {} }
    case 'due_on':
      if (from == null) return pair('history.dueSet', '', date(to))
      if (to == null) return pair('history.dueRemoved', date(from), '')
      return pair('history.dueMoved', date(from), date(to))
    case 'project':
      if (from == null) return pair('history.projectAdded', '', quote(to))
      if (to == null) return pair('history.projectRemoved', quote(from), '')
      return pair('history.projectMoved', quote(from), quote(to))
    case 'status':
      return pair('history.status', columnName(String(from)), columnName(String(to)))
    case 'price':
      if (from == null) return pair('history.priceSet', '', money(to))
      if (to == null) return pair('history.priceRemoved', money(from), '')
      return pair('history.priceChanged', money(from), money(to))
    case 'priority':
      if (to === 'none') return pair('history.priorityRemoved', priority(from), '')
      return pair('history.prioritySet', '', priority(to))
    case 'labels': {
      const added = e.data.added ?? []
      const removed = e.data.removed ?? []
      if (added.length && removed.length) return { key: 'history.labelsBoth', values: { added: added.join(', '), removed: removed.join(', ') } }
      if (added.length) return { key: 'history.labelsAdded', values: { value: added.join(', ') }, plural: added.length }
      return { key: 'history.labelsRemoved', values: { value: removed.join(', ') }, plural: removed.length }
    }
    case 'attachment_added':
      return { key: 'history.attachmentAdded', values: { value: quote(e.data.name) } }
    case 'attachment_removed':
      return { key: 'history.attachmentRemoved', values: { value: quote(e.data.name) } }
    default:
      return { key: 'history.other', values: {} }
  }
}

/** The slots a history message may fill with a value set off in bold. */
const VALUE_SLOTS = ['from', 'to', 'value', 'added', 'removed'] as const

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}
</script>

<template>
  <ol v-if="events.length" class="relative mt-3 space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-neutral-200">
    <li v-for="e in events" :key="e.id" class="relative flex gap-3">
      <span
        class="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-semibold text-neutral-600 ring-1 ring-neutral-200"
        aria-hidden="true"
      >
        {{ initials(e.actor.name || e.actor.email) }}
      </span>
      <p class="min-w-0 flex-1 pt-0.5 text-sm leading-snug break-words text-neutral-600">
        <i18n-t :keypath="describe(e).key" :plural="describe(e).plural" scope="global">
          <template #who><span class="font-medium text-neutral-900">{{ who(e) }}</span></template>
          <template v-for="slot in VALUE_SLOTS" :key="slot" #[slot]>
            <span class="font-medium text-neutral-800">{{ describe(e).values[slot] }}</span>
          </template>
        </i18n-t>
        <time class="ml-1.5 text-xs whitespace-nowrap text-neutral-400" :datetime="e.created_at" :title="formatDate(e.created_at)">{{ timeAgo(e.created_at) }}</time>
      </p>
    </li>
  </ol>
  <p v-else-if="loaded" class="mt-3 text-sm text-neutral-400">{{ $t('history.empty') }}</p>
</template>
