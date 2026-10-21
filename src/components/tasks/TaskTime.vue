<script setup lang="ts">
/**
 * The time on a task: the entries its freelancer wrote, newest day first,
 * and — for them — a form to add time by hand. The timer lives in the
 * task's details and the sidebar; its entries show up here, the running one
 * with its clock. Whoever sees the task's price sees its time.
 */
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import DateInput from '@/components/ui/DateInput.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useTimerStore } from '@/stores/timer'
import { useAuthStore } from '@/stores/auth'
import { ApiRequestError } from '@/services/api'
import { createTimeEntry, deleteTimeEntry, listTimeEntries, updateTimeEntry } from '@/services/time'
import { formatClock, formatDate, formatDuration } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { TimeEntry } from '@/types/time'

const props = defineProps<{
  taskId: string
  /** The viewer is the task's freelancer and may still write time on it. */
  canTrack?: boolean
  /** The task is on a sent report: its time is billed and stays as it is. */
  billed?: boolean
}>()
const emit = defineEmits<{
  /** Time was added, changed or deleted: the task's total and price moved. */
  changed: []
  total: [seconds: number]
}>()

const auth = useAuthStore()
const timer = useTimerStore()

const entries = ref<TimeEntry[]>([])
const loaded = ref(false)

async function load(taskId: string) {
  try {
    const list = await listTimeEntries(taskId)
    if (taskId === props.taskId) entries.value = list
  } catch {
    toast.error(t('timelog.loadFailed'))
  } finally {
    loaded.value = true
  }
}

watch(
  () => props.taskId,
  (id) => {
    loaded.value = false
    entries.value = []
    void load(id)
  },
  { immediate: true },
)
// The timer started or stopped on this task: its entries changed.
watch(
  () => timer.version,
  () => {
    if (timer.touched.includes(props.taskId)) void load(props.taskId)
  },
)

/** An entry's time, the running one's clock included. */
function seconds(e: TimeEntry): number {
  return e.running_since && timer.running?.id === e.id ? timer.elapsed : e.seconds
}

const total = computed(() => entries.value.reduce((sum, e) => sum + seconds(e), 0))
watch(total, (n) => emit('total', n), { immediate: true })

function who(e: TimeEntry): string {
  return e.user.id === auth.user?.id ? t('common.you_capital') : e.user.name || e.user.email
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiRequestError)) return fallback
  return Object.values(error.fields ?? {})[0] ?? error.message
}

