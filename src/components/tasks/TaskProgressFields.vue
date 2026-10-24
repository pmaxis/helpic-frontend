<script setup lang="ts">
/**
 * Where the task stands: its status, priority and labels, as rows of the
 * details card. Either side sets the priority and the labels, in any status;
 * the status takes the columns of the task's board the viewer may move it to.
 */
import { computed, ref, watch } from 'vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import StatusBadge from '@/components/tasks/StatusBadge.vue'
import PriorityIcon from '@/components/tasks/PriorityIcon.vue'
import LabelChip from '@/components/tasks/LabelChip.vue'
import LabelPicker from '@/components/tasks/LabelPicker.vue'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'
import { fetchColumns } from '@/stores/board'
import { ApiRequestError } from '@/services/api'
import { columnName, priorityOptions as priorityChoices, STATUS_DOT } from '@/constants/tasks'
import { t as tr } from '@/i18n'
import { toast } from '@/composables/useToasts'
import type { BoardColumn, BoardScope } from '@/types/board'
import type { Task, TaskPriority } from '@/types/tasks'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{
  /** The task as the server has it after a change here. */
  changed: [task: Task]
  /** A label was renamed or deleted: the task needs loading again. */
  reload: []
}>()

const auth = useAuthStore()
const tasks = useTasksStore()

const busy = ref(false)
/** The task's board columns — the statuses it can take. */
const columns = ref<BoardColumn[]>([])
/** The viewer manages this board, so they may move a task into any status. */
const canManageBoard = ref(false)

const archived = computed(() => !!props.task.archived_at)

/** The board this task is on: the owner's own for a personal task; else its client's for a freelancer, its freelancer's for a client. */
const boardScope = computed<BoardScope>(() => {
  const t = props.task
  if (!t.client) return { with: 'personal' }
  return { with: auth.isClient ? (t.freelancer?.id ?? '') : t.client.id }
})

async function loadColumns() {
  columns.value = []
  const t = props.task
  // An archived task stays in its status: there's nothing to pick from.
  if (t.archived_at) return
  try {
    const scope = t.project ? { project: t.project.id } : boardScope.value
    let data
    try {
      data = await fetchColumns(scope)
    } catch {
      data = await fetchColumns(boardScope.value)
    }
    if (props.task.id === t.id) {
      columns.value = data.columns
      canManageBoard.value = data.can_manage
    }
  } catch {
    // Without the columns the status just can't be changed from here.
  }
}
watch(() => props.task.id, loadColumns, { immediate: true })

/**
 * Columns the viewer may put the task in: its own bucket, any column that
 * isn't done, and every column when they manage the board.
 */
const statusOptions = computed(() => {
  const t = props.task
  if (t.archived_at) return []
  const current = columns.value.find((c) => c.id === t.status_id)
  return columns.value
    .filter(
      (c) =>
        c.id === t.status_id ||
        (!!current && c.category === current.category) ||
        canManageBoard.value ||
        auth.isFreelancer ||
        c.participants_can_move,
    )
    .map((c) => ({ value: c.id, label: columnName(c.name) }))
})

const priorityOptions = computed(() => priorityChoices())

async function move(statusId: string) {
  if (statusId === props.task.status_id) return
  busy.value = true
  try {
    emit('changed', await tasks.moveToStatus(props.task.id, statusId))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : tr('task.statusFailed'))
  } finally {
    busy.value = false
  }
}

async function setPriority(priority: string) {
  if (priority === props.task.priority) return
  busy.value = true
  try {
    emit('changed', await tasks.setPriority(props.task.id, priority as TaskPriority))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : tr('task.priorityFailed'))
  } finally {
    busy.value = false
  }
}

async function setLabels(ids: string[]) {
  try {
    emit('changed', await tasks.setLabels(props.task.id, ids))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : tr('task.labelsFailed'))
  }
}
</script>

<template>
  <dl class="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 text-sm">
    <dt class="text-neutral-500">{{ $t('task.status') }}</dt>
    <dd class="min-w-0">
      <SelectInput
        v-if="statusOptions.length > 1"
        :model-value="task.status_id"
        :options="statusOptions"
        :disabled="busy"
        :searchable="false"
        :aria-label="$t('task.status')"
        @update:model-value="move"
      >
        <template #icon>
          <span class="block h-2 w-2 rounded-full" :class="STATUS_DOT[task.status]" />
        </template>
      </SelectInput>
      <StatusBadge v-else :status="task.status" :name="task.status_name" />
    </dd>

    <dt class="text-neutral-500">{{ $t('task.priority') }}</dt>
    <dd class="min-w-0">
      <span v-if="archived" class="inline-flex items-center gap-1.5 text-neutral-800">
        <PriorityIcon :priority="task.priority" show-none />
        {{ priorityOptions.find((o) => o.value === task.priority)?.label }}
      </span>
      <SelectInput
        v-else
        :model-value="task.priority"
        :options="priorityOptions"
        :disabled="busy"
        :searchable="false"
        :aria-label="$t('task.priority')"
        @update:model-value="setPriority"
      >
        <template #icon>
          <PriorityIcon :priority="task.priority" show-none />
        </template>
      </SelectInput>
    </dd>

    <dt class="self-start pt-0.5 text-neutral-500">{{ $t('task.labels') }}</dt>
    <dd class="flex min-w-0 flex-wrap items-center gap-1">
      <LabelChip v-for="l in task.labels" :key="l.id" :name="l.name" :color="l.color" />
      <span v-if="archived && !task.labels.length" class="text-neutral-400">{{ $t('task.none') }}</span>
      <LabelPicker
        v-if="!archived"
        :model-value="task.labels.map((l) => l.id)"
        :scope="boardScope"
        @update:model-value="setLabels"
        @labels-changed="emit('reload')"
      />
    </dd>
  </dl>
</template>
