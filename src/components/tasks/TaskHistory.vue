<script setup lang="ts">
/** A task's history, one line per change: who did what, and when. */
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { fetchHistory } from '@/services/history'
import { formatDate, timeAgo } from '@/utils/format'
import { formatMoney } from '@/utils/money'
import { PRIORITY_LABELS } from '@/constants/tasks'
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
    toast.error('Could not load the history')
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
  return e.actor.id === auth.user?.id ? 'You' : e.actor.name || e.actor.email
}

function quote(v: unknown): string {
  return `“${v}”`
}

/** What happened, after the actor's name: a sentence with the values set off. */
function describe(e: TaskEvent): { text: string; value?: string }[] {
  const { from, to } = e.data
  const money = (v: unknown) => formatMoney(Number(v), e.data.currency ?? 'USD')
  const date = (v: unknown) => formatDate(String(v))
  switch (e.kind) {
    case 'created':
      return [{ text: 'created the task' }]
    case 'title':
      return [{ text: 'renamed it from ' }, { text: '', value: quote(from) }, { text: ' to ' }, { text: '', value: quote(to) }]
    case 'description':
      return [{ text: 'edited the description' }]
    case 'due_on':
      if (from == null) return [{ text: 'set the due date to ' }, { text: '', value: date(to) }]
      if (to == null) return [{ text: 'removed the due date ' }, { text: '', value: date(from) }]
      return [{ text: 'moved the due date from ' }, { text: '', value: date(from) }, { text: ' to ' }, { text: '', value: date(to) }]
    case 'project':
      if (from == null) return [{ text: 'added it to ' }, { text: '', value: quote(to) }]
      if (to == null) return [{ text: 'took it out of ' }, { text: '', value: quote(from) }]
      return [{ text: 'moved it from ' }, { text: '', value: quote(from) }, { text: ' to ' }, { text: '', value: quote(to) }]
    case 'status':
      return [{ text: 'moved it from ' }, { text: '', value: String(from) }, { text: ' to ' }, { text: '', value: String(to) }]
    case 'price':
      if (from == null) return [{ text: 'set the price to ' }, { text: '', value: money(to) }]
      if (to == null) return [{ text: 'removed the price ' }, { text: '', value: money(from) }]
      return [{ text: 'changed the price from ' }, { text: '', value: money(from) }, { text: ' to ' }, { text: '', value: money(to) }]
    case 'priority':
      if (to === 'none') return [{ text: 'removed the priority ' }, { text: '', value: PRIORITY_LABELS[from as TaskPriority] ?? String(from) }]
      return [{ text: 'set the priority to ' }, { text: '', value: PRIORITY_LABELS[to as TaskPriority] ?? String(to) }]
    case 'labels': {
      const added = e.data.added ?? []
      const removed = e.data.removed ?? []
      const parts: { text: string; value?: string }[] = []
      if (added.length) parts.push({ text: added.length > 1 ? 'added the labels ' : 'added the label ' }, { text: '', value: added.join(', ') })
      if (added.length && removed.length) parts.push({ text: ' and ' })
      if (removed.length) parts.push({ text: removed.length > 1 ? 'removed the labels ' : 'removed the label ' }, { text: '', value: removed.join(', ') })
      return parts
    }
    case 'attachment_added':
      return [{ text: 'attached ' }, { text: '', value: quote(e.data.name) }]
    case 'attachment_removed':
      return [{ text: 'removed the file ' }, { text: '', value: quote(e.data.name) }]
    default:
      return [{ text: 'changed the task' }]
  }
}

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
        <span class="font-medium text-neutral-900">{{ who(e) }}</span>
        {{ ' ' }}
        <template v-for="(part, i) in describe(e)" :key="i">{{ part.text }}<span v-if="part.value" class="font-medium text-neutral-800">{{ part.value }}</span></template>
        <time class="ml-1.5 text-xs whitespace-nowrap text-neutral-400" :datetime="e.created_at" :title="formatDate(e.created_at)">{{ timeAgo(e.created_at) }}</time>
      </p>
    </li>
  </ol>
  <p v-else-if="loaded" class="mt-3 text-sm text-neutral-400">No history yet.</p>
</template>
