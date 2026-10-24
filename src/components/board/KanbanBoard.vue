<script setup lang="ts">
/**
 * The Jira-style board a freelancer shares with a client. Its columns are the
 * pair's workflow statuses; dropping a card into a column sets the task's
 * status (native HTML5 drag and drop). A card can only go to a column the
 * user's role allows. The
 * freelancer, or the project's author, manages the columns: reorders them by
 * dragging the header, renames them by clicking the name, and adds, edits and
 * removes them from the header menu. Anyone else only moves cards. A card's
 * pencil button edits the task, for whoever may.
 */
import { computed, ref } from 'vue'
import BoardScroller from '@/components/board/BoardScroller.vue'
import ColumnFormModal from '@/components/board/ColumnFormModal.vue'
import KanbanCard from '@/components/board/KanbanCard.vue'
import KanbanColumnHeader from '@/components/board/KanbanColumnHeader.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useBoardStore } from '@/stores/board'
import { ApiRequestError } from '@/services/api'
import { t as tr } from '@/i18n'
import { toast } from '@/composables/useToasts'
import type { BoardColumn } from '@/types/board'
import type { Task } from '@/types/tasks'

type Lane = BoardColumn & { tasks: Task[] }

withDefaults(defineProps<{ hideProject?: boolean }>(), { hideProject: false })
const emit = defineEmits<{ 'new-task': [column: BoardColumn] }>()

const auth = useAuthStore()
const board = useBoardStore()

/**
 * Whether the user can add a task straight into a column. The freelancer and
 * whoever manages this board may use any column. Everyone else only uses a
 * column that isn't done.
 */
function canCreateIn(col: BoardColumn): boolean {
  // An all-board lane spans several boards, so it can't say which one a new task is for.
  if (board.merged) return false
  return auth.isFreelancer || board.canManage || col.participants_can_move
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

/** A card may stay in its bucket, or enter a column this person is allowed to. */
function canDrop(col: BoardColumn): boolean {
  const task = dragging.value
  if (!task) return false
  if (board.merged) return task.status === col.category || task.next_statuses.includes(col.category)
  const from = board.columns.find((c) => c.id === task.status_id)
  if (from && from.category === col.category) return true
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

// --- moving columns -------------------------------------------------------------

const draggingColumn = ref<BoardColumn | null>(null)
/** Where the dragged column would land: before the column at this index (length = at the end). */
const columnDropIndex = ref<number | null>(null)

function onColumnDragStart(e: DragEvent, col: BoardColumn) {
  if (!board.canManage) return e.preventDefault()
  draggingColumn.value = col
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

// --- what the header does -----------------------------------------------------------

/** Shows the new name at once, and the old one again if it's refused. */
async function rename(col: BoardColumn, name: string) {
  const previous = col.name
  col.name = name
  try {
    await board.updateColumn(col.id, { name })
  } catch (error) {
    col.name = previous
    toast.error(error instanceof ApiRequestError ? error.message : tr('board.renameFailed'))
  }
}

async function shift(col: BoardColumn, step: -1 | 1) {
  try {
    await board.shiftColumn(col.id, step)
  } catch {
    toast.error(tr('board.moveColumnFailed'))
  }
}

const editing = ref<BoardColumn | null>(null)
const adding = ref(false)
const removing = ref<BoardColumn | null>(null)
const removeBusy = ref(false)

/** What deleting the column does: nothing to its tasks when it's empty, else they move. */
const removeDescription = computed(() => {
  const col = removing.value
  if (!col?.tasks?.length) return tr('board.emptyColumn')
  const key = col.status_category === 'in_progress' ? 'inProgress' : col.status_category === 'todo' ? 'todo' : 'done'
  return tr('board.tasksMove', { n: col.tasks.length, status: tr(`columnForm.${key}`) }, col.tasks.length)
})

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
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <BoardScroller :dragging="!!dragging || !!draggingColumn">
      <div class="flex h-full w-max min-w-full items-stretch gap-3" :class="board.isLoading ? 'opacity-60' : ''">
        <template v-for="(col, ci) in board.columns" :key="col.id">
          <!-- where a dragged column would land -->
          <div
            v-if="draggingColumn && columnDropMoves(ci)"
            class="w-72 max-w-lg shrink-0 grow rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50"
            aria-hidden="true"
            @dragover.prevent
            @drop.prevent="onColumnDrop"
          />
          <section
            class="flex w-72 max-w-lg shrink-0 grow flex-col rounded-xl bg-neutral-100/70 transition-colors"
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
            <KanbanColumnHeader
              :column="col"
              :count="col.tasks.length"
              :can-manage="board.canManage"
              :can-move-left="ci > 0"
              :can-move-right="ci < board.columns.length - 1"
              @dragstart="onColumnDragStart($event, col)"
              @dragend="onColumnDragEnd"
              @rename="rename(col, $event)"
              @edit="editing = col"
              @shift="shift(col, $event)"
              @remove="removing = col"
            />

            <div class="min-h-0 flex-1 overflow-y-auto">
              <ol class="flex flex-col gap-2 px-2 pb-2">
                <template v-for="(t, i) in cardsOf(col)" :key="t.id">
                  <li
                    v-if="dropAt?.columnId === col.id && dropAt.index === i"
                    class="rounded-lg border-2 border-dashed border-neutral-300 bg-white/60"
                    :style="{ height: `${draggedHeight}px` }"
                    aria-hidden="true"
                  />
                  <KanbanCard
                    :task="t"
                    :hide-project="hideProject"
                    :dragging="dragging?.id === t.id"
                    @dragstart="onDragStart($event, t)"
                    @dragend="onDragEnd"
                    @edit="editingTask = t"
                  />
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-4 w-4" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {{ $t('board.addTask') }}
              </button>
            </div>
          </section>
        </template>
        <div
          v-if="draggingColumn && columnDropMoves(board.columns.length)"
          class="w-72 max-w-lg shrink-0 grow rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50"
          aria-hidden="true"
          @dragover.prevent
          @drop.prevent="onColumnDrop"
        />

        <button
          v-if="board.canManage"
          type="button"
          class="flex h-12 w-72 max-w-lg shrink-0 grow items-center justify-center gap-1.5 self-start rounded-xl border border-dashed border-neutral-300 py-3 text-sm font-medium text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-900"
          @click="adding = true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-4 w-4" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {{ $t('board.addColumn') }}
        </button>
      </div>
    </BoardScroller>

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
