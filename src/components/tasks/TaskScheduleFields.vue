<script setup lang="ts">
/**
 * When and for how much, as two blocks of the details card: the task's
 * project, creation date and due date, then its billing, price and time (left out when it
 * has none of them to show). Whoever may edit the task picks the
 * project and the due date, and moves the creation date into the past, up
 * to the due date; only the freelancer sets the billing and the
 * price — in any status, so the price has its own endpoint — and runs the
 * timer.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import DateInput from '@/components/ui/DateInput.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { useTimerStore } from '@/stores/timer'
import { ApiRequestError } from '@/services/api'
import { t as tr } from '@/i18n'
import { formatClock, formatDate, formatDuration, isOverdue } from '@/utils/format'
import { formatMoney, priceInput } from '@/utils/money'
import { toast } from '@/composables/useToasts'
import type { Task, TaskBilling, TaskInput } from '@/types/tasks'

const props = defineProps<{
  task: Task
  saving: boolean
  /** Saves one change to the task; false when it was refused. */
  save: (change: Partial<TaskInput>) => Promise<boolean>
}>()
const emit = defineEmits<{
  /** The task as the server has it after a change here. */
  changed: [task: Task]
}>()

const tasks = useTasksStore()
const projects = useProjectsStore()
const timer = useTimerStore()

function errorMessage(error: unknown): string {
  return error instanceof ApiRequestError ? (Object.values(error.fields ?? {})[0] ?? error.message) : ''
}

const open = computed(() => props.task.status === 'new' || props.task.status === 'in_progress')
const overdue = computed(() => !!props.task.due_on && open.value && isOverdue(props.task.due_on))

/** The price block has a row to show: the billing, the price or the time. */
const showsPrice = computed(() => {
  const t = props.task
  return t.can_set_price || (t.can_see_price && (t.price_cents !== null || t.can_track_time || t.tracked_seconds !== null))
})

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
const today = localDay(new Date())
/** The last day it can have been created on: today, or the due date if that came first. */
const latestCreatedOn = computed(() => (props.task.due_on && props.task.due_on < today ? props.task.due_on : today))

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

// --- billing and price ------------------------------------------------------------

/** The price or the billing is being saved. */
const pricing = ref(false)
const busy = computed(() => props.saving || pricing.value)

const editingPrice = ref(false)
const priceDraft = ref('')
const priceField = ref<HTMLInputElement | null>(null)

async function startPrice() {
  if (!props.task.can_set_price) return
  priceDraft.value = priceInput(props.task.price_cents)
  editingPrice.value = true
  await nextTick()
  priceField.value?.select()
}

async function commitPrice() {
  const t = props.task
  if (!editingPrice.value || busy.value) return
  const value = priceDraft.value.trim()
  if (value === priceInput(t.price_cents)) {
    editingPrice.value = false
    return
  }
  pricing.value = true
  try {
    emit('changed', await tasks.setPrice(t.id, value || null))
    editingPrice.value = false
  } catch (error) {
    toast.error(errorMessage(error) || tr('task.priceFailed'))
  } finally {
    pricing.value = false
  }
}

/** Fixed or hourly, the freelancer's call; switching to fixed keeps the hours' price as the price. */
async function setBilling(billing: TaskBilling) {
  const t = props.task
  if (busy.value || billing === t.billing) return
  pricing.value = true
  try {
    emit('changed', await tasks.setPrice(t.id, billing === 'fixed' ? priceInput(t.price_cents) || null : null, billing))
  } catch (error) {
    toast.error(errorMessage(error) || tr('timelog.billingFailed'))
  } finally {
    pricing.value = false
  }
}

/** "1h 30m × $40/h": what an hourly price is made of. */
const hourlyBreakdown = computed(() => {
  const t = props.task
  if (t.hourly_rate_cents === null) return ''
  return tr('timelog.breakdown', {
    time: formatDuration(t.tracked_seconds ?? 0),
    rate: tr('timelog.perHour', { amount: formatMoney(t.hourly_rate_cents, t.currency, { whole: true }) }),
  })
})

// --- the timer ---------------------------------------------------------------------

/** The timer runs on this task. */
const timing = computed(() => timer.running?.task_id === props.task.id)
const timerBusy = ref(false)

