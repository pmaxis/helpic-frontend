<script setup lang="ts">
import type { TaskStatus } from '@/types/tasks'
import { STATUS_BADGE, STATUS_LABELS } from '@/constants/tasks'

defineProps<{
  /** The category, which picks the colour. */
  status: TaskStatus
  /** The exact status name (board column); falls back to the category's label. */
  name?: string
}>()
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset"
    :class="STATUS_BADGE[status]"
  >
    {{ name || STATUS_LABELS[status] }}
  </span>
</template>
