<script setup lang="ts">
/**
 * The money and the time on a task, as one block of the details card, a row
 * each: how it's billed; at a fixed price the price, by the hour the rate;
 * the time it's estimated at and the time spent, each with what it comes to
 * by the hour; then where the client stands on the estimate. The freelancer
 * sets the billing, the price and the estimate — in any status, so each has
 * its own endpoint — and runs the timer here. Whoever doesn't see the price
 * sees only the estimated time.
 */
import { computed, nextTick, ref } from 'vue'
import { RouterLink } from 'vue-router'
import TaskEstimateApproval from '@/components/tasks/TaskEstimateApproval.vue'
import { useTasksStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { ApiRequestError } from '@/services/api'
import { t } from '@/i18n'
import { durationInput, formatClock, formatDuration, parseDuration } from '@/utils/format'
import { formatMoney, priceInput } from '@/utils/money'
import { toast } from '@/composables/useToasts'
import type { Task, TaskBilling } from '@/types/tasks'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{
  /** The task as the server has it after a change here. */
  changed: [task: Task]
}>()

const tasks = useTasksStore()
const timer = useTimerStore()

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? (Object.values(error.fields ?? {})[0] ?? error.message) : fallback
}

const hourly = computed(() => props.task.billing === 'hourly')

// --- which rows there are --------------------------------------------------------

/** How it's billed: the freelancer picks; the client is told, a personal task's owner needn't be. */
const showsBilling = computed(() => props.task.can_set_price || (props.task.can_see_price && !!props.task.client))
/** At a fixed price: the price, for whoever sets it or once there is one. */
const showsPrice = computed(() => !hourly.value && props.task.can_see_price && (props.task.can_set_price || props.task.price_cents !== null))
/** By the hour: the rate that applies, or for the freelancer where to set one. */
const showsRate = computed(() => hourly.value && props.task.can_see_price && (props.task.can_set_price || props.task.hourly_rate_cents !== null))
const showsEstimate = computed(() => props.task.can_estimate || props.task.estimate_seconds !== null)
const showsSpent = computed(() => props.task.can_see_price && (props.task.can_track_time || props.task.tracked_seconds !== null))
const showsApproval = computed(() => !!props.task.client && props.task.can_see_price && (!!props.task.estimate || props.task.can_send_estimate))

const shown = computed(() => showsBilling.value || showsPrice.value || showsRate.value || showsEstimate.value || showsSpent.value || showsApproval.value)

// --- billing and price -----------------------------------------------------------

const busy = ref(false)

/** Fixed or hourly, the freelancer's call; switching to fixed keeps the hours' price as the price. */
async function setBilling(billing: TaskBilling) {
  const task = props.task
  if (busy.value || billing === task.billing) return
  busy.value = true
  try {
    emit('changed', await tasks.setPrice(task.id, billing === 'fixed' ? priceInput(task.price_cents) || null : null, billing))
  } catch (error) {
    toast.error(errorMessage(error, t('timelog.billingFailed')))
  } finally {
    busy.value = false
  }
}

/** The row being typed into: the price or the estimate. */
const editing = ref<'price' | 'estimate' | null>(null)
const draft = ref('')
const input = ref<HTMLInputElement | null>(null)

async function edit(what: 'price' | 'estimate') {
  const task = props.task
  if (what === 'price' ? !task.can_set_price : !task.can_estimate) return
  draft.value = what === 'price' ? priceInput(task.price_cents) : task.estimate_seconds === null ? '' : durationInput(task.estimate_seconds)
  editing.value = what
  await nextTick()
  input.value?.select()
}

