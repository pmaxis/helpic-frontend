<script setup lang="ts">
/**
 * A task's subtasks: tasks of their own (status, freelancer, price, time),
 * listed under the parent with how many are done. Anyone who sees the task
 * adds one by its title; it starts with the parent's client and project, and
 * for its freelancer. A subtask opens on its own page.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import StatusBadge from '@/components/tasks/StatusBadge.vue'
import { useTasksStore } from '@/stores/tasks'
import { ApiRequestError } from '@/services/api'
import { formatDate, isOverdue } from '@/utils/format'
import { formatMoney } from '@/utils/money'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { Task } from '@/types/tasks'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{
  /** A subtask was added: the parent's counts changed. */
  changed: []
}>()

const tasks = useTasksStore()
const subtasks = ref<Task[]>([])
const loaded = ref(false)

async function load(taskId: string) {
  loaded.value = false
  subtasks.value = []
  try {
    const list = await tasks.fetchSubtasks(taskId)
    if (taskId === props.task.id) subtasks.value = list
  } catch {
    toast.error(t('subtasks.loadFailed'))
  } finally {
    loaded.value = true
  }
}

watch(
  () => props.task.id,
  (id) => void load(id),
  { immediate: true },
)

const done = computed(() => subtasks.value.filter((s) => s.status === 'done' || s.archived_at).length)

/** The subtasks' prices together, when the viewer sees them and they're in one currency. */
const total = computed(() => {
  const priced = subtasks.value.filter((s) => s.can_see_price && s.price_cents !== null)
  if (!priced.length || new Set(priced.map((s) => s.currency)).size > 1) return ''
  return formatMoney(
    priced.reduce((sum, s) => sum + (s.price_cents ?? 0), 0),
    priced[0].currency,
  )
})

/** Who does a subtask, when it's shared work and not the parent's freelancer. */
function doer(s: Task): string {
  if (!s.client || !s.freelancer || s.freelancer.id === props.task.freelancer?.id) return ''
  return s.freelancer.name || s.freelancer.email
}

function closed(s: Task): boolean {
  return s.status === 'done' || !!s.archived_at
}

// --- adding -------------------------------------------------------------------

const adding = ref(false)
const draft = ref('')
const saving = ref(false)
const input = ref<HTMLInputElement | null>(null)

async function start() {
  adding.value = true
  await nextTick()
  input.value?.focus()
}

function cancel() {
  adding.value = false
  draft.value = ''
}

/** Adds the subtask and stays open for the next one. */
async function add() {
  const title = draft.value.trim()
  if (!title || saving.value) return
  saving.value = true
  try {
    const s = await tasks.createTask({ parent_id: props.task.id, title, description: '', due_on: null })
    subtasks.value = [...subtasks.value, s]
    draft.value = ''
    emit('changed')
  } catch (error) {
    const message = error instanceof ApiRequestError ? (Object.values(error.fields ?? {})[0] ?? error.message) : ''
    toast.error(message || t('subtasks.createFailed'))
  } finally {
    saving.value = false
    await nextTick()
    input.value?.focus()
  }
}
</script>

<template>
  <section aria-labelledby="task-subtasks" class="mt-8 min-w-0">
    <div class="flex items-center justify-between gap-2">
      <h2 id="task-subtasks" class="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
        {{ $t('subtasks.title') }}
        <span
          v-if="subtasks.length"
          class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-200 px-1.5 text-[11px] font-semibold tracking-normal text-neutral-700 tabular-nums"
        >{{ done }}/{{ subtasks.length }}</span>
      </h2>
      <button
        v-if="task.can_add_subtask && !adding"
        type="button"
        class="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        @click="start"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        {{ $t('subtasks.add') }}
      </button>
    </div>

    <div
      v-if="subtasks.length"
      class="mt-3 h-1 overflow-hidden rounded-full bg-neutral-100"
      role="progressbar"
      :aria-valuenow="done"
      aria-valuemin="0"
      :aria-valuemax="subtasks.length"
      :aria-label="$t('subtasks.progress', { done, total: subtasks.length })"
    >
      <div class="h-full rounded-full bg-emerald-500 transition-[width]" :style="{ width: `${(done / subtasks.length) * 100}%` }" />
    </div>

    <ul v-if="subtasks.length" class="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
      <li v-for="s in subtasks" :key="s.id" class="flex min-w-0 items-center gap-3 px-3 py-2">
        <StatusBadge :status="s.status" :name="s.status_name" />
        <RouterLink
          :to="{ name: 'task-detail', params: { id: s.id } }"
          class="min-w-0 flex-1 truncate text-sm underline-offset-4 hover:underline"
          :class="closed(s) ? 'text-neutral-400 line-through decoration-neutral-300' : 'text-neutral-800 hover:text-neutral-950'"
          :title="s.title"
        >
          {{ s.title }}
        </RouterLink>
        <span class="flex shrink-0 items-center gap-3 text-xs text-neutral-500">
          <span v-if="doer(s)" class="hidden max-w-32 truncate sm:inline">{{ doer(s) }}</span>
          <span v-if="s.due_on" :class="!closed(s) && isOverdue(s.due_on) ? 'font-medium text-red-600' : ''">{{ formatDate(s.due_on) }}</span>
          <span v-if="s.can_see_price && s.price_cents !== null" class="text-neutral-800 tabular-nums">{{ formatMoney(s.price_cents, s.currency) }}</span>
        </span>
      </li>
      <li v-if="total && subtasks.length > 1" class="flex justify-end gap-3 px-3 py-2 text-xs text-neutral-500">
        {{ $t('subtasks.total') }}
        <span class="font-medium text-neutral-900 tabular-nums">{{ total }}</span>
      </li>
    </ul>

    <form v-if="adding" class="mt-3" @submit.prevent="add">
      <label for="subtask-title" class="sr-only">{{ $t('subtasks.placeholder') }}</label>
      <input
        id="subtask-title"
        ref="input"
        v-model="draft"
        maxlength="200"
        autocomplete="off"
        :disabled="saving"
        :placeholder="$t('subtasks.placeholder')"
        class="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
        @keydown.enter.prevent="add"
        @keydown.esc.prevent="cancel"
        @blur="!draft.trim() && !saving && cancel()"
      />
      <p class="mt-1.5 text-xs text-neutral-400">{{ $t('subtasks.hint') }}</p>
    </form>

    <p v-else-if="loaded && !subtasks.length" class="mt-2 text-sm text-neutral-400">
      {{ task.can_add_subtask ? $t('subtasks.empty') : $t('subtasks.none') }}
    </p>
  </section>
</template>