async function toggleTimer() {
  if (timerBusy.value) return
  timerBusy.value = true
  try {
    if (timing.value) await timer.stop()
    else await timer.start(props.task.id)
  } catch (error) {
    const message = error instanceof ApiRequestError ? error.message : ''
    toast.error(message || tr(timing.value ? 'timelog.stopFailed' : 'timelog.startFailed'))
  } finally {
    timerBusy.value = false
  }
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
          :placeholder="$t('task.none')"
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

  <section v-if="showsPrice" class="px-5 py-4" :aria-label="$t('task.groups.price')">
    <h3 class="mb-3 text-xs font-medium tracking-wide text-neutral-400 uppercase" aria-hidden="true">{{ $t('task.groups.price') }}</h3>
    <dl class="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 text-sm">
      <!-- fixed or by the hour: the freelancer picks; the client sees the hours in the price -->
      <template v-if="task.can_set_price">
        <dt class="text-neutral-500">{{ $t('timelog.billing') }}</dt>
        <dd class="min-w-0">
          <div class="inline-flex rounded-md bg-neutral-100 p-0.5 text-xs font-medium" role="group" :aria-label="$t('timelog.billing')">
            <button
              v-for="b in (['fixed', 'hourly'] as const)"
              :key="b"
              type="button"
              :aria-pressed="task.billing === b"
              :disabled="busy"
              class="rounded px-2.5 py-1 transition-colors"
              :class="task.billing === b ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'"
              @click="setBilling(b)"
            >
              {{ $t(`timelog.${b}`) }}
            </button>
          </div>
        </dd>
      </template>

      <!-- a price nobody can set and nobody set (a client's own task, say) isn't shown -->
      <template v-if="task.can_see_price && (task.can_set_price || task.price_cents !== null)">
        <dt class="self-start pt-1 text-neutral-500">{{ $t('task.price') }}</dt>
        <dd v-if="task.billing === 'hourly'" class="min-w-0 py-1">
          <span :class="task.price_cents === null ? 'text-neutral-400' : 'font-medium text-neutral-800'">
            {{ task.price_cents === null ? $t('task.none') : formatMoney(task.price_cents, task.currency) }}
          </span>
          <span v-if="hourlyBreakdown" class="mt-0.5 block text-xs text-neutral-500">{{ hourlyBreakdown }}</span>
          <RouterLink
            v-else-if="task.can_set_price"
            :to="{ name: 'settings' }"
            class="mt-0.5 block text-xs text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
          >
            {{ $t('timelog.noRate') }} · {{ $t('timelog.setRate') }}
          </RouterLink>
        </dd>
        <dd v-else class="min-w-0">
          <input
            v-if="editingPrice"
            ref="priceField"
            v-model="priceDraft"
            type="text"
            inputmode="decimal"
            :aria-label="$t('task.price')"
            :placeholder="$t('task.pricePlaceholder', { currency: task.currency })"
            :disabled="busy"
            class="block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
            @keydown.enter.prevent="commitPrice"
            @keydown.esc.prevent="editingPrice = false"
            @blur="commitPrice"
          />
          <button
            v-else-if="task.can_set_price"
            type="button"
            class="-mx-2 w-[calc(100%+1rem)] cursor-text rounded-lg px-2 py-1 text-left transition-colors hover:bg-neutral-100"
            :class="task.price_cents === null ? 'text-neutral-400' : 'font-medium text-neutral-800'"
            :title="$t('task.clickToSetPrice')"
            @click="startPrice"
          >
            {{ task.price_cents === null ? $t('task.none') : formatMoney(task.price_cents, task.currency) }}
          </button>
          <span v-else :class="task.price_cents === null ? 'text-neutral-400' : 'font-medium text-neutral-800'">
            {{ task.price_cents === null ? $t('task.none') : formatMoney(task.price_cents, task.currency) }}
          </span>
        </dd>
      </template>

      <!-- the time written on it, and the freelancer's timer under it -->
      <template v-if="task.can_see_price && (task.can_track_time || task.tracked_seconds !== null)">
        <dt class="text-neutral-500">{{ $t('timelog.time') }}</dt>
        <dd class="flex min-w-0 flex-col items-start gap-1.5">
          <span v-if="timing" class="font-medium tabular-nums text-neutral-800">
            {{ formatClock(timer.elapsed + (task.tracked_seconds ?? 0) - (timer.running?.seconds ?? 0)) }}
          </span>
          <span v-else :class="task.tracked_seconds === null ? 'text-neutral-400' : 'font-medium text-neutral-800'">
            {{ task.tracked_seconds === null ? $t('timelog.noTime') : formatDuration(task.tracked_seconds) }}
          </span>
          <button
            v-if="task.can_track_time"
            type="button"
            :disabled="timerBusy"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-60"
            :class="timing ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'text-neutral-600 ring-1 ring-neutral-300 ring-inset hover:bg-neutral-50 hover:text-neutral-900'"
            @click="toggleTimer"
          >
            <svg v-if="timing" viewBox="0 0 24 24" fill="currentColor" class="h-3 w-3" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor" class="h-3 w-3" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
            {{ timing ? $t('timelog.stop') : $t('timelog.start') }}
          </button>
        </dd>
      </template>
    </dl>
  </section>
</template>
