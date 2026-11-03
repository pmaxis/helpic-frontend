<script setup lang="ts">
/**
 * When, as a block of the details card: the task's project, creation date
 * and due date. Whoever may edit the task picks the project and the due
 * date, no earlier than the creation day, and moves the creation date into
 * the past, up to the due date. The price and the time are a block of their
 * own (TaskPriceFields).
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import DateInput from '@/components/ui/DateInput.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import { useProjectsStore } from '@/stores/projects'
import { t as tr } from '@/i18n'
import { formatDate, isOverdue } from '@/utils/format'
import type { Task, TaskInput } from '@/types/tasks'

const props = defineProps<{
  task: Task
  saving: boolean
  /** Saves one change to the task; false when it was refused. */
  save: (change: Partial<TaskInput>) => Promise<boolean>
}>()

const projects = useProjectsStore()
const busy = computed(() => props.saving)

const open = computed(() => props.task.status === 'new' || props.task.status === 'in_progress')
const overdue = computed(() => !!props.task.due_on && open.value && isOverdue(props.task.due_on))

// --- project and due date ---------------------------------------------------------

watch(
  () => props.task.id,
  () => {
    if (props.task.can_edit && !projects.loaded) void projects.fetchProjects().catch(() => {})
  },
  { immediate: true },
)

/** Projects the task can move to: those of its freelancer and client. */
const projectOptions = computed(() => {
  const t = props.task
  const pair = projects.projects.filter((p) => p.freelancer.id === t.freelancer?.id && (p.client?.id ?? '') === (t.client?.id ?? ''))
  return [{ value: '', label: tr('task.none') }, ...pair.map((p) => ({ value: p.id, label: p.name }))]
})

function saveProject(projectId: string) {
  if (projectId !== (props.task.project?.id ?? '')) void props.save({ project_id: projectId })
}

function saveDueOn(value: string) {
  if (value !== (props.task.due_on ?? '')) void props.save({ due_on: value || null })
}

/** The local calendar day the task was created on, as YYYY-MM-DD. */
const createdOn = computed(() => localDay(new Date(props.task.created_at)))
/** Today, turning over at midnight while the details stay open. */
const today = ref(localDay(new Date()))
let midnight = 0
function untilTomorrow() {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  midnight = window.setTimeout(() => {
    today.value = localDay(new Date())
    untilTomorrow()
  }, next.getTime() - now.getTime())
}
untilTomorrow()
onBeforeUnmount(() => window.clearTimeout(midnight))

/** The last day it can have been created on: today, or the due date if that came first. */
const latestCreatedOn = computed(() => (props.task.due_on && props.task.due_on < today.value ? props.task.due_on : today.value))

function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Moves the creation to another day at the same time of day, but never past now. */
function saveCreatedOn(value: string) {
  if (!value || value === createdOn.value) return
  const [y, m, d] = value.split('-').map(Number)
  const at = new Date(props.task.created_at)
  at.setFullYear(y, m - 1, d)
  const now = new Date()
  void props.save({ created_at: localTime(at > now ? now : at) })
}

/** An ISO time in the local offset ("2030-01-03T11:00:00+02:00"): the server reads its day against the due date. */
function localTime(d: Date): string {
  const pad = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0')
  const offset = -d.getTimezoneOffset()
  const zone = `${offset < 0 ? '-' : '+'}${pad(offset / 60)}:${pad(offset % 60)}`
  return `${localDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${zone}`
}
</script>

<template>
  <section class="px-5 py-4" :aria-label="$t('task.groups.schedule')">
    <h3 class="mb-3 text-xs font-medium tracking-wide text-neutral-400 uppercase" aria-hidden="true">{{ $t('task.groups.schedule') }}</h3>
    <dl class="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 text-sm">
      <dt class="text-neutral-500">{{ $t('task.project') }}</dt>
      <dd class="min-w-0">
        <SelectInput
          v-if="task.can_edit && projectOptions.length > 1 && !task.parent_id"
          :model-value="task.project?.id ?? ''"
          :options="projectOptions"
          :disabled="busy"
          size="sm"
          :aria-label="$t('task.project')"
          @update:model-value="saveProject"
        />
        <RouterLink
          v-else-if="task.project"
          :to="{ name: 'project-detail', params: { id: task.project.id } }"
          class="inline-flex max-w-full items-center gap-1.5 text-neutral-800 underline-offset-4 hover:text-neutral-950 hover:underline"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          <span class="truncate">{{ task.project.name }}</span>
        </RouterLink>
        <span v-else class="text-neutral-400">{{ $t('task.none') }}</span>
      </dd>

      <dt class="text-neutral-500">{{ $t('task.createdOn') }}</dt>
      <dd v-if="task.can_edit" class="min-w-0">
        <DateInput
          :model-value="createdOn"
          :label="$t('task.createdOn')"
          hide-label
          compact
          size="sm"
          required
          :max="latestCreatedOn"
          :disabled="busy"
          @update:model-value="saveCreatedOn"
        />
      </dd>
      <dd v-else class="min-w-0 text-neutral-800">{{ formatDate(task.created_at) }}</dd>

      <dt class="text-neutral-500">{{ $t('task.dueDate') }}</dt>
      <dd v-if="task.can_edit" class="min-w-0">
        <DateInput
          :model-value="task.due_on ?? ''"
          :label="$t('task.dueDate')"
          hide-label
          compact
          size="sm"
          :placeholder="$t('task.none')"
          :min="createdOn"
          :disabled="busy"
          @update:model-value="saveDueOn"
        />
      </dd>
      <!-- that it's overdue is said by the details' heading -->
      <dd v-else class="min-w-0">
        <span v-if="task.due_on" :class="overdue ? 'font-medium text-red-600' : 'text-neutral-800'">{{ formatDate(task.due_on) }}</span>
        <span v-else class="text-neutral-400">{{ $t('task.none') }}</span>
      </dd>
    </dl>
  </section>
</template>
