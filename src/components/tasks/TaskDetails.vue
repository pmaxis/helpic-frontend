<script setup lang="ts">
/**
 * A task as two cards side by side: the task itself — title, actions,
 * description — and its details. The page fills the "nav" slot (back button,
 * breadcrumbs) at the top of the first card.
 *
 * Whoever may edit the task changes it in place: a click on the title or the
 * description turns it into a field, and the due date and project are pickers
 * in the details. "Edit task" in the "⋯" menu opens the whole form.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'
import DateInput from '@/components/ui/DateInput.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import ActionMenu, { type MenuAction } from '@/components/ui/ActionMenu.vue'
import StatusBadge from '@/components/tasks/StatusBadge.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import TaskAttachments from '@/components/tasks/TaskAttachments.vue'
import TaskActivity from '@/components/tasks/TaskActivity.vue'
import PriorityIcon from '@/components/tasks/PriorityIcon.vue'
import LabelChip from '@/components/tasks/LabelChip.vue'
import LabelPicker from '@/components/tasks/LabelPicker.vue'
import TaskPeople from '@/components/tasks/TaskPeople.vue'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'
import { useProjectsStore } from '@/stores/projects'
import { fetchColumns } from '@/stores/board'
import { ApiRequestError } from '@/services/api'
import { columnName, priorityOptions as priorityChoices, STATUS_DOT } from '@/constants/tasks'
import { useI18n } from 'vue-i18n'
import { formatDate, isOverdue } from '@/utils/format'
import { formatMoney, priceInput } from '@/utils/money'
import { toast } from '@/composables/useToasts'
import type { BoardColumn } from '@/types/board'
import type { Task, TaskInput, TaskPriority } from '@/types/tasks'
import type { BoardScope } from '@/types/board'

const props = defineProps<{ taskId: string }>()

/** Both cards scroll on their own when their content is taller than the screen. */
const card = 'min-h-0 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-xs'

/** The details card can be hidden; the choice is remembered in this browser. */
const DETAILS_KEY = 'helpic:task-details-hidden'
function readDetailsHidden(): boolean {
  try {
    return localStorage.getItem(DETAILS_KEY) === '1'
  } catch {
    return false
  }
}
const detailsHidden = ref(readDetailsHidden())
watch(detailsHidden, (hidden) => {
  try {
    localStorage.setItem(DETAILS_KEY, hidden ? '1' : '0')
  } catch {
    // storage may be unavailable (private mode); the choice then lasts for this visit
  }
})

const emit = defineEmits<{
  /** The task was loaded (or reloaded); null when it can't be found. */
  loaded: [task: Task | null]
  /** The task changed here — status, content — so lists showing it can refresh. */
  changed: [task: Task]
  deleted: []
}>()

// tr, not t: t is the task in the functions below.
const { t: tr } = useI18n()
const auth = useAuthStore()
const tasks = useTasksStore()
const projects = useProjectsStore()

const task = ref<Task | null>(null)
const notFound = ref(false)
const busy = ref(false)
/** The task's board columns — the statuses it can take. */
const columns = ref<BoardColumn[]>([])
/** The viewer manages this board, so they may move a task into any status. */
const canManageBoard = ref(false)
const editing = ref(false)
const confirmDelete = ref(false)
const deleting = ref(false)

const open = computed(() => task.value?.status === 'new' || task.value?.status === 'in_progress')

/** Edit and delete, as far as the viewer may — behind the "⋯" button. */
const taskActions = computed(() => {
  const actions: MenuAction[] = []
  const task_ = task.value
  if (task_?.can_edit) actions.push({ label: tr('task.edit'), onSelect: () => (editing.value = true) })
  if (task_?.can_delete) actions.push({ label: tr('task.delete'), danger: true, onSelect: () => (confirmDelete.value = true) })
  return actions
})
const overdue = computed(() => !!task.value?.due_on && open.value && isOverdue(task.value.due_on))

/** Who created the task: either side, or a member of the client's team. */
const creator = computed(() => (task.value?.creator.id ? task.value.creator : null))

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}

