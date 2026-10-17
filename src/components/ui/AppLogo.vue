<script setup lang="ts">
/**
 * The Helpic logo: the mark — a lowercase h with an emerald dot, the other
 * side of the work and "done" — and, unless `markOnly`, the wordmark
 * "helpic." with the same dot. The same mark is public/favicon.svg.
 */
import { APP_NAME } from '@/config'

withDefaults(defineProps<{ markOnly?: boolean; size?: number }>(), { markOnly: false, size: 32 })
</script>

<template>
  <span class="inline-flex items-center gap-2.5" :aria-label="APP_NAME" role="img">
    <svg :width="size" :height="size" viewBox="0 0 32 32" class="shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#171717" />
      <path d="M10 7.5v17" stroke="#fff" stroke-width="3.6" stroke-linecap="round" />
      <path d="M10 17.2a5.6 5.6 0 0 1 11.2 0v7.3" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" />
      <circle cx="23.4" cy="9.4" r="2.6" fill="#34d399" />
    </svg>
    <span v-if="!markOnly" class="text-[17px] leading-none font-bold tracking-tight text-neutral-900" aria-hidden="true">
      helpic<span class="text-emerald-500">.</span>
    </span>
  </span>
</template>
