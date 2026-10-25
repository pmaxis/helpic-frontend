<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import StatusBadge from '@/components/tasks/StatusBadge.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import PriorityIcon from '@/components/tasks/PriorityIcon.vue'
import LabelChip from '@/components/tasks/LabelChip.vue'
import SubtaskCount from '@/components/tasks/SubtaskCount.vue'
import AvatarStack from '@/components/tasks/AvatarStack.vue'
import ActionMenu, { type MenuAction } from '@/components/ui/ActionMenu.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useTasksStore } from '@/stores/tasks'
import { ApiRequestError } from '@/services/api'
import { toast } from '@/composables/useToasts'
import { formatDate, isOverdue } from '@/utils/format'
import { t as tr } from '@/i18n'
import type { Task } from '@/types/tasks'

const props = withDefaults(
  defineProps<{
    tasks: Task[]
    loading?: boolean
    /** Hide the project column, e.g. on the project's own page. */
    hideProject?: boolean
  }>(),
  { loading: false, hideProject: false },
)

const emit = defineEmits<{
  /** A task was edited from the list (the tasks store already holds the new version). */
  saved: [task: Task]
}>()

/** The task being edited from its row's menu. */
const editing = ref<Task | null>(null)

function onSaved(t: Task) {
  editing.value = null
  emit('saved', t)
}

/** What the row's "⋯" menu offers: what the viewer may do to the task. */
function actions(t: Task): MenuAction[] {
  const out: MenuAction[] = []
  if (t.can_edit) out.push({ label: tr('taskList.edit'), onSelect: () => (editing.value = t) })
  if (t.can_delete) out.push({ label: tr('task.delete'), danger: true, onSelect: () => (deleting.value = t) })
  return out
}

const tasksStore = useTasksStore()
/** The task being deleted from its row's menu, while it's asked about. */
const deleting = ref<Task | null>(null)
const deleteBusy = ref(false)

/** The tasks store drops it, and with it the row. */
async function remove() {
  const t = deleting.value
  if (!t) return
  deleteBusy.value = true
  try {
    await tasksStore.deleteTask(t.id)
    toast.success(tr('task.deleted'))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : tr('task.deleteFailed'))
  } finally {
    deleteBusy.value = false
    deleting.value = null
  }
}

/** Task · Status · [Project] · People · Due — on md screens and up. */
const grid = computed(() =>
  props.hideProject
    ? 'md:grid-cols-[minmax(0,1fr)_9rem_7rem_7.5rem]'
    : 'md:grid-cols-[minmax(0,1fr)_9rem_10rem_7rem_7.5rem]',
)

function open(t: Task) {
  return t.status === 'new' || t.status === 'in_progress'
}

/** First line of the description, as a hint under the title. */
function summary(t: Task): string {
  return t.description.split('\n').find((l) => l.trim())?.trim() ?? ''
}
</script>

<template>
  <div class="rounded-xl border border-neutral-200" :class="loading ? 'opacity-60' : ''">
    <!-- not clipped, so a row's menu can open past the list: the corners are the header's and the last row's -->
    <!-- the last, unnamed column holds the row's menu -->
    <div class="hidden rounded-t-xl border-b border-neutral-200 bg-neutral-50 pr-10 md:block" aria-hidden="true">
      <div class="grid gap-4 px-4 py-2 text-xs font-medium tracking-wide text-neutral-500 uppercase" :class="grid">
        <span>{{ $t('taskList.task') }}</span>
        <span>{{ $t('taskList.status') }}</span>
        <span v-if="!hideProject">{{ $t('taskList.project') }}</span>
        <span>{{ $t('taskList.people') }}</span>
        <span class="text-right">{{ $t('taskList.due') }}</span>
      </div>
    </div>

    <ul class="divide-y divide-neutral-100">
      <li v-for="t in tasks" :key="t.id" class="group flex items-center transition-colors first:max-md:rounded-t-xl last:rounded-b-xl hover:bg-neutral-50">
        <RouterLink
          :to="{ name: 'task-detail', params: { id: t.id } }"
          class="grid min-w-0 flex-1 grid-cols-1 gap-x-4 gap-y-2 py-3 pl-4 md:items-center md:pr-4"
          :class="grid"
        >
          <!-- task -->
          <div class="min-w-0">
            <div class="flex min-w-0 items-center gap-1.5">
              <PriorityIcon :priority="t.priority" />
              <p class="min-w-0 truncate text-sm font-medium text-neutral-900 group-hover:text-neutral-950">
                {{ t.title }}
              </p>
              <span v-if="t.labels.length" class="flex shrink-0 gap-1">
                <LabelChip v-for="l in t.labels.slice(0, 3)" :key="l.id" :name="l.name" :color="l.color" size="xs" />
                <span v-if="t.labels.length > 3" class="text-[10px] leading-5 text-neutral-400">+{{ t.labels.length - 3 }}</span>
              </span>
              <SubtaskCount v-if="t.subtasks.total" :count="t.subtasks" />
            </div>
            <p v-if="t.parent" class="mt-0.5 truncate text-xs text-neutral-500" :title="$t('subtasks.of', { title: t.parent.title })">↳ {{ t.parent.title }}</p>
            <p v-else-if="summary(t)" class="mt-0.5 truncate text-xs text-neutral-500">{{ summary(t) }}</p>
          </div>

          <!-- status -->
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 md:contents">
            <div class="min-w-0">
              <StatusBadge :status="t.status" :name="t.status_name" />
            </div>

            <!-- project -->
            <div v-if="!hideProject" class="flex min-w-0 items-center gap-1.5 text-sm" :class="t.project ? 'text-neutral-700' : 'text-neutral-300'">
              <svg
                v-if="t.project"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-3.5 w-3.5 shrink-0 text-neutral-400"
                aria-hidden="true"
              >
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              <span class="truncate">{{ t.project?.name ?? '—' }}</span>
            </div>

            <!-- who took part -->
            <div class="flex min-w-0 items-center">
              <AvatarStack :people="t.participants" :max="4" />
            </div>

            <!-- due -->
            <div class="text-sm md:text-right">
              <span
                v-if="t.due_on"
                class="inline-flex items-center gap-1 whitespace-nowrap"
                :class="open(t) && isOverdue(t.due_on) ? 'font-medium text-red-600' : 'text-neutral-600'"
              >
                <svg
                  v-if="open(t) && isOverdue(t.due_on)"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-3.5 w-3.5"
                  aria-label="Overdue"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                {{ formatDate(t.due_on) }}
              </span>
              <span v-else class="text-neutral-300 max-md:hidden">—</span>
            </div>
          </div>
        </RouterLink>
        <div class="flex w-10 shrink-0 justify-center self-stretch pr-2 md:items-center max-md:pt-2.5">
          <!-- shown on hover, and while its menu is open -->
          <ActionMenu
            v-if="actions(t).length"
            variant="plain"
            class="transition focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            :actions="actions(t)"
            :label="$t('taskList.optionsNamed', { title: t.title })"
          />
        </div>
      </li>
    </ul>

    <TaskFormModal v-if="editing" :task="editing" @close="editing = null" @saved="onSaved" />
    <ConfirmDialog
      :open="!!deleting"
      :title="$t('task.confirmDelete')"
      :description="$t('task.confirmDeleteText')"
      :loading="deleteBusy"
      @update:open="
        (v) => {
          if (!v) deleting = null
        }
      "
      @confirm="remove"
    />
  </div>
</template>