function isMe(id: string | undefined): boolean {
  return !!id && id === auth.user?.id
}

/**
 * Columns the viewer may put the task in: its own bucket, any column that
 * isn't done, and every column when they manage the board.
 */
const statusOptions = computed(() => {
  const t = task.value
  if (!t) return []
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

async function load(id: string) {
  notFound.value = false
  task.value = null
  columns.value = []
  try {
    task.value = await tasks.fetchTask(id)
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound.value = true
    else toast.error(tr('task.loadFailed'))
    emit('loaded', null)
    return
  }
  emit('loaded', task.value)
  if (task.value.can_edit && !projects.loaded) void projects.fetchProjects().catch(() => {})
  const t = task.value
  try {
    const scope = t.project ? { project: t.project.id } : boardScope.value
    let data
    try {
      data = await fetchColumns(scope)
    } catch {
      data = await fetchColumns(boardScope.value)
    }
    if (task.value?.id === t.id) {
      columns.value = data.columns
      canManageBoard.value = data.can_manage
    }
  } catch {
    // Without the columns the status just can't be changed from here.
  }
}

watch(
  () => props.taskId,
  (id) => void load(id),
  { immediate: true },
)

/** The board this task is on: its client's (or personal) for a freelancer, its freelancer's for a client. */
const boardScope = computed<BoardScope>(() => {
  const t = task.value
  if (!t) return {}
  return { with: auth.isClient ? (t.freelancer?.id ?? '') : (t.client?.id ?? 'personal') }
})

const priorityOptions = computed(() => priorityChoices())

/** Either side sets the priority and the labels, in any status. */
async function setPriority(priority: string) {
  const t = task.value
  if (!t || priority === t.priority) return
  busy.value = true
  try {
    task.value = await tasks.setPriority(t.id, priority as TaskPriority)
    emit('changed', task.value)
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : tr('task.priorityFailed'))
  } finally {
    busy.value = false
  }
}

async function setLabels(ids: string[]) {
  const t = task.value
  if (!t) return
  try {
    task.value = await tasks.setLabels(t.id, ids)
    emit('changed', task.value)
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : tr('task.labelsFailed'))
  }
}

/** A label was renamed or deleted in the picker: show the task as it is now. */
async function reloadTask() {
  const t = task.value
  if (!t) return
  try {
    task.value = await tasks.fetchTask(t.id)
    emit('changed', task.value)
  } catch {
    // It shows the old name until the next visit.
  }
}

