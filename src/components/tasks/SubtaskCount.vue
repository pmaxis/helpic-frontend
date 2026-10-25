<script setup lang="ts">
/** How many of a task's subtasks are done, as a chip on a card or a row: "2/5". */
defineProps<{ count: { total: number; done: number } }>()
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-px text-[10px] leading-4 font-medium tabular-nums ring-1 ring-inset"
    :class="count.done === count.total ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-white text-neutral-600 ring-neutral-200'"
    :title="$t('subtasks.progress', { done: count.done, total: count.total })"
    :aria-label="$t('subtasks.progress', { done: count.done, total: count.total })"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3 shrink-0" aria-hidden="true">
      <path d="m3 17 2 2 4-4" />
      <path d="m3 7 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </svg>
    {{ count.done }}/{{ count.total }}
  </span>
</template>
