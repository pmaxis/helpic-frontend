<script setup lang="ts">
/**
 * The Jira-style board a freelancer shares with a client. Its columns are the
 * pair's workflow statuses; dropping a card into a column sets the task's
 * status (native HTML5 drag and drop). Every column belongs to a category, and
 * a card can only go to a column whose category the user's role allows. The
 * freelancer, or the project's author, manages the columns: reorders them by
 * dragging the header, renames them by clicking the name, and adds, edits and
 * removes them from the header menu. Anyone else only moves cards. A card's
 * pencil button edits the task, for whoever may.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import ColumnFormModal from '@/components/board/ColumnFormModal.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import PriorityIcon from '@/components/tasks/PriorityIcon.vue'
import LabelChip from '@/components/tasks/LabelChip.vue'
import AvatarStack from '@/components/tasks/AvatarStack.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useBoardStore } from '@/stores/board'
import { ApiRequestError } from '@/services/api'
import { columnName, STATUS_DOT } from '@/constants/tasks'
import { t as tr } from '@/i18n'
import { formatDate, isOverdue } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import type { BoardColumn } from '@/types/board'

type Lane = BoardColumn & { tasks: Task[] }
import type { Task } from '@/types/tasks'

withDefaults(defineProps<{ hideProject?: boolean }>(), { hideProject: false })
const emit = defineEmits<{ 'new-task': [column: BoardColumn] }>()

const auth = useAuthStore()
const board = useBoardStore()

/**
 * Whether the user can add a task straight into a column. The freelancer and
 * whoever manages this board may use any column. Everyone else only uses a
 * category the owner opened to participants.
 */
function canCreateIn(col: BoardColumn): boolean {
  // An all-board lane spans several boards, so it can't say which one a new task is for.
  if (board.merged) return false
  return auth.isFreelancer || board.canManage || col.participants_can_move
}

function open(t: Task) {
  return t.status === 'new' || t.status === 'in_progress'
}

/** The task being edited from its card's pencil button. */
const editingTask = ref<Task | null>(null)

function onTaskSaved(t: Task) {
  editingTask.value = null
  board.replaceTask(t)
}

// --- drag and drop ------------------------------------------------------------

const dragging = ref<Task | null>(null)
/** Where the dragged card would land: a column and an index in it. */
const dropAt = ref<{ columnId: string; index: number } | null>(null)

/** A card may stay in its category, or enter one this person is allowed to. */
function canDrop(col: BoardColumn): boolean {
  const task = dragging.value
  if (!task) return false
  if (board.merged) return task.status === col.category || task.next_statuses.includes(col.category)
  const from = board.columns.find((c) => c.id === task.status_id)
  if (from && from.category_id === col.category_id) return true
  return auth.isFreelancer || board.canManage || col.participants_can_move
}

/** Height of the dragged card, so the drop placeholder takes the same room. */
const draggedHeight = ref(0)

