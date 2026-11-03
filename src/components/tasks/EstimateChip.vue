<script setup lang="ts">
/**
 * An estimate that wants something, as a chip on a card or a row: waiting
 * for the client, or changes they asked for. An approved one, or none, shows
 * nothing.
 */
import { computed } from 'vue'
import { t } from '@/i18n'
import type { TaskEstimate } from '@/types/tasks'

const props = defineProps<{ estimate: TaskEstimate | null }>()

const shown = computed(() => {
  const e = props.estimate
  if (!e || e.outdated || e.status === 'approved') return null
  return e.status === 'pending'
    ? { label: t('estimate.cardPending'), tone: 'bg-amber-50 text-amber-700 ring-amber-200' }
    : { label: t('estimate.cardChanges'), tone: 'bg-red-50 text-red-700 ring-red-200' }
})
</script>

<template>
  <span
    v-if="shown"
    class="inline-flex shrink-0 items-center rounded-md px-1 py-px leading-4 ring-1 ring-inset"
    :class="shown.tone"
    :title="shown.label"
    :aria-label="shown.label"
    role="img"
  >
    <!-- a scale: the price weighed -->
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3" aria-hidden="true">
      <path d="M12 3v18" />
      <path d="M7 21h10" />
      <path d="M5 7h14" />
      <path d="m5 7-3 7a3 3 0 0 0 6 0Z" />
      <path d="m19 7-3 7a3 3 0 0 0 6 0Z" />
    </svg>
  </span>
</template>
