<script setup lang="ts">
/** A small ring filled to a percentage, with the number inside; a check once it's full. */
import { computed } from 'vue'

const props = defineProps<{ percent: number }>()

const R = 15
const C = 2 * Math.PI * R
const dash = computed(() => `${(Math.min(Math.max(props.percent, 0), 100) / 100) * C} ${C}`)
</script>

<template>
  <div class="relative h-10 w-10 shrink-0">
    <svg viewBox="0 0 36 36" class="h-full w-full -rotate-90" aria-hidden="true">
      <circle cx="18" cy="18" :r="R" fill="none" class="stroke-emerald-100" stroke-width="3.5" />
      <circle
        v-if="percent > 0"
        cx="18"
        cy="18"
        :r="R"
        fill="none"
        class="stroke-emerald-500"
        stroke-width="3.5"
        stroke-linecap="round"
        :stroke-dasharray="dash"
      />
    </svg>
    <span class="absolute inset-0 flex items-center justify-center">
      <svg
        v-if="percent >= 100"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="h-4 w-4 text-emerald-600"
        aria-hidden="true"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span v-else class="text-[10px] font-semibold text-neutral-700 tabular-nums">{{ percent }}</span>
    </span>
  </div>
</template>
