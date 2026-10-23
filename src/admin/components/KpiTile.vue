<script setup lang="ts">
/**
 * One of the headline figures, which also picks the series the trend chart
 * shows: the value for the period, its change against the period before,
 * and the days as a sparkline.
 */
import { computed } from 'vue'
import { compact } from '../chart'
import DeltaBadge from './DeltaBadge.vue'

const props = defineProps<{
  label: string
  value: number
  previous: number
  /** The period day by day (or week by week), oldest first. */
  series: number[]
  selected: boolean
}>()

defineEmits<{ select: [] }>()

/** The sparkline's path in a 100 × 24 box. */
const line = computed(() => {
  const s = props.series
  if (s.length < 2) return ''
  const max = Math.max(...s, 1)
  return s.map((v, i) => `${i ? 'L' : 'M'}${((i / (s.length - 1)) * 100).toFixed(2)},${(22 - (v / max) * 20).toFixed(2)}`).join(' ')
})
</script>

<template>
  <button
    type="button"
    class="group flex min-w-0 flex-col rounded-xl border bg-white p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
    :class="selected ? 'border-neutral-900 shadow-xs' : 'border-neutral-200 hover:border-neutral-300'"
    :aria-pressed="selected"
    @click="$emit('select')"
  >
    <span class="truncate text-xs text-neutral-500">{{ label }}</span>
    <span class="mt-1 flex items-baseline gap-2">
      <span class="text-3xl font-semibold tracking-tight text-neutral-900">{{ compact(value) }}</span>
      <DeltaBadge :now="value" :before="previous" />
    </span>
    <span class="mt-0.5 text-[11px] text-neutral-400">{{ $t('admin.kpi.before', { n: compact(previous) }) }}</span>
    <svg v-if="line" viewBox="0 0 100 24" preserveAspectRatio="none" class="mt-3 h-6 w-full overflow-visible" aria-hidden="true">
      <path
        :d="line"
        fill="none"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
        :class="selected ? 'stroke-neutral-900' : 'stroke-neutral-300 group-hover:stroke-neutral-400'"
      />
    </svg>
  </button>
</template>
