<script setup lang="ts">
/**
 * The task's details card: where it stands, when and for how much, and who
 * is on it, with when it was created and last changed.
 */
import { computed } from 'vue'
import TaskProgressFields from '@/components/tasks/TaskProgressFields.vue'
import TaskScheduleFields from '@/components/tasks/TaskScheduleFields.vue'
import TaskPeople from '@/components/tasks/TaskPeople.vue'
import { useAuthStore } from '@/stores/auth'
import { formatDate } from '@/utils/format'
import type { Task, TaskInput } from '@/types/tasks'

const props = defineProps<{
  task: Task
  saving: boolean
  /** Saves one change to the task; false when it was refused. */
  save: (change: Partial<TaskInput>) => Promise<boolean>
}>()
const emit = defineEmits<{
  /** The task as the server has it after a change here. */
  changed: [task: Task]
  /** Something on the task changed elsewhere: it needs loading again. */
  reload: []
  hide: []
}>()

const auth = useAuthStore()

/** Who created the task: either side, or a member of the client's team. */
const creator = computed(() => (props.task.creator.id ? props.task.creator : null))

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}
</script>

<template>
  <aside aria-labelledby="task-details">
    <div class="flex items-center justify-between gap-2 border-b border-neutral-200 py-3 pr-3 pl-5">
      <h2 id="task-details" class="text-sm font-semibold text-neutral-900">{{ $t('task.details') }}</h2>
      <button
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        :title="$t('task.hideDetails')"
        :aria-label="$t('task.hideDetails')"
        @click="emit('hide')"
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
        <TaskProgressFields :task="task" @changed="emit('changed', $event)" @reload="emit('reload')" />
      </section>
      <section class="px-5 py-4" :aria-label="$t('task.groups.schedule')">
        <h3 class="mb-3 text-xs font-medium tracking-wide text-neutral-400 uppercase" aria-hidden="true">{{ $t('task.groups.schedule') }}</h3>
        <TaskScheduleFields :task="task" :saving="saving" :save="save" @changed="emit('changed', $event)" />
      </section>
      <section class="px-5 py-4" :aria-label="$t('task.groups.people')">
        <h3 class="mb-3 text-xs font-medium tracking-wide text-neutral-400 uppercase" aria-hidden="true">{{ $t('task.groups.people') }}</h3>
        <dl class="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 text-sm">
          <TaskPeople :task="task" @changed="emit('reload')" />

          <dt class="text-neutral-500">{{ $t('task.createdBy') }}</dt>
          <dd class="flex min-w-0 items-center gap-2">
            <template v-if="creator">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-600" aria-hidden="true">
                {{ initials(creator.name || creator.email) }}
              </span>
              <span class="truncate text-neutral-800">{{ creator.id === auth.user?.id ? $t('common.you_capital') : creator.name || creator.email }}</span>
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
</template>
