<script setup lang="ts">
/**
 * A task's discussion, its time (for whoever sees its price) and its history,
 * as tabs under the description.
 */
import { computed, ref, watch } from 'vue'
import TaskComments from '@/components/tasks/TaskComments.vue'
import TaskHistory from '@/components/tasks/TaskHistory.vue'
import TaskTime from '@/components/tasks/TaskTime.vue'
import { formatDuration } from '@/utils/format'

const props = defineProps<{
  taskId: string
  /** The task's updated_at, so the history reloads when the task changes. */
  version?: string
  /** The task is archived: its discussion is closed. */
  readonly?: boolean
  /** The viewer sees the task's time: whoever sees its price. */
  showTime?: boolean
  /** The viewer writes time on it: its freelancer. */
  canTrack?: boolean
  /** On a sent report: its time is billed. */
  billed?: boolean
  /** Bumped when a comment was added beside the discussion (pinned on an image). */
  commentsVersion?: number
}>()
defineEmits<{ timeChanged: [] }>()

type Tab = 'comments' | 'time' | 'history'
const tabs = computed<Tab[]>(() => (props.showTime ? ['comments', 'time', 'history'] : ['comments', 'history']))
const tab = ref<Tab>('comments')
watch(tabs, (list) => {
  if (!list.includes(tab.value)) tab.value = 'comments'
})
const commentCount = ref(0)
const timeTotal = ref(0)

const LABELS: Record<Tab, string> = { comments: 'activity.comments', time: 'timelog.tab', history: 'activity.history' }
</script>

<template>
  <section class="mt-8 min-w-0" :aria-label="$t('activity.label')">
    <div class="flex items-center gap-4 border-b border-neutral-200" role="tablist" :aria-label="$t('activity.label')">
      <button
        v-for="t in tabs"
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
        {{ $t(LABELS[t]) }}<span v-if="t === 'comments' && commentCount" class="ml-1.5 font-normal text-neutral-400">{{ commentCount }}</span><span
          v-else-if="t === 'time' && timeTotal"
          class="ml-1.5 font-normal normal-case text-neutral-400"
          >{{ formatDuration(timeTotal) }}</span>
      </button>
    </div>

    <!-- comments stay mounted, so a half-written comment survives a look at the history -->
    <div v-show="tab === 'comments'" id="activity-panel-comments" role="tabpanel" aria-labelledby="activity-tab-comments">
      <TaskComments :task-id="taskId" :readonly="readonly" :version="commentsVersion" @count="commentCount = $event" />
    </div>
    <!-- the time stays mounted too: its total shows on the tab -->
    <div v-if="showTime" v-show="tab === 'time'" id="activity-panel-time" role="tabpanel" aria-labelledby="activity-tab-time">
      <TaskTime :task-id="taskId" :can-track="canTrack" :billed="billed" @changed="$emit('timeChanged')" @total="timeTotal = $event" />
    </div>
    <div v-if="tab === 'history'" id="activity-panel-history" role="tabpanel" aria-labelledby="activity-tab-history">
      <TaskHistory :task-id="taskId" :version="version" />
    </div>
  </section>
</template>
