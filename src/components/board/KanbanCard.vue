<script setup lang="ts">
/**
 * A task on the board: its title, project and labels, priority, due date and
 * people. The whole card opens the task and drags it (the board listens for
 * the drag); a pencil button edits it and a bin deletes it, for whoever may.
 */
import { RouterLink } from 'vue-router'
import PriorityIcon from '@/components/tasks/PriorityIcon.vue'
import LabelChip from '@/components/tasks/LabelChip.vue'
import AvatarStack from '@/components/tasks/AvatarStack.vue'
import { formatDate, isOverdue } from '@/utils/format'
import type { Task } from '@/types/tasks'

defineProps<{
  task: Task
  hideProject: boolean
  /** This card is the one being dragged. */
  dragging: boolean
}>()
const emit = defineEmits<{ edit: []; delete: [] }>()

/** Labels shown on a card; the rest fold into a "+N" chip. */
const CARD_LABELS = 2

function foldedLabelNames(t: Task): string {
  return t.labels
    .slice(CARD_LABELS)
    .map((l) => l.name)
    .join(', ')
}

function open(t: Task) {
  return t.status === 'new' || t.status === 'in_progress'
}
</script>

<template>
  <li
    :data-card="task.id"
    draggable="true"
    class="group relative cursor-grab rounded-lg bg-white shadow-xs transition-shadow hover:shadow-sm active:cursor-grabbing"
    :class="[dragging ? 'opacity-40' : '', 'ring-1 ring-neutral-200']"
  >
    <RouterLink :to="{ name: 'task-detail', params: { id: task.id } }" class="block p-3" draggable="false">
      <!-- two lines at most; the whole title is on hover and on the task's page -->
      <p class="line-clamp-2 text-sm font-medium break-words text-neutral-900" :class="task.can_edit && task.can_delete ? 'pr-12' : task.can_edit || task.can_delete ? 'pr-6' : ''" :title="task.title">
        {{ task.title }}
      </p>
      <!-- the project first, then the labels -->
      <div v-if="task.labels.length || (task.project && !hideProject)" class="mt-1.5 flex flex-wrap gap-1">
        <span
          v-if="task.project && !hideProject"
          class="inline-flex max-w-full items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-px text-[10px] leading-4 font-medium text-neutral-600 ring-1 ring-neutral-200 ring-inset"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3 shrink-0 text-neutral-400" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          <span class="truncate">{{ task.project.name }}</span>
        </span>
        <LabelChip v-for="l in task.labels.slice(0, CARD_LABELS)" :key="l.id" :name="l.name" :color="l.color" size="xs" />
        <span
          v-if="task.labels.length > CARD_LABELS"
          class="inline-flex items-center rounded-md bg-white px-1.5 py-px text-[10px] leading-4 font-medium text-neutral-500 ring-1 ring-neutral-200 ring-inset"
          :title="foldedLabelNames(task)"
          :aria-label="$t('board.moreLabels', { names: foldedLabelNames(task) })"
        >
          +{{ task.labels.length - CARD_LABELS }}
        </span>
      </div>
      <div class="mt-2 flex items-center justify-between gap-2 text-xs text-neutral-500">
        <!-- the priority on the left, a grey dash when there's none; the due date and people on the right -->
        <PriorityIcon :priority="task.priority" show-none />
        <span class="flex min-w-0 items-center gap-2">
          <span v-if="task.due_on" class="truncate" :class="open(task) && isOverdue(task.due_on) ? 'font-medium text-red-600' : ''">
            {{ formatDate(task.due_on) }}
          </span>
          <AvatarStack :people="task.participants" />
        </span>
      </div>
    </RouterLink>
    <!-- shown on hover, or always where there's no hover -->
    <div
      v-if="task.can_edit || task.can_delete"
      class="absolute top-2 right-2 flex gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
    >
      <button
        v-if="task.can_edit"
        type="button"
        draggable="false"
        class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
        :aria-label="$t('board.editTaskNamed', { title: task.title })"
        :title="$t('board.editTask')"
        @click="emit('edit')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button
        v-if="task.can_delete"
        type="button"
        draggable="false"
        class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
        :aria-label="$t('board.deleteTaskNamed', { title: task.title })"
        :title="$t('board.deleteTask')"
        @click="emit('delete')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true">
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  </li>
</template>