function onDragStart(e: DragEvent, task: Task) {
  dragging.value = task
  draggedHeight.value = (e.currentTarget as HTMLElement).offsetHeight
  e.dataTransfer?.setData('text/plain', task.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragEnd() {
  dragging.value = null
  dropAt.value = null
}

function onDragOver(e: DragEvent, col: BoardColumn, ci: number) {
  if (draggingColumn.value) return onColumnDragOver(e, ci)
  if (!canDrop(col)) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  // The card lands before the first card whose middle is below the pointer.
  const column = e.currentTarget as HTMLElement
  const cards = [...column.querySelectorAll<HTMLElement>('[data-card]')].filter((el) => el.dataset.card !== dragging.value?.id)
  let index = cards.length
  for (let i = 0; i < cards.length; i++) {
    const r = cards[i].getBoundingClientRect()
    if (e.clientY < r.top + r.height / 2) {
      index = i
      break
    }
  }
  dropAt.value = { columnId: col.id, index }
}

function onDragLeave(e: DragEvent, col: BoardColumn) {
  const column = e.currentTarget as HTMLElement
  if (dropAt.value?.columnId === col.id && !column.contains(e.relatedTarget as Node)) dropAt.value = null
}

// --- moving columns -------------------------------------------------------------

const draggingColumn = ref<BoardColumn | null>(null)
/** Where the dragged column would land: before the column at this index (length = at the end). */
const columnDropIndex = ref<number | null>(null)

function onColumnDragStart(e: DragEvent, col: BoardColumn) {
  if (!board.canManage) return e.preventDefault()
  draggingColumn.value = col
  menuFor.value = null
  e.dataTransfer?.setData('text/plain', col.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onColumnDragEnd() {
  draggingColumn.value = null
  columnDropIndex.value = null
}

function onColumnDragOver(e: DragEvent, ci: number) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  columnDropIndex.value = ci + (e.clientX > r.left + r.width / 2 ? 1 : 0)
}

async function onColumnDrop() {
  const col = draggingColumn.value
  const to = columnDropIndex.value
  onColumnDragEnd()
  if (!col || to === null) return
  try {
    await board.moveColumn(col.id, to)
  } catch {
    toast.error(tr('board.moveColumnFailed'))
  }
}

/** Whether dropping at the current spot would actually move the dragged column. */
function columnDropMoves(index: number): boolean {
  const from = board.columns.findIndex((c) => c.id === draggingColumn.value?.id)
  return columnDropIndex.value === index && index !== from && index !== from + 1
}

// --- horizontal scrolling -------------------------------------------------------

const scroller = ref<HTMLElement | null>(null)
const row = ref<HTMLElement | null>(null)

/*
 * A slim scrollbar of our own, drawn in the page's bottom padding under the
 * board (the native one is hidden). It shows while the board moves —
 * scrolling, panning, dragging a card or column — or while hovered.
 */
const MIN_THUMB = 40
const metrics = ref({ client: 0, scroll: 0, left: 0 })
const scrolling = ref(false)
const thumbDragging = ref(false)
const trackHover = ref(false)
let scrollTimer: number | undefined

const overflowing = computed(() => metrics.value.scroll > metrics.value.client + 1)
const thumbWidth = computed(() => {
  const m = metrics.value
  return m.scroll ? Math.max(MIN_THUMB, (m.client / m.scroll) * m.client) : 0
})
const thumbLeft = computed(() => {
  const m = metrics.value
  const range = m.scroll - m.client
  return range > 0 ? (m.left / range) * (m.client - thumbWidth.value) : 0
})
const scrollbarVisible = computed(
  () => scrolling.value || panning.value || thumbDragging.value || trackHover.value || !!dragging.value || !!draggingColumn.value,
)

function measure() {
  const el = scroller.value
  if (el)
    metrics.value = {
      client: el.clientWidth,
      scroll: el.scrollWidth,
      left: el.scrollLeft,
    }
}

function onScroll() {
  measure()
  scrolling.value = true
  window.clearTimeout(scrollTimer)
  scrollTimer = window.setTimeout(() => (scrolling.value = false), 900)
}

let thumbFromX = 0
let thumbFromScroll = 0

function onThumbDown(e: PointerEvent) {
  e.preventDefault()
  thumbDragging.value = true
  thumbFromX = e.clientX
  thumbFromScroll = scroller.value?.scrollLeft ?? 0
  window.addEventListener('pointermove', onThumbMove)
  window.addEventListener('pointerup', onThumbUp, { once: true })
}

function onThumbMove(e: PointerEvent) {
  const el = scroller.value
  const m = metrics.value
  const free = m.client - thumbWidth.value
  if (el && free > 0) el.scrollLeft = thumbFromScroll + ((e.clientX - thumbFromX) * (m.scroll - m.client)) / free
}

function onThumbUp() {
  thumbDragging.value = false
  window.removeEventListener('pointermove', onThumbMove)
}

/** Clicking the track jumps the thumb there. */
function onTrackDown(e: PointerEvent) {
  const el = scroller.value
  if (!el || (e.target as HTMLElement).dataset.thumb !== undefined) return
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const m = metrics.value
  const at = (e.clientX - r.left - thumbWidth.value / 2) / (m.client - thumbWidth.value)
  el.scrollTo({
    left: Math.max(0, Math.min(1, at)) * (m.scroll - m.client),
    behavior: 'smooth',
  })
}

let resizeObserver: ResizeObserver | undefined
onMounted(() => {
  resizeObserver = new ResizeObserver(measure)
  if (scroller.value) resizeObserver.observe(scroller.value)
  if (row.value) resizeObserver.observe(row.value)
  measure()
})
watch(
  () => board.columns.length,
  () => nextTick(measure),
)
const EDGE = 96
const MAX_STEP = 24

/** While a card or column is dragged near the board's left or right edge, scroll that way. */
function onBoardDragOver(e: DragEvent) {
  const el = scroller.value
  if ((!dragging.value && !draggingColumn.value) || !el) return
  const r = el.getBoundingClientRect()
  if (e.clientX < r.left + EDGE) el.scrollLeft -= Math.ceil(((r.left + EDGE - e.clientX) / EDGE) * MAX_STEP)
  else if (e.clientX > r.right - EDGE) el.scrollLeft += Math.ceil(((e.clientX - (r.right - EDGE)) / EDGE) * MAX_STEP)
}

/** Grab an empty part of the board and drag sideways to scroll it. */
const panning = ref(false)
let panFromX = 0
let panFromScroll = 0

function onPanStart(e: PointerEvent) {
  const target = e.target as HTMLElement
  if (
    e.button !== 0 ||
    e.pointerType === 'touch' ||
    target.closest('[data-card], [data-column-handle], [data-scrollbar], button, a, input, [data-column-menu]')
  )
    return
  const el = scroller.value
  if (!el || el.scrollWidth <= el.clientWidth) return
  panning.value = true
  panFromX = e.clientX
  panFromScroll = el.scrollLeft
  window.addEventListener('pointermove', onPanMove)
  window.addEventListener('pointerup', onPanEnd, { once: true })
}

function onPanMove(e: PointerEvent) {
  if (scroller.value) scroller.value.scrollLeft = panFromScroll - (e.clientX - panFromX)
}

function onPanEnd() {
  panning.value = false
  window.removeEventListener('pointermove', onPanMove)
}

async function onDrop(e: DragEvent, col: BoardColumn) {
  e.preventDefault()
  if (draggingColumn.value) return onColumnDrop()
  const task = dragging.value
  const at = dropAt.value
  onDragEnd()
  if (!task || !at || at.columnId !== col.id) return
  try {
    await board.moveTask(task.id, col.id, at.index)
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : tr('board.moveTaskFailed'))
  }
}

/** Visible cards of a column, without the one being dragged out of it. */
function cardsOf(col: Lane): Task[] {
  return dropAt.value?.columnId === col.id ? col.tasks.filter((t) => t.id !== dragging.value?.id) : col.tasks
}

// --- renaming in place ----------------------------------------------------------

const renamingId = ref<string | null>(null)
const renameValue = ref('')
const renameInput = ref<HTMLInputElement[]>([])

async function startRename(col: BoardColumn) {
  if (!board.canManage) return
  renamingId.value = col.id
  renameValue.value = col.name
  menuFor.value = null
  await nextTick()
  renameInput.value[0]?.focus()
  renameInput.value[0]?.select()
}

async function finishRename(col: BoardColumn) {
  if (renamingId.value !== col.id) return
  renamingId.value = null
  const name = renameValue.value.trim()
  if (!name || name === col.name) return
  const previous = col.name
  col.name = name
  try {
    await board.updateColumn(col.id, { name, category_id: col.category_id })
  } catch (error) {
    col.name = previous
    toast.error(error instanceof ApiRequestError ? error.message : tr('board.renameFailed'))
  }
}

function cancelRename() {
  renamingId.value = null
}

// --- column menu --------------------------------------------------------------

const menuFor = ref<string | null>(null)
const editing = ref<BoardColumn | null>(null)
const adding = ref(false)
const removing = ref<BoardColumn | null>(null)
const removeBusy = ref(false)

function onDocPointer(e: PointerEvent) {
  if (!(e.target as HTMLElement).closest('[data-column-menu]')) menuFor.value = null
}
document.addEventListener('pointerdown', onDocPointer)
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer)
  window.removeEventListener('pointermove', onPanMove)
  window.removeEventListener('pointermove', onThumbMove)
  window.clearTimeout(scrollTimer)
  resizeObserver?.disconnect()
})