async function move(statusId: string) {
  if (!task.value || statusId === task.value.status_id) return
  busy.value = true
  try {
    task.value = await tasks.moveToStatus(task.value.id, statusId)
    emit('changed', task.value)
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : tr('task.statusFailed'))
  } finally {
    busy.value = false
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

// --- editing in place ---------------------------------------------------------------

/** The text field being edited in place, if any, and its draft. */
const inline = ref<'title' | 'description' | null>(null)
const draft = ref('')
const saving = ref(false)
const titleInput = ref<HTMLInputElement | null>(null)
const descriptionInput = ref<HTMLTextAreaElement | null>(null)

async function startInline(field: 'title' | 'description') {
  const t = task.value
  if (!t?.can_edit || saving.value) return
  draft.value = t[field]
  inline.value = field
  await nextTick()
  const el = field === 'title' ? titleInput.value : descriptionInput.value
  el?.focus()
  if (field === 'description') el?.setSelectionRange(el.value.length, el.value.length)
}

/**
 * The Save and Cancel buttons keep the focus in the field, so pressing one
 * doesn't first save through the field's blur.
 */
function keepFocus(e: MouseEvent) {
  e.preventDefault()
}

/** A click on the description edits it — unless the user was selecting text. */
function onDescriptionClick() {
  if (!window.getSelection()?.toString()) void startInline('description')
}

/** Saves one change and keeps the rest of the task as it is. */
async function save(change: Partial<TaskInput>): Promise<boolean> {
  const t = task.value
  if (!t) return false
  saving.value = true
  try {
    task.value = await tasks.updateTask(t.id, { title: t.title, description: t.description, due_on: t.due_on, ...change })
    emit('changed', task.value)
    return true
  } catch (error) {
    const message = error instanceof ApiRequestError ? (Object.values(error.fields ?? {})[0] ?? error.message) : ''
    toast.error(message || tr('task.saveFailed'))
    return false
  } finally {
    saving.value = false
  }
}

async function commitInline() {
  const field = inline.value
  const t = task.value
  if (!field || !t || saving.value) return
  const value = draft.value.trim()
  // An emptied title or an unchanged field just goes back to how it was.
  if ((field === 'title' && !value) || value === t[field]) {
    inline.value = null
    return
  }
  if (await save({ [field]: value })) inline.value = null
}

// The price, which only the freelancer sets — in any status, so it has its own field and endpoint.
const editingPrice = ref(false)
const priceDraft = ref('')
const priceField = ref<HTMLInputElement | null>(null)

async function startPrice() {
  if (!task.value?.can_set_price) return
  priceDraft.value = priceInput(task.value.price_cents)
  editingPrice.value = true
  await nextTick()
  priceField.value?.select()
}

async function commitPrice() {
  const t = task.value
  if (!editingPrice.value || !t || saving.value) return
  const value = priceDraft.value.trim()
  if (value === priceInput(t.price_cents)) {
    editingPrice.value = false
    return
  }
  saving.value = true
  try {
    task.value = await tasks.setPrice(t.id, value || null)
    emit('changed', task.value)
    editingPrice.value = false
  } catch (error) {
    const message = error instanceof ApiRequestError ? (Object.values(error.fields ?? {})[0] ?? error.message) : ''
    toast.error(message || tr('task.priceFailed'))
  } finally {
    saving.value = false
  }
}

function saveDueOn(value: string) {
  if (task.value && value !== (task.value.due_on ?? '')) void save({ due_on: value || null })
}

function saveProject(projectId: string) {
  if (task.value && projectId !== (task.value.project?.id ?? '')) void save({ project_id: projectId })
}

/** Projects the task can move to: those of its freelancer and client. */
const projectOptions = computed(() => {
  const t = task.value
  if (!t) return []
  const pair = projects.projects.filter((p) => p.freelancer.id === t.freelancer?.id && (p.client?.id ?? '') === (t.client?.id ?? ''))
  return [{ value: '', label: tr('task.none') }, ...pair.map((p) => ({ value: p.id, label: p.name }))]
})

function onSaved(t: Task) {
  task.value = t
  editing.value = false
  emit('changed', t)
}
</script>

<template>
  <!-- two cards: the task (title, actions, description) and its details -->
  <div class="grid min-h-0 flex-1 gap-4" :class="task && !detailsHidden ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : ''">
    <article :class="[card, 'p-5 sm:p-8']">
      <slot name="nav" :task="task" />
      <EmptyState v-if="notFound" class="mt-6" :title="$t('task.notFound')" :description="$t('task.notFoundText')" />
      <template v-else-if="task">
        <!-- title and actions -->
        <header class="mt-3 flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-5">
          <div v-if="inline === 'title'" class="min-w-0 flex-1">
            <label for="task-title-input" class="sr-only">{{ $t('task.titleLabel') }}</label>
            <input
              id="task-title-input"
              ref="titleInput"
              v-model="draft"
              type="text"
              maxlength="200"
              :disabled="saving"
              class="-mx-2 -my-1 block w-[calc(100%+1rem)] rounded-lg border border-neutral-300 bg-white px-2 py-1 text-2xl leading-tight font-semibold tracking-tight text-neutral-900 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
              @keydown.enter.prevent="commitInline"
              @keydown.esc.prevent="inline = null"
              @blur="commitInline"
            />
            <div class="mt-2 flex items-center justify-end gap-2">
              <span class="mr-auto text-xs text-neutral-400">{{ $t('task.enterToSave') }}</span>
              <BaseButton variant="ghost" size="sm" :block="false" :disabled="saving" @mousedown="keepFocus" @click="inline = null">{{ $t('common.cancel') }}</BaseButton>
              <BaseButton size="sm" :block="false" :loading="saving" :disabled="!draft.trim()" @mousedown="keepFocus" @click="commitInline">{{ $t('common.save') }}</BaseButton>
            </div>
          </div>
          <h1
            v-else
            class="min-w-0 flex-1 text-2xl leading-tight font-semibold tracking-tight break-words text-neutral-900"
          >
            <button
              v-if="task.can_edit"
              type="button"
              class="-mx-2 -my-1 w-[calc(100%+1rem)] cursor-text rounded-lg px-2 py-1 text-left transition-colors hover:bg-neutral-100"
              :title="$t('task.clickToEditTitle')"
              @click="startInline('title')"
            >
              {{ task.title }}
            </button>
            <template v-else>{{ task.title }}</template>
          </h1>
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

        <section aria-labelledby="task-description" class="mt-5 min-w-0">
          <h2 id="task-description" class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">{{ $t('task.description') }}</h2>
          <div v-if="inline === 'description'" class="mt-3">
            <label for="task-description-input" class="sr-only">{{ $t('task.description') }}</label>
            <textarea
              id="task-description-input"
              ref="descriptionInput"
              v-model="draft"
              rows="8"
              maxlength="20000"
              :disabled="saving"
              :placeholder="$t('task.descriptionPlaceholder')"
              class="block w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[15px] leading-7 text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
              @keydown.esc.prevent="inline = null"
              @keydown.meta.enter.prevent="commitInline"
              @keydown.ctrl.enter.prevent="commitInline"
              @blur="commitInline"
            />
            <div class="mt-2 flex items-center justify-end gap-2">
              <span class="mr-auto text-xs text-neutral-400">{{ $t('task.ctrlEnterToSave') }}</span>
              <BaseButton variant="ghost" size="sm" :block="false" :disabled="saving" @mousedown="keepFocus" @click="inline = null">{{ $t('common.cancel') }}</BaseButton>
              <BaseButton size="sm" :block="false" :loading="saving" @mousedown="keepFocus" @click="commitInline">{{ $t('common.save') }}</BaseButton>
            </div>
          </div>
          <div
            v-else-if="task.description"
            class="mt-3 text-[15px] leading-7 whitespace-pre-wrap break-words text-neutral-800"
            :class="task.can_edit ? '-mx-2 cursor-text rounded-lg px-2 transition-colors hover:bg-neutral-50' : ''"
            :title="task.can_edit ? $t('task.clickToEditDescription') : undefined"
            @click="task.can_edit && onDescriptionClick()"
          >{{ task.description }}</div>
          <div v-else class="mt-3 rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center">
            <p class="text-sm text-neutral-400">{{ $t('task.noDescription') }}</p>
            <button
              v-if="task.can_edit"
              type="button"
              class="mt-2 text-sm font-medium text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline"
              @click="startInline('description')"
            >
              {{ $t('task.addDescription') }}
            </button>
          </div>
        </section>

        <TaskAttachments :task-id="task.id" />
        <TaskActivity :task-id="task.id" :version="task.updated_at" />
      </template>
    </article>

      <!-- details -->
    <aside v-if="task && !detailsHidden" :class="card" aria-labelledby="task-details">
      <div class="flex items-center justify-between gap-2 border-b border-neutral-200 py-3 pr-3 pl-5">
        <h2 id="task-details" class="text-sm font-semibold text-neutral-900">{{ $t('task.details') }}</h2>
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          :title="$t('task.hideDetails')"
          :aria-label="$t('task.hideDetails')"
          @click="detailsHidden = true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M15 3v18" />
            <path d="m8 9 3 3-3 3" />
          </svg>
        </button>
      </div>
      <div class="divide-y divide-neutral-100">
        <section class="px-5 py-4" :aria-label="$t('task.groups.progress')">
          <h3 class="mb-3 text-xs font-medium tracking-wide text-neutral-400 uppercase" aria-hidden="true">{{ $t('task.groups.progress') }}</h3>
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
              <SelectInput
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
              <LabelPicker
                :model-value="task.labels.map((l) => l.id)"
                :scope="boardScope"
                @update:model-value="setLabels"
                @labels-changed="reloadTask"
              />
            </dd>
          </dl>
        </section>
        <section class="px-5 py-4" :aria-label="$t('task.groups.schedule')">
          <h3 class="mb-3 text-xs font-medium tracking-wide text-neutral-400 uppercase" aria-hidden="true">{{ $t('task.groups.schedule') }}</h3>
          <dl class="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 text-sm">
            <dt class="text-neutral-500">{{ $t('task.project') }}</dt>
            <dd class="min-w-0">
              <SelectInput
                v-if="task.can_edit && projectOptions.length > 1"
                :model-value="task.project?.id ?? ''"
                :options="projectOptions"
                :disabled="saving"
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

            <dt class="text-neutral-500">{{ $t('task.dueDate') }}</dt>
            <dd v-if="task.can_edit" class="min-w-0">
              <DateInput
                :model-value="task.due_on ?? ''"
                :label="$t('task.dueDate')"
                hide-label
                compact
                :placeholder="$t('task.none')"
                :disabled="saving"
                @update:model-value="saveDueOn"
              />
              <span v-if="overdue" class="mt-1.5 inline-block rounded-full bg-red-50 px-1.5 py-px text-xs font-medium text-red-700 ring-1 ring-red-600/20 ring-inset">
                {{ $t('task.overdue') }}
              </span>
            </dd>
            <dd v-else class="flex min-w-0 items-center gap-2">
              <template v-if="task.due_on">
                <span :class="overdue ? 'font-medium text-red-600' : 'text-neutral-800'">{{ formatDate(task.due_on) }}</span>
                <span v-if="overdue" class="rounded-full bg-red-50 px-1.5 py-px text-xs font-medium text-red-700 ring-1 ring-red-600/20 ring-inset">
                  {{ $t('task.overdue') }}
                </span>
              </template>
              <span v-else class="text-neutral-400">{{ $t('task.none') }}</span>
            </dd>

            <template v-if="task.can_see_price">
              <dt class="text-neutral-500">{{ $t('task.price') }}</dt>
              <dd class="min-w-0">
                <input
                  v-if="editingPrice"
                  ref="priceField"
                  v-model="priceDraft"
                  type="text"
                  inputmode="decimal"
                  :aria-label="$t('task.price')"
                  :placeholder="$t('task.pricePlaceholder', { currency: task.currency })"
                  :disabled="saving"
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
          </dl>
        </section>
        <section class="px-5 py-4" :aria-label="$t('task.groups.people')">
          <h3 class="mb-3 text-xs font-medium tracking-wide text-neutral-400 uppercase" aria-hidden="true">{{ $t('task.groups.people') }}</h3>
          <dl class="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 text-sm">
            <TaskPeople :task="task" @changed="reloadTask" />

            <dt class="text-neutral-500">{{ $t('task.createdBy') }}</dt>
            <dd class="flex min-w-0 items-center gap-2">
              <template v-if="creator">
                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-600" aria-hidden="true">
                  {{ initials(creator.name || creator.email) }}
                </span>
                <span class="truncate text-neutral-800">{{ isMe(creator.id) ? $t('common.you_capital') : creator.name || creator.email }}</span>
              </template>
            </dd>
          </dl>
        </section>
      </div>
      <p class="border-t border-neutral-100 px-5 py-4 text-xs text-neutral-400">
        {{ $t('task.created', { date: formatDate(task.created_at) }) }}
        <template v-if="formatDate(task.updated_at) !== formatDate(task.created_at)"> · {{ $t('task.updated', { date: formatDate(task.updated_at) }) }}</template>
      </p>
    </aside>

    <TaskFormModal v-if="editing && task" :task="task" @close="editing = false" @saved="onSaved" />
    <ConfirmDialog
      v-model:open="confirmDelete"
      :title="$t('task.confirmDelete')"
      :description="$t('task.confirmDeleteText')"
      :loading="deleting"
      @confirm="remove"
    />
  </div>
</template>