async function commit() {
  const what = editing.value
  if (!what || busy.value) return
  const task = props.task
  const value = draft.value.trim()
  let save: (() => Promise<Task>) | null = null
  if (what === 'price') {
    if (value !== priceInput(task.price_cents)) save = () => tasks.setPrice(task.id, value || null)
  } else {
    const seconds = value ? parseDuration(value) : null
    if (value && (seconds === null || seconds < 60)) {
      toast.error(t('estimate.timeInvalid'))
      return
    }
    if (seconds !== task.estimate_seconds) save = () => tasks.setEstimateTime(task.id, seconds)
  }
  if (!save) {
    editing.value = null
    return
  }
  busy.value = true
  try {
    emit('changed', await save())
    editing.value = null
  } catch (error) {
    toast.error(errorMessage(error, t(what === 'price' ? 'task.priceFailed' : 'estimate.failed')))
  } finally {
    busy.value = false
  }
}

/** What a time comes to at the task's rate, by the whole minute; null without one. */
function atRate(seconds: number | null): number | null {
  const rate = props.task.hourly_rate_cents
  if (seconds === null || rate === null) return null
  return Math.round((Math.round(seconds / 60) * rate) / 60)
}

const estimateAmount = computed(() => (hourly.value && props.task.can_see_price ? atRate(props.task.estimate_seconds) : null))

// --- the timer -------------------------------------------------------------------

/** The timer runs on this task. */
const timing = computed(() => timer.running?.task_id === props.task.id)
const timerBusy = ref(false)
/** The time spent, the running timer's included. */
const spent = computed(() => (timing.value ? timer.elapsed + (props.task.tracked_seconds ?? 0) - (timer.running?.seconds ?? 0) : props.task.tracked_seconds))

async function toggleTimer() {
  if (timerBusy.value) return
  timerBusy.value = true
  try {
    if (timing.value) await timer.stop()
    else await timer.start(props.task.id)
  } catch (error) {
    const message = error instanceof ApiRequestError ? error.message : ''
    toast.error(message || t(timing.value ? 'timelog.stopFailed' : 'timelog.startFailed'))
  } finally {
    timerBusy.value = false
  }
}

/** A value's look: set, or a grey "none". */
const value = (set: boolean) => (set ? 'font-medium text-neutral-800' : 'text-neutral-400')

/** A value that turns into a field on a click, its text where the field's will be. */
const editable =
  'flex h-8 w-full cursor-text items-center truncate rounded-lg border border-transparent px-3 text-left transition-colors hover:border-neutral-300 hover:bg-neutral-50'
const fieldClass =
  'block h-8 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none'
</script>

