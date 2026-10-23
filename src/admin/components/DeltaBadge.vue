<script setup lang="ts">
/** The change against the period before: an arrow and a percent, green up, red down. Nothing when before was zero. */
import { computed } from 'vue'
import { change } from '../chart'

const props = defineProps<{ now: number; before: number }>()
const delta = computed(() => change(props.now, props.before))
</script>

<template>
  <span
    v-if="delta !== null"
    class="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset"
    :class="
      delta > 0
        ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
        : delta < 0
          ? 'bg-red-50 text-red-700 ring-red-600/20'
          : 'bg-neutral-100 text-neutral-600 ring-neutral-500/20'
    "
    :aria-label="$t('admin.kpi.change', { pct: delta })"
  >
    <svg v-if="delta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3" aria-hidden="true">
      <path v-if="delta > 0" d="M7 17 17 7M9 7h8v8" />
      <path v-else d="M7 7l10 10M17 9v8H9" />
    </svg>
    {{ Math.abs(delta) }}%
  </span>
</template>
