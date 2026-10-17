<script setup lang="ts">
/** A task's discussion and its history, as two tabs under the description. */
import { ref } from 'vue'
import TaskComments from '@/components/tasks/TaskComments.vue'
import TaskHistory from '@/components/tasks/TaskHistory.vue'

defineProps<{
  taskId: string
  /** The task's updated_at, so the history reloads when the task changes. */
  version?: string
}>()

type Tab = 'comments' | 'history'
const tab = ref<Tab>('comments')
const commentCount = ref(0)
</script>

<template>
  <section class="mt-8 min-w-0" :aria-label="$t('activity.label')">
    <div class="flex items-center gap-4 border-b border-neutral-200" role="tablist" :aria-label="$t('activity.label')">
      <button
        v-for="t in (['comments', 'history'] as const)"
        :id="`activity-tab-${t}`"
        :key="t"
        type="button"
        role="tab"
        :aria-selected="tab === t"
        :aria-controls="`activity-panel-${t}`"
        class="-mb-px border-b-2 pb-2 text-xs font-semibold tracking-wide uppercase transition-colors"
        :class="tab === t ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-700'"
        @click="tab = t"
      >
        {{ t === 'comments' ? $t('activity.comments') : $t('activity.history') }}<span v-if="t === 'comments' && commentCount" class="ml-1.5 font-normal text-neutral-400">{{ commentCount }}</span>
      </button>
    </div>

    <!-- comments stay mounted, so a half-written comment survives a look at the history -->
    <div v-show="tab === 'comments'" id="activity-panel-comments" role="tabpanel" aria-labelledby="activity-tab-comments">
      <TaskComments :task-id="taskId" @count="commentCount = $event" />
    </div>
    <div v-if="tab === 'history'" id="activity-panel-history" role="tabpanel" aria-labelledby="activity-tab-history">
      <TaskHistory :task-id="taskId" :version="version" />
    </div>
  </section>
</template>
