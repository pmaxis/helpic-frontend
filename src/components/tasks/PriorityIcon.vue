<script setup lang="ts">
/** A task's priority as a small icon, Jira-style; nothing for "none" unless asked. */
import { PRIORITY_LABELS } from '@/constants/tasks'
import type { TaskPriority } from '@/types/tasks'

withDefaults(defineProps<{ priority: TaskPriority; showNone?: boolean }>(), { showNone: false })
</script>

<template>
  <svg
    v-if="priority !== 'none' || showNone"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="h-3.5 w-3.5 shrink-0"
    :class="{
      'text-red-600': priority === 'urgent',
      'text-orange-500': priority === 'high',
      'text-amber-500': priority === 'medium',
      'text-sky-500': priority === 'low',
      'text-neutral-300': priority === 'none',
    }"
    role="img"
    :aria-label="PRIORITY_LABELS[priority]"
  >
    <title>{{ PRIORITY_LABELS[priority] }}</title>
    <template v-if="priority === 'urgent'">
      <polyline points="4 8.5 8 4.5 12 8.5" />
      <polyline points="4 12.5 8 8.5 12 12.5" />
    </template>
    <polyline v-else-if="priority === 'high'" points="4 10 8 6 12 10" />
    <template v-else-if="priority === 'medium'">
      <line x1="4" y1="6.5" x2="12" y2="6.5" />
      <line x1="4" y1="10" x2="12" y2="10" />
    </template>
    <polyline v-else-if="priority === 'low'" points="4 6 8 10 12 6" />
    <line v-else x1="4" y1="8" x2="12" y2="8" />
  </svg>
</template>
