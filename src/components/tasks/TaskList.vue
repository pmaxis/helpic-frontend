<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import StatusBadge from '@/components/tasks/StatusBadge.vue'
import TaskFormModal from '@/components/tasks/TaskFormModal.vue'
import PriorityIcon from '@/components/tasks/PriorityIcon.vue'
import LabelChip from '@/components/tasks/LabelChip.vue'
import AvatarStack from '@/components/tasks/AvatarStack.vue'
import { formatDate, isOverdue } from '@/utils/format'
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

/** The task being edited from its row's pencil button. */
const editing = ref<Task | null>(null)

function onSaved(t: Task) {
  editing.value = null
  emit('saved', t)
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
  <div class="overflow-hidden rounded-xl border border-neutral-200" :class="loading ? 'opacity-60' : ''">
    <!-- the last, unnamed column holds the row's edit button -->
    <div class="hidden border-b border-neutral-200 bg-neutral-50 pr-10 md:block" aria-hidden="true">
      <div class="grid gap-4 px-4 py-2 text-xs font-medium tracking-wide text-neutral-500 uppercase" :class="grid">
        <span>{{ $t('taskList.task') }}</span>
        <span>{{ $t('taskList.status') }}</span>
        <span v-if="!hideProject">{{ $t('taskList.project') }}</span>
        <span>{{ $t('taskList.people') }}</span>
        <span class="text-right">{{ $t('taskList.due') }}</span>
      </div>
    </div>

    <ul class="divide-y divide-neutral-100">
      <li v-for="t in tasks" :key="t.id" class="group flex items-center transition-colors hover:bg-neutral-50">
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
            </div>
            <p v-if="summary(t)" class="mt-0.5 truncate text-xs text-neutral-500">{{ summary(t) }}</p>
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
          <button
            v-if="t.can_edit"
            type="button"
            class="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition hover:bg-neutral-200/70 hover:text-neutral-900 focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            :aria-label="$t('taskList.editNamed', { title: t.title })"
            :title="$t('taskList.edit')"
            @click="editing = t"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        </div>
      </li>
    </ul>

    <TaskFormModal v-if="editing" :task="editing" @close="editing = null" @saved="onSaved" />
  </div>
</template>
