<script setup lang="ts">
/**
 * A tiny line of a few values — one client's months — in the platform's ink,
 * the last point in the accent. An all-zero series lies flat and dashed.
 */
import { computed } from 'vue'

const props = defineProps<{ values: number[] }>()

const W = 100
const H = 32
/** Room at the top and bottom so the end dot isn't clipped. */
const PAD = 4

const max = computed(() => Math.max(...props.values, 0))

const points = computed(() =>
  props.values.map((v, i) => [
    props.values.length > 1 ? (i / (props.values.length - 1)) * W : W / 2,
    max.value ? H - PAD - (v / max.value) * (H - PAD * 2) : H - PAD,
  ]),
)

/** Eases out and in horizontally between points, so it never overshoots. */
const line = computed(() => {
  const p = points.value
  if (!p.length) return ''
  let d = `M${p[0][0]},${p[0][1]}`
  for (let i = 1; i < p.length; i++) {
    const mx = (p[i - 1][0] + p[i][0]) / 2
    d += ` C${mx},${p[i - 1][1]} ${mx},${p[i][1]} ${p[i][0]},${p[i][1]}`
  }
  return d
})

const last = computed(() => points.value[points.value.length - 1])
</script>

<template>
  <div class="relative h-8">
    <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
      <path v-if="max" :d="`${line} L${W},${H} L0,${H} Z`" class="fill-neutral-900" fill-opacity="0.06" />
      <path
        :d="line"
        fill="none"
        :class="max ? 'stroke-neutral-900' : 'stroke-neutral-300'"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
        :stroke-dasharray="max ? undefined : '3 3'"
      />
    </svg>
    <span
      v-if="max && last"
      class="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500 ring-2 ring-white"
      :style="{ left: `${(last[0] / W) * 100}%`, top: `${(last[1] / H) * 100}%` }"
      aria-hidden="true"
    />
  </div>
</template>
