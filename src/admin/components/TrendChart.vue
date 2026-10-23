<script setup lang="ts">
/**
 * One measure over the period as a line with a faint area under it, and the
 * period before as a dashed gray line to compare with. Hovering or focusing
 * a point shows both values; a hidden table carries the same numbers for
 * screen readers.
 *
 * The SVG stretches to the box (lines keep their width); the axis labels,
 * dots, hit areas and tooltip are HTML on top, placed by percentages.
 */
import { computed, ref } from 'vue'
import { compact, niceTicks } from '../chart'

export interface TrendPoint {
  key: string
  /** Under the axis, e.g. "15 Oct". */
  label: string
  /** In the tooltip: the day, or the week's days. */
  title: string
  /** The same point of the period before. */
  previousTitle: string
  current: number
  previous: number
}

const props = defineProps<{
  points: TrendPoint[]
  /** What the chart is, for screen readers and the table. */
  label: string
  currentName: string
  previousName: string
  emptyText: string
}>()

const W = 600
const H = 200

const max = computed(() => Math.max(...props.points.flatMap((p) => [p.current, p.previous]), 0))
const ticks = computed(() => niceTicks(max.value))
const top = computed(() => ticks.value[ticks.value.length - 1])

function x(i: number): number {
  return props.points.length > 1 ? (i / (props.points.length - 1)) * 100 : 50
}
function y(v: number): number {
  return 100 - (v / top.value) * 100
}

function path(key: 'current' | 'previous'): string {
  return props.points.map((p, i) => `${i ? 'L' : 'M'}${(x(i) / 100) * W},${(y(p[key]) / 100) * H}`).join(' ')
}
const currentLine = computed(() => path('current'))
const previousLine = computed(() => path('previous'))
const area = computed(() => (props.points.length ? `${currentLine.value} L${W},${H} L0,${H} Z` : ''))

/** About six labels under the axis, the last point always among them. */
const labelled = computed(() => {
  const n = props.points.length
  const step = Math.max(1, Math.ceil(n / 6))
  return new Set(props.points.filter((_, i) => (n - 1 - i) % step === 0).map((p) => p.key))
})

const active = ref<number | null>(null)
const activePoint = computed(() => (active.value === null ? null : { ...props.points[active.value], x: x(active.value) }))
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- the legend: two series, so identity never rests on color alone -->
    <div class="flex items-center gap-4 text-xs text-neutral-500" aria-hidden="true">
      <span class="inline-flex items-center gap-1.5"><span class="h-0.5 w-4 rounded-full bg-neutral-900" />{{ currentName }}</span>
      <span class="inline-flex items-center gap-1.5"><span class="w-4 border-t-2 border-dashed border-neutral-400" />{{ previousName }}</span>
    </div>

    <div class="mt-4 flex min-h-0 flex-1 gap-3">
      <!-- y-axis ticks -->
      <div class="relative w-8 shrink-0 text-right text-[11px] text-neutral-400 tabular-nums" aria-hidden="true">
        <span v-for="t in ticks" :key="t" class="absolute right-0 -translate-y-1/2" :style="{ top: `${y(t)}%` }">{{ compact(t) }}</span>
      </div>

      <div class="relative min-w-0 flex-1">
        <!-- the grid: hairlines at the ticks -->
        <div class="absolute inset-0" aria-hidden="true">
          <span
            v-for="t in ticks"
            :key="t"
            class="absolute inset-x-0 border-t"
            :class="t === 0 ? 'border-neutral-300' : 'border-neutral-200/70'"
            :style="{ top: `${y(t)}%` }"
          />
        </div>

        <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <path v-if="max" :d="area" class="fill-neutral-900" fill-opacity="0.06" />
          <path :d="previousLine" fill="none" class="stroke-neutral-400" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
          <path :d="currentLine" fill="none" class="stroke-neutral-900" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
        </svg>

        <p v-if="!max" class="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">{{ emptyText }}</p>

        <!-- the crosshair, both dots and the tooltip on the point in hand -->
        <template v-if="activePoint">
          <span class="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-neutral-300" :style="{ left: `${activePoint.x}%` }" aria-hidden="true" />
          <span
            class="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-400 ring-2 ring-white"
            :style="{ left: `${activePoint.x}%`, top: `${y(activePoint.previous)}%` }"
            aria-hidden="true"
          />
          <span
            class="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-900 ring-2 ring-white"
            :style="{ left: `${activePoint.x}%`, top: `${y(activePoint.current)}%` }"
            aria-hidden="true"
          />
          <div
            class="pointer-events-none absolute top-0 z-10 min-w-40 rounded-lg bg-neutral-900 px-3 py-2 text-xs text-white shadow-lg"
            :class="activePoint.x < 20 ? 'ml-3' : activePoint.x > 80 ? '-ml-3 -translate-x-full' : '-translate-x-1/2'"
            :style="{ left: `${activePoint.x}%` }"
            role="tooltip"
          >
            <div class="flex items-center justify-between gap-4">
              <span class="inline-flex items-center gap-1.5 text-neutral-300"><span class="h-0.5 w-3 rounded-full bg-white" />{{ activePoint.title }}</span>
              <span class="font-semibold tabular-nums">{{ compact(activePoint.current) }}</span>
            </div>
            <div class="mt-1 flex items-center justify-between gap-4">
              <span class="inline-flex items-center gap-1.5 text-neutral-400"><span class="w-3 border-t-2 border-dashed border-neutral-400" />{{ activePoint.previousTitle }}</span>
              <span class="tabular-nums text-neutral-300">{{ compact(activePoint.previous) }}</span>
            </div>
          </div>
        </template>

        <!-- a point's whole column answers the pointer -->
        <div class="absolute inset-0 flex">
          <button
            v-for="(p, i) in points"
            :key="p.key"
            type="button"
            class="h-full flex-1 cursor-default focus:outline-none"
            :aria-label="`${p.title}: ${p.current}; ${p.previousTitle}: ${p.previous}`"
            @mouseenter="active = i"
            @mouseleave="active = null"
            @focus="active = i"
            @blur="active = null"
          />
        </div>
      </div>
    </div>

    <div class="relative mt-2 ml-11 h-4" aria-hidden="true">
      <template v-for="(p, i) in points" :key="p.key">
        <span
          v-if="labelled.has(p.key)"
          class="absolute text-[11px] whitespace-nowrap text-neutral-400"
          :class="i === points.length - 1 ? '-translate-x-full' : i === 0 ? '' : '-translate-x-1/2'"
          :style="{ left: `${x(i)}%` }"
          >{{ p.label }}</span
        >
      </template>
    </div>

    <table class="sr-only">
      <caption>{{ label }}</caption>
      <thead>
        <tr>
          <th scope="col">{{ currentName }}</th>
          <th scope="col">{{ label }}</th>
          <th scope="col">{{ previousName }}</th>
          <th scope="col">{{ label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in points" :key="p.key">
          <th scope="row">{{ p.title }}</th>
          <td>{{ p.current }}</td>
          <td>{{ p.previousTitle }}</td>
          <td>{{ p.previous }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