<template>
  <section v-if="shown" class="px-5 py-4" :aria-label="$t('task.groups.price')">
    <h3 class="mb-3 text-xs font-medium tracking-wide text-neutral-400 uppercase" aria-hidden="true">{{ $t('task.groups.price') }}</h3>
    <!-- every value starts where a select's text does: a 1px border, then px-3 -->
    <dl class="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 text-sm">
      <template v-if="showsBilling">
        <dt class="text-neutral-500">{{ $t('timelog.billing') }}</dt>
        <dd class="min-w-0">
          <!-- 32px like the selects above, the way the tasks page's view toggle is -->
          <div v-if="task.can_set_price" class="grid h-8 w-full grid-cols-2 rounded-lg border border-neutral-300 bg-neutral-100 p-[3px] text-xs" role="group" :aria-label="$t('timelog.billing')">
            <button
              v-for="b in (['fixed', 'hourly'] as const)"
              :key="b"
              type="button"
              :aria-pressed="task.billing === b"
              :disabled="busy"
              class="truncate rounded-md px-1 font-medium transition-colors"
              :class="task.billing === b ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'"
              @click="setBilling(b)"
            >
              {{ $t(`timelog.${b}`) }}
            </button>
          </div>
          <span v-else class="block truncate border border-transparent px-3 text-neutral-800">{{ $t(`timelog.${task.billing}`) }}</span>
        </dd>
      </template>

      <template v-if="showsPrice">
        <dt class="text-neutral-500">{{ $t('task.price') }}</dt>
        <dd class="min-w-0">
          <input
            v-if="editing === 'price'"
            ref="input"
            v-model="draft"
            type="text"
            inputmode="decimal"
            :aria-label="$t('task.price')"
            :placeholder="$t('task.pricePlaceholder', { currency: task.currency })"
            :disabled="busy"
            :class="fieldClass"
            @keydown.enter.prevent="commit"
            @keydown.esc.prevent="editing = null"
            @blur="commit"
          />
          <button v-else-if="task.can_set_price" type="button" :class="[editable, value(task.price_cents !== null)]" :title="$t('task.clickToSetPrice')" @click="edit('price')">
            {{ task.price_cents === null ? $t('task.none') : formatMoney(task.price_cents, task.currency) }}
          </button>
          <span v-else class="block truncate border border-transparent px-3" :class="value(true)">{{ formatMoney(task.price_cents ?? 0, task.currency) }}</span>
        </dd>
      </template>

      <template v-if="showsRate">
        <dt class="text-neutral-500">{{ $t('timelog.rateShort') }}</dt>
        <dd class="min-w-0 border border-transparent px-3">
          <span v-if="task.hourly_rate_cents !== null" :class="value(true)">
            {{ $t('timelog.perHour', { amount: formatMoney(task.hourly_rate_cents, task.currency, { whole: true }) }) }}
          </span>
          <RouterLink v-else :to="{ name: 'settings' }" class="text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline">
            {{ $t('timelog.setRate') }}
          </RouterLink>
        </dd>
      </template>

      <template v-if="showsEstimate">
        <dt class="text-neutral-500">{{ $t('estimate.title') }}</dt>
        <dd class="min-w-0">
          <input
            v-if="editing === 'estimate'"
            ref="input"
            v-model="draft"
            type="text"
            autocomplete="off"
            :aria-label="$t('estimate.title')"
            :placeholder="$t('estimate.timePlaceholder')"
            :title="$t('estimate.timeHint')"
            :disabled="busy"
            :class="fieldClass"
            @keydown.enter.prevent="commit"
            @keydown.esc.prevent="editing = null"
            @blur="commit"
          />
          <component
            :is="task.can_estimate ? 'button' : 'span'"
            v-else
            :type="task.can_estimate ? 'button' : undefined"
            :class="[task.can_estimate ? editable : 'block truncate border border-transparent px-3', value(task.estimate_seconds !== null)]"
            :title="task.can_estimate ? $t('estimate.clickToSet') : undefined"
            @click="edit('estimate')"
          >
            <template v-if="task.estimate_seconds === null">{{ $t('task.none') }}</template>
            <template v-else>
              {{ formatDuration(task.estimate_seconds) }}<span v-if="estimateAmount !== null" class="font-normal text-neutral-500"> · ≈ {{ formatMoney(estimateAmount, task.currency) }}</span>
            </template>
          </component>
        </dd>
      </template>

      <template v-if="showsSpent">
        <dt class="text-neutral-500">{{ $t('timelog.spent') }}</dt>
        <dd class="flex min-w-0 items-center gap-2">
          <span class="min-w-0 flex-1 truncate border border-transparent px-3 tabular-nums" :class="value(spent !== null)">
            <template v-if="spent === null">{{ $t('task.none') }}</template>
            <template v-else>
              {{ timing ? formatClock(spent) : formatDuration(spent) }}<span v-if="hourly && task.price_cents !== null" class="font-normal text-neutral-500"> · {{ formatMoney(task.price_cents, task.currency) }}</span>
            </template>
          </span>
          <button
            v-if="task.can_track_time"
            type="button"
            :disabled="timerBusy"
            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-xs transition-colors disabled:opacity-60"
            :class="timing ? 'bg-neutral-900 text-white hover:bg-neutral-800' : 'border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50'"
            :title="timing ? $t('timelog.stop') : $t('timelog.start')"
            :aria-label="timing ? $t('timelog.stop') : $t('timelog.start')"
            @click="toggleTimer"
          >
            <svg v-if="timing" viewBox="0 0 24 24" fill="currentColor" class="h-3 w-3" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor" class="h-3 w-3" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
          </button>
        </dd>
      </template>
    </dl>

    <TaskEstimateApproval v-if="showsApproval" :task="task" @changed="emit('changed', $event)" />
  </section>
</template>

