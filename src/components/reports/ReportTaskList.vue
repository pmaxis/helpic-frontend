<script setup lang="ts">
/**
 * The tasks in a draft report, each removed with one click; a detailed
 * report's tasks carry notes, folded until asked for and saved when the
 * field loses focus with a change.
 */
import { nextTick, ref } from 'vue'
import { useReportsStore } from '@/stores/reports'
import { ApiRequestError } from '@/services/api'
import { formatDate, formatDuration } from '@/utils/format'
import { formatMoney } from '@/utils/money'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Report } from '@/types/reports'

const props = defineProps<{ report: Report }>()
const emit = defineEmits<{
  /** The report as the server has it after a change here. */
  changed: [report: Report]
}>()

const reports = useReportsStore()

/** Tasks whose notes field is open; all start folded. */
const openNotes = ref(new Set<string>())

async function toggleNotes(itemId: string) {
  const open = new Set(openNotes.value)
  if (open.has(itemId)) open.delete(itemId)
  else open.add(itemId)
  openNotes.value = open
  if (!open.has(itemId)) return
  await nextTick()
  const field = document.getElementById(`notes-${itemId}`) as HTMLTextAreaElement | null
  field?.focus()
  field?.setSelectionRange(field.value.length, field.value.length)
}

/** First line of the notes, as a hint on the folded toggle. */
function notesPreview(notes: string): string {
  return notes.split('\n').find((l) => l.trim())?.trim() ?? ''
}

/** Saves a task's notes when the field loses focus with a change. */
async function saveNotes(itemId: string, value: string) {
  const item = props.report.items?.find((it) => it.id === itemId)
  if (!item || value.trim() === item.notes) return
  try {
    emit('changed', await reports.updateItemNotes(props.report.id, itemId, value))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('report.notesFailed'))
  }
}

async function removeItem(itemId: string) {
  try {
    emit('changed', await reports.removeItem(props.report.id, itemId))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('report.removeFailed'))
  }
}
</script>

<template>
  <section class="px-5 py-4" aria-labelledby="report-tasks">
    <h3 id="report-tasks" class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">{{ $t('report.tasksInReport') }}</h3>
    <p v-if="report.items?.length" class="mt-1 text-xs text-neutral-400">
      {{ report.client ? $t('report.pricesUntilSent') : $t('report.pricesFromTasks') }}
    </p>
    <p v-if="!report.items?.length" class="mt-2 text-sm text-neutral-400">
      {{ report.client ? $t('report.noTasksForClient') : $t('report.noTasks') }}
    </p>
    <ul v-else class="mt-2 divide-y divide-neutral-100">
      <li v-for="it in report.items" :key="it.id" class="py-2">
        <div class="group flex items-start gap-2">
          <div class="min-w-0 flex-1">
            <p v-if="it.parent_title" class="truncate text-xs text-neutral-400">{{ it.parent_title }} ›</p>
            <p class="truncate text-sm text-neutral-800">{{ it.title }}</p>
            <p class="text-xs text-neutral-400">
              {{ formatDate(it.completed_on) }}{{ it.project_name ? ` · ${it.project_name}` : '' }}{{ it.seconds !== null ? ` · ${formatDuration(it.seconds)}` : '' }}
            </p>
          </div>
          <span v-if="it.price_cents !== null" class="shrink-0 pt-px text-sm text-neutral-800 tabular-nums">
            {{ formatMoney(it.price_cents, report.currency) }}
          </span>
          <span v-else-if="report.total_cents !== null" class="shrink-0 pt-px text-xs text-neutral-400">{{ $t('report.noPrice') }}</span>
          <button
            type="button"
            class="shrink-0 rounded-md p-1 text-neutral-300 transition hover:bg-neutral-100 hover:text-neutral-700"
            :aria-label="$t('report.removeTask', { title: it.title })"
            :title="$t('report.removeFromReport')"
            @click="removeItem(it.id)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <!-- the task's notes, folded until asked for; full width under the row -->
        <div v-if="report.kind === 'detailed'" class="mt-1">
          <button
            type="button"
            class="-mx-1 flex w-[calc(100%+0.5rem)] min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-left text-xs transition-colors hover:bg-neutral-100"
            :aria-expanded="openNotes.has(it.id)"
            :aria-controls="`notes-${it.id}`"
            @click="toggleNotes(it.id)"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="h-3 w-3 shrink-0 text-neutral-400 transition-transform"
              :class="openNotes.has(it.id) ? 'rotate-90' : ''"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span class="shrink-0 font-medium text-neutral-600">{{ $t('report.notes') }}</span>
            <span v-if="!openNotes.has(it.id)" class="min-w-0 truncate text-neutral-400">
              {{ notesPreview(it.notes) || $t('report.notesEmpty') }}
            </span>
          </button>
          <template v-if="openNotes.has(it.id)">
            <label :for="`notes-${it.id}`" class="sr-only">{{ $t('report.notesFor', { title: it.title }) }}</label>
            <textarea
              :id="`notes-${it.id}`"
              :value="it.notes"
              rows="4"
              class="mt-1 block w-full resize-y rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-xs leading-relaxed text-neutral-800 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
              @change="saveNotes(it.id, ($event.target as HTMLTextAreaElement).value)"
            />
          </template>
        </div>
      </li>
    </ul>
  </section>
</template>