// --- writing time by hand, or changing an entry ----------------------------------

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "1:30" for an entry's time, as the form takes it. */
function durationInput(s: number): string {
  const minutes = Math.round(s / 60)
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

const editingId = ref<string | null>(null)
const spentOn = ref(today())
const duration = ref('')
const note = ref('')
const saving = ref(false)
const fieldErrors = ref<Record<string, string>>({})

function reset() {
  editingId.value = null
  spentOn.value = today()
  duration.value = ''
  note.value = ''
  fieldErrors.value = {}
}

function startEdit(e: TimeEntry) {
  editingId.value = e.id
  spentOn.value = e.spent_on
  duration.value = durationInput(e.seconds)
  note.value = e.note
  fieldErrors.value = {}
}

async function save() {
  if (saving.value || !duration.value.trim()) return
  const taskId = props.taskId
  const input = { spent_on: spentOn.value, duration: duration.value, note: note.value }
  saving.value = true
  fieldErrors.value = {}
  try {
    if (editingId.value) {
      const updated = await updateTimeEntry(editingId.value, input)
      entries.value = entries.value.map((x) => (x.id === updated.id ? updated : x))
    } else {
      await createTimeEntry(taskId, input)
    }
    reset()
    await load(taskId)
    emit('changed')
  } catch (error) {
    if (error instanceof ApiRequestError && error.fields) fieldErrors.value = error.fields
    else toast.error(errorMessage(error, t('timelog.saveFailed')))
  } finally {
    saving.value = false
  }
}

const removing = ref<TimeEntry | null>(null)
const removeBusy = ref(false)

async function remove() {
  const e = removing.value
  if (!e) return
  removeBusy.value = true
  try {
    await deleteTimeEntry(e.id)
    entries.value = entries.value.filter((x) => x.id !== e.id)
    if (timer.running?.id === e.id) timer.set(null)
    if (editingId.value === e.id) reset()
    emit('changed')
  } catch (error) {
    toast.error(errorMessage(error, t('timelog.deleteFailed')))
  } finally {
    removeBusy.value = false
    removing.value = null
  }
}

const inputClass =
  'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none'
</script>

<template>
  <div class="min-w-0">
    <p v-if="billed" class="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-500">{{ $t('timelog.billed') }}</p>

    <!-- add time by hand, or change an entry -->
    <form v-if="canTrack" class="mt-3 grid gap-2 sm:grid-cols-[11rem_6.5rem_minmax(0,1fr)_auto] sm:items-start" novalidate @submit.prevent="save">
      <DateInput v-model="spentOn" :label="$t('timelog.date')" hide-label compact :error="fieldErrors.spent_on" :disabled="saving" />
      <div>
        <label for="time-duration" class="sr-only">{{ $t('timelog.duration') }}</label>
        <input
          id="time-duration"
          v-model="duration"
          type="text"
          inputmode="text"
          autocomplete="off"
          :placeholder="$t('timelog.durationPlaceholder')"
          :title="$t('timelog.durationHint')"
          :disabled="saving"
          :aria-invalid="!!fieldErrors.duration"
          :aria-describedby="fieldErrors.duration ? 'time-duration-error' : undefined"
          :class="[inputClass, fieldErrors.duration ? 'border-red-500' : 'border-neutral-300']"
        />
      </div>
      <div>
        <label for="time-note" class="sr-only">{{ $t('timelog.note') }}</label>
        <input
          id="time-note"
          v-model="note"
          type="text"
          maxlength="500"
          :placeholder="$t('timelog.notePlaceholder')"
          :disabled="saving"
          :class="[inputClass, fieldErrors.note ? 'border-red-500' : 'border-neutral-300']"
        />
      </div>
      <div class="flex gap-2">
        <BaseButton type="submit" size="sm" :block="false" class="h-[38px]" :loading="saving" :disabled="!duration.trim()">
          {{ editingId ? $t('timelog.save') : $t('timelog.add') }}
        </BaseButton>
        <BaseButton v-if="editingId" variant="ghost" size="sm" :block="false" class="h-[38px]" :disabled="saving" @click="reset">{{ $t('common.cancel') }}</BaseButton>
      </div>
      <p v-if="fieldErrors.duration || fieldErrors.note" id="time-duration-error" class="text-xs text-red-600 sm:col-span-4">
        {{ fieldErrors.duration || fieldErrors.note }}
      </p>
    </form>

    <ol v-if="entries.length" class="mt-4 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
      <li v-for="e in entries" :key="e.id" class="group flex items-center gap-3 px-3 py-2.5 text-sm" :class="editingId === e.id ? 'bg-neutral-50' : ''">
        <span class="w-24 shrink-0 text-neutral-500">{{ formatDate(e.spent_on) }}</span>
        <span class="w-20 shrink-0 font-medium tabular-nums text-neutral-900">
          <template v-if="e.running_since && timer.running?.id === e.id">
            <span class="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 align-middle" aria-hidden="true" />{{ formatClock(seconds(e)) }}
          </template>
          <template v-else>{{ formatDuration(e.seconds) }}</template>
        </span>
        <span class="min-w-0 flex-1 truncate text-neutral-700" :title="e.note">{{ e.note }}</span>
        <span class="hidden shrink-0 text-xs text-neutral-400 sm:inline">{{ who(e) }}</span>
        <span v-if="e.can_edit && canTrack && editingId !== e.id" class="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <button v-if="!e.running_since" type="button" class="rounded px-1 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900" @click="startEdit(e)">{{ $t('timelog.edit') }}</button>
          <button type="button" class="rounded px-1 text-xs text-neutral-500 hover:bg-red-50 hover:text-red-600" @click="removing = e">{{ $t('timelog.delete') }}</button>
        </span>
      </li>
      <li class="flex items-center gap-3 bg-neutral-50 px-3 py-2.5 text-sm">
        <span class="w-24 shrink-0 text-neutral-500">{{ $t('timelog.total') }}</span>
        <span class="font-semibold tabular-nums text-neutral-900">{{ formatDuration(total) }}</span>
      </li>
    </ol>
    <p v-else-if="loaded" class="mt-3 text-sm text-neutral-400">{{ canTrack ? $t('timelog.emptyTrack') : $t('timelog.empty') }}</p>

    <ConfirmDialog
      :open="!!removing"
      :title="$t('timelog.confirmDelete')"
      :description="$t('timelog.confirmDeleteText')"
      :loading="removeBusy"
      @update:open="(v: boolean) => { if (!v) removing = null }"
      @confirm="remove"
    />
  </div>
</template>
