<script setup lang="ts">
/**
 * The freelancer's running timer, wherever they are: its clock, the task it
 * runs on (a link to it) and a stop button. Nothing shows while no timer
 * runs. Compact — the folded sidebar, the phone header — it's the clock and
 * the stop button alone.
 */
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useTimerStore } from '@/stores/timer'
import { ApiRequestError } from '@/services/api'
import { formatClock } from '@/utils/format'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'

defineProps<{ compact?: boolean }>()
const emit = defineEmits<{ navigate: [] }>()

const timer = useTimerStore()
const stopping = ref(false)

async function stop() {
  if (stopping.value) return
  stopping.value = true
  try {
    await timer.stop()
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('timelog.stopFailed'))
  } finally {
    stopping.value = false
  }
}
</script>

<template>
  <div v-if="timer.running" role="status" :aria-label="$t('timelog.running')">
    <button
      v-if="compact"
      type="button"
      :disabled="stopping"
      :title="`${timer.running.task_title} · ${$t('timelog.stopTimer')}`"
      class="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-2 py-1 text-xs font-medium tabular-nums text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
      @click="stop"
    >
      <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
      {{ formatClock(timer.elapsed) }}
      <svg viewBox="0 0 24 24" fill="currentColor" class="h-2.5 w-2.5" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
    </button>
    <div v-else class="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-2">
      <span class="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold tabular-nums text-neutral-900">{{ formatClock(timer.elapsed) }}</p>
        <RouterLink
          :to="{ name: 'task-detail', params: { id: timer.running.task_id } }"
          :title="$t('timelog.openTask')"
          class="block truncate text-xs text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
          @click="emit('navigate')"
        >
          {{ timer.running.task_title }}
        </RouterLink>
      </div>
      <button
        type="button"
        :disabled="stopping"
        :title="$t('timelog.stopTimer')"
        :aria-label="$t('timelog.stopTimer')"
        class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
        @click="stop"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" class="h-3 w-3" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
      </button>
    </div>
  </div>
</template>
