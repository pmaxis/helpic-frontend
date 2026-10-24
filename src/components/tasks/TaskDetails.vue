<script setup lang="ts">
/**
 * A task as two cards side by side: the task itself — title, actions,
 * description — and its details. The page fills the "nav" slot (back button,
 * breadcrumbs) at the top of the first card.
 *
 * Whoever may edit the task changes it in place: a click on the title or the
 * description turns it into a field, and the due date and project are pickers
 * in the details. "Edit task" in the "⋯" menu opens the whole form.
 *
 * An archived task is closed: it's shown as it was, and nothing on it —
 * status, priority, labels, people, comments, files — changes any more.
 */
import { computed, ref, watch } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NotFoundIllustration from '@/components/illustrations/NotFoundIllustration.vue'
import ActionMenu, { type MenuAction } from '@/components/ui/ActionMenu.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import TaskTitle from '@/components/tasks/TaskTitle.vue'
import TaskDescription from '@/components/tasks/TaskDescription.vue'
import TaskArchivedNote from '@/components/tasks/TaskArchivedNote.vue'
import TaskAttachments from '@/components/tasks/TaskAttachments.vue'
import TaskActivity from '@/components/tasks/TaskActivity.vue'
import TaskDetailsPanel from '@/components/tasks/TaskDetailsPanel.vue'
import { useTasksStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { ApiRequestError } from '@/services/api'
import { useI18n } from 'vue-i18n'
import { toast } from '@/composables/useToasts'
import { useStoredFlag } from '@/composables/useStoredFlag'
import type { Task, TaskInput } from '@/types/tasks'

const props = defineProps<{ taskId: string }>()

/** Both cards scroll on their own when their content is taller than the screen. */
const card = 'min-h-0 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-xs'

/** The details card can be hidden; the choice is remembered in this browser. */
const detailsHidden = useStoredFlag('helpic:task-details-hidden')

const emit = defineEmits<{
  /** The task was loaded (or reloaded); null when it can't be found. */
  loaded: [task: Task | null]
  /** The task changed here — status, content — so lists showing it can refresh. */
  changed: [task: Task]
  deleted: []
}>()

// tr, not t: t is the task in the functions below.
const { t: tr } = useI18n()
const tasks = useTasksStore()
const timer = useTimerStore()

const task = ref<Task | null>(null)
const notFound = ref(false)
const editing = ref(false)
const confirmDelete = ref(false)
const deleting = ref(false)
const confirmArchive = ref(false)
const archiving = ref(false)

/** Closed for good: paid, or put away by its owner. */
const archived = computed(() => !!task.value?.archived_at)

/** Edit and delete, as far as the viewer may — behind the "⋯" button. */
const taskActions = computed(() => {
  const actions: MenuAction[] = []
  const task_ = task.value
  if (task_?.can_edit) actions.push({ label: tr('task.edit'), onSelect: () => (editing.value = true) })
  if (task_?.can_archive) actions.push({ label: tr('task.archive'), onSelect: () => (confirmArchive.value = true) })
  if (task_?.can_delete) actions.push({ label: tr('task.delete'), danger: true, onSelect: () => (confirmDelete.value = true) })
  return actions
})

async function load(id: string) {
  notFound.value = false
  task.value = null
  try {
    task.value = await tasks.fetchTask(id)
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound.value = true
    else toast.error(tr('task.loadFailed'))
    emit('loaded', null)
    return
  }
  emit('loaded', task.value)
}

watch(
  () => props.taskId,
  (id) => void load(id),
  { immediate: true },
)

/** Shows the task as a change here left it. */
function onChanged(t: Task) {
  task.value = t
  emit('changed', t)
}

/** Something on the task changed elsewhere — a label renamed, people, time: show it as it is now. */
async function reloadTask() {
  const t = task.value
  if (!t) return
  try {
    onChanged(await tasks.fetchTask(t.id))
  } catch {
    // It shows the old version until the next visit.
  }
}

// The timer started or stopped on this task, here or in the sidebar: its time and price moved.
watch(
  () => timer.version,
  () => {
    if (task.value && timer.touched.includes(task.value.id)) void reloadTask()
  },
)

const saving = ref(false)

/**
 * Saves one change and keeps the rest of the task as it is. One at a time:
 * each sends the whole of title, description and due date.
 */
async function save(change: Partial<TaskInput>): Promise<boolean> {
  const t = task.value
  if (!t) return false
  saving.value = true
  try {
    onChanged(await tasks.updateTask(t.id, { title: t.title, description: t.description, due_on: t.due_on, ...change }))
    return true
  } catch (error) {
    const message = error instanceof ApiRequestError ? (Object.values(error.fields ?? {})[0] ?? error.message) : ''
    toast.error(message || tr('task.saveFailed'))
    return false
  } finally {
    saving.value = false
  }
}

async function archive() {
  const t = task.value
  if (!t) return
  archiving.value = true
  try {
    onChanged(await tasks.archiveTask(t.id))
    toast.success(tr('task.archived'))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : tr('task.archiveFailed'))
  } finally {
    archiving.value = false
    confirmArchive.value = false
  }
}