function openEdit(col: BoardColumn) {
  editing.value = col
  menuFor.value = null
}

/** What deleting the column does: nothing to its tasks when it's empty, else they move. */
const removeDescription = computed(() => {
  const col = removing.value
  if (!col?.tasks?.length) return tr('board.emptyColumn')
  const n = col.tasks.length
  return tr('board.tasksMove', { n, status: columnName(col.category_name || col.name) }, n)
})

function openRemove(col: BoardColumn) {
  removing.value = col
  menuFor.value = null
}

async function shift(col: BoardColumn, step: -1 | 1) {
  menuFor.value = null
  try {
    await board.shiftColumn(col.id, step)
  } catch {
    toast.error(tr('board.moveColumnFailed'))
  }
}

async function remove() {
  if (!removing.value) return
  removeBusy.value = true
  try {
    await board.deleteColumn(removing.value.id)
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : tr('board.deleteFailed'))
  } finally {
    removeBusy.value = false
    removing.value = null
  }
}

/** Labels shown on a card; the rest fold into a "+N" chip. */
const CARD_LABELS = 2

function foldedLabelNames(t: Task): string {
  return t.labels
    .slice(CARD_LABELS)
    .map((l) => l.name)
    .join(', ')
}
</script>

<template>
  <!-- Fills the page's height; the scrollbar sits in the page's bottom padding below it. -->
  <div class="relative flex min-h-0 flex-1 flex-col">
    <div
      ref="scroller"
      class="no-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-hidden"
      :class="panning ? 'cursor-grabbing select-none' : ''"
      @scroll="onScroll"
      @dragover="onBoardDragOver"
      @pointerdown="onPanStart"
    >
      <div ref="row" class="flex h-full w-max items-stretch gap-3" :class="board.isLoading ? 'opacity-60' : ''">
        <template v-for="(col, ci) in board.columns" :key="col.id">
          <!-- where a dragged column would land -->
          <div
            v-if="draggingColumn && columnDropMoves(ci)"
            class="w-72 shrink-0 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50"
            aria-hidden="true"
            @dragover.prevent
            @drop.prevent="onColumnDrop"
          />
          <section
            class="flex w-72 shrink-0 flex-col rounded-xl bg-neutral-100/70 transition-colors"
            :class="
              draggingColumn?.id === col.id || (dragging && !canDrop(col))
                ? 'opacity-40'
                : dropAt?.columnId === col.id
                  ? 'bg-neutral-200/70'
                  : ''
            "
            :aria-label="col.name"
            data-column
            @dragover="onDragOver($event, col, ci)"
            @dragleave="onDragLeave($event, col)"
            @drop="onDrop($event, col)"
          >
            <header
              class="flex items-center gap-2 rounded-t-xl px-3 pt-3 pb-2"
              :class="board.canManage ? 'cursor-grab active:cursor-grabbing' : ''"
              :draggable="board.canManage && renamingId !== col.id"
              data-column-handle
              :title="board.canManage && renamingId !== col.id ? $t('board.dragToMove', { name: col.name }) : undefined"
              @dragstart="onColumnDragStart($event, col)"
              @dragend="onColumnDragEnd"
            >
              <span class="h-2 w-2 shrink-0 rounded-full" :class="STATUS_DOT[col.category]" :title="columnName(col.category_name || col.name)" />
              <input
                v-if="renamingId === col.id"
                ref="renameInput"
                v-model="renameValue"
                type="text"
                maxlength="60"
                :aria-label="$t('board.rename', { name: col.name })"
                class="-my-1 min-w-0 flex-1 rounded-md border border-neutral-900 bg-white px-1.5 py-0.5 text-sm font-semibold text-neutral-900 ring-2 ring-neutral-900/10 focus:outline-none"
                @keydown.enter.prevent="finishRename(col)"
                @keydown.esc.stop.prevent="cancelRename"
                @blur="finishRename(col)"
              />
              <h3
                v-else
                class="-mx-1 min-w-0 flex-1 truncate rounded-md px-1 text-sm font-semibold text-neutral-900"
                :class="board.canManage ? 'cursor-text transition-colors hover:bg-neutral-200/70' : ''"
                :title="board.canManage ? $t('board.clickToRename') : undefined"
                @click="startRename(col)"
              >
                {{ columnName(col.name) }}
              </h3>
              <span class="text-xs text-neutral-500">{{ col.tasks.length }}</span>
              <div v-if="board.canManage" class="relative" data-column-menu>
                <button
                  type="button"
                  class="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-200 hover:text-neutral-900"
                  :aria-label="`${col.name} column options`"
                  :aria-expanded="menuFor === col.id"
                  @click="menuFor = menuFor === col.id ? null : col.id"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="19" cy="12" r="1.6" />
                  </svg>
                </button>
                <div
                  v-if="menuFor === col.id"
                  class="animate-pop-down absolute top-full right-0 z-20 mt-1 w-44 rounded-lg border border-neutral-200 bg-white p-1 text-sm shadow-lg shadow-neutral-900/10"
                >
                  <button
                    type="button"
                    class="w-full rounded-md px-2.5 py-1.5 text-left text-neutral-700 hover:bg-neutral-100"
                    @click="openEdit(col)"
                  >
                    {{ $t('board.edit') }}
                  </button>
                  <button
                    v-if="ci > 0"
                    type="button"
                    class="w-full rounded-md px-2.5 py-1.5 text-left text-neutral-700 hover:bg-neutral-100"
                    @click="shift(col, -1)"
                  >
                    {{ $t('board.moveLeft') }}
                  </button>
                  <button
                    v-if="ci < board.columns.length - 1"
                    type="button"
                    class="w-full rounded-md px-2.5 py-1.5 text-left text-neutral-700 hover:bg-neutral-100"
                    @click="shift(col, 1)"
                  >
                    {{ $t('board.moveRight') }}
                  </button>
                  <button
                    type="button"
                    class="w-full rounded-md px-2.5 py-1.5 text-left text-red-600 hover:bg-red-50"
                    @click="openRemove(col)"
                  >
                    {{ $t('board.delete') }}
                  </button>
                </div>
              </div>
            </header>

            <div class="min-h-0 flex-1 overflow-y-auto">
              <ol class="flex flex-col gap-2 px-2 pb-2">
                <template v-for="(t, i) in cardsOf(col)" :key="t.id">
                  <li
                    v-if="dropAt?.columnId === col.id && dropAt.index === i"
                    class="rounded-lg border-2 border-dashed border-neutral-300 bg-white/60"
                    :style="{ height: `${draggedHeight}px` }"
                    aria-hidden="true"
                  />
                  <li
                    :data-card="t.id"
                    draggable="true"
                    class="group relative cursor-grab rounded-lg bg-white shadow-xs transition-shadow hover:shadow-sm active:cursor-grabbing"
                    :class="[dragging?.id === t.id ? 'opacity-40' : '', 'ring-1 ring-neutral-200']"
                    @dragstart="onDragStart($event, t)"
                    @dragend="onDragEnd"
                  >
                    <RouterLink :to="{ name: 'task-detail', params: { id: t.id } }" class="block p-3" draggable="false">
                      <!-- two lines at most; the whole title is on hover and on the task's page -->
                      <p class="line-clamp-2 text-sm font-medium break-words text-neutral-900" :class="t.can_edit ? 'pr-6' : ''" :title="t.title">
                        {{ t.title }}
                      </p>
                      <!-- the project first, then the labels -->
                      <div v-if="t.labels.length || (t.project && !hideProject)" class="mt-1.5 flex flex-wrap gap-1">
                        <span
                          v-if="t.project && !hideProject"
                          class="inline-flex max-w-full items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-px text-[10px] leading-4 font-medium text-neutral-600 ring-1 ring-neutral-200 ring-inset"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3 shrink-0 text-neutral-400" aria-hidden="true">
                            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                          </svg>
                          <span class="truncate">{{ t.project.name }}</span>
                        </span>
                        <LabelChip v-for="l in t.labels.slice(0, CARD_LABELS)" :key="l.id" :name="l.name" :color="l.color" size="xs" />
                        <span
                          v-if="t.labels.length > CARD_LABELS"
                          class="inline-flex items-center rounded-md bg-white px-1.5 py-px text-[10px] leading-4 font-medium text-neutral-500 ring-1 ring-neutral-200 ring-inset"
                          :title="foldedLabelNames(t)"
                          :aria-label="$t('board.moreLabels', { names: foldedLabelNames(t) })"
                        >
                          +{{ t.labels.length - CARD_LABELS }}
                        </span>
                      </div>
                      <div class="mt-2 flex items-center justify-between gap-2 text-xs text-neutral-500">
                        <!-- the priority on the left, a grey dash when there's none; the due date and people on the right -->
                        <PriorityIcon :priority="t.priority" show-none />
                        <span class="flex min-w-0 items-center gap-2">
                          <span v-if="t.due_on" class="truncate" :class="open(t) && isOverdue(t.due_on) ? 'font-medium text-red-600' : ''">
                            {{ formatDate(t.due_on) }}
                          </span>
                          <AvatarStack :people="t.participants" />
                        </span>
                      </div>
                    </RouterLink>
                    <button
                      v-if="t.can_edit"
                      type="button"
                      draggable="false"
                      class="absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-white text-neutral-400 opacity-0 transition hover:bg-neutral-100 hover:text-neutral-900 focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                      :aria-label="$t('board.editTaskNamed', { title: t.title })"
                      :title="$t('board.editTask')"
                      @click="editingTask = t"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                  </li>
                </template>
                <li
                  v-if="dropAt?.columnId === col.id && dropAt.index >= cardsOf(col).length"
                  class="rounded-lg border-2 border-dashed border-neutral-300 bg-white/60"
                  :style="{ height: `${draggedHeight}px` }"
                  aria-hidden="true"
                />
              </ol>

              <button
                v-if="canCreateIn(col)"
                type="button"
                class="mx-2 mb-2 flex w-[calc(100%-1rem)] items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-neutral-500 transition-colors hover:bg-neutral-200/70 hover:text-neutral-900"
                @click="emit('new-task', col)"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  class="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {{ $t('board.addTask') }}
              </button>
            </div>
          </section>
        </template>
        <div
          v-if="draggingColumn && columnDropMoves(board.columns.length)"
          class="w-72 shrink-0 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50"
          aria-hidden="true"
          @dragover.prevent
          @drop.prevent="onColumnDrop"
        />

        <button
          v-if="board.canManage"
          type="button"
          class="flex h-12 w-72 shrink-0 items-center justify-center gap-1.5 self-start rounded-xl border border-dashed border-neutral-300 py-3 text-sm font-medium text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-900"
          @click="adding = true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            class="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          {{ $t('board.addColumn') }}
        </button>
      </div>
    </div>

    <!-- scrollbar, centred in the page's bottom padding (p-5 / sm:p-8) -->
    <div
      v-if="overflowing"
      class="absolute inset-x-0 top-full mt-1.5 h-2 sm:mt-3"
      data-scrollbar
      @pointerdown="onTrackDown"
      @mouseenter="trackHover = true"
      @mouseleave="trackHover = false"
    >
      <div
        data-thumb
        class="absolute inset-y-0 rounded-full bg-neutral-300 transition-opacity duration-300 hover:bg-neutral-400"
        :class="scrollbarVisible ? 'opacity-100' : 'opacity-0'"
        :style="{
          width: `${thumbWidth}px`,
          transform: `translateX(${thumbLeft}px)`,
        }"
        @pointerdown="onThumbDown"
      />
    </div>

    <ColumnFormModal v-if="adding" @close="adding = false" />
    <ColumnFormModal v-if="editing" :column="editing" @close="editing = null" />
    <TaskFormModal v-if="editingTask" :task="editingTask" @close="editingTask = null" @saved="onTaskSaved" />
    <ConfirmDialog
      :open="!!removing"
      :title="$t('board.confirmDelete')"
      :description="removeDescription"
      :loading="removeBusy"
      @update:open="
        (v) => {
          if (!v) removing = null
        }
      "
      @confirm="remove"
    />
  </div>
</template>