async function remove() {
  if (!task.value) return
  deleting.value = true
  try {
    await tasks.deleteTask(task.value.id)
    toast.success(tr('task.deleted'))
    emit('deleted')
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : tr('task.deleteFailed'))
  } finally {
    deleting.value = false
    confirmDelete.value = false
  }
}

function onSaved(t: Task) {
  editing.value = false
  onChanged(t)
}
</script>

<template>
  <!-- two cards: the task (title, actions, description) and its details -->
  <div class="grid min-h-0 flex-1 gap-4" :class="task && !detailsHidden ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : ''">
    <article :class="[card, 'p-5 sm:p-8', notFound ? 'flex flex-col' : '']">
      <slot name="nav" :task="task" />
      <EmptyState v-if="notFound" class="mt-6 flex-1 justify-center" :title="$t('task.notFound')" :description="$t('task.notFoundText')">
        <template #illustration>
          <NotFoundIllustration />
        </template>
      </EmptyState>
      <template v-else-if="task">
        <!-- title and actions -->
        <header class="mt-3 flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-5">
          <TaskTitle :task="task" :saving="saving" :save="save" />
          <div class="flex shrink-0 items-center gap-2">
            <BaseButton v-if="detailsHidden" variant="ghost" size="sm" :block="false" :title="$t('task.showDetails')" @click="detailsHidden = false">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M15 3v18" />
              </svg>
              {{ $t('task.details') }}
            </BaseButton>
            <ActionMenu v-if="taskActions.length" :actions="taskActions" :label="$t('task.options')" />
          </div>
        </header>

        <TaskArchivedNote v-if="task.archived_at" :archived-at="task.archived_at" :archived-by="task.archived_by" />
        <TaskDescription :task="task" :saving="saving" :save="save" />
        <TaskAttachments :task-id="task.id" :readonly="archived" />
        <TaskActivity
          :task-id="task.id"
          :version="task.updated_at"
          :readonly="archived"
          :show-time="task.can_see_price && (task.can_track_time || task.tracked_seconds !== null)"
          :can-track="task.can_track_time"
          :billed="task.billed"
          @time-changed="reloadTask"
        />
      </template>
    </article>

    <TaskDetailsPanel
      v-if="task && !detailsHidden"
      :class="card"
      :task="task"
      :saving="saving"
      :save="save"
      @changed="onChanged"
      @reload="reloadTask"
      @hide="detailsHidden = true"
    />

    <TaskFormModal v-if="editing && task" :task="task" @close="editing = false" @saved="onSaved" />
    <ConfirmDialog
      v-model:open="confirmArchive"
      :title="$t('task.confirmArchive')"
      :description="$t('task.confirmArchiveText')"
      :confirm-label="$t('task.archive')"
      :loading="archiving"
      @confirm="archive"
    />
    <ConfirmDialog
      v-model:open="confirmDelete"
      :title="$t('task.confirmDelete')"
      :description="$t('task.confirmDeleteText')"
      :loading="deleting"
      @confirm="remove"
    />
  </div>
</template>
