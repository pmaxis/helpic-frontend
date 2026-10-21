<script setup lang="ts">
/**
 * What was paid in each of the last months, as a smooth area:
 * the line in the accent, the area fading out under it, a dot on every month
 * and the current one ringed. Hovering or focusing a month shows its amount.
 *
 * The SVG stretches to the box (the line keeps its width); the dots, the hit
 * areas and the tooltip are HTML on top, placed by the same percentages.
 */
import { computed, ref } from 'vue'
import { formatMoney } from '@/utils/money'

export interface Month {
  key: string
  /** The short month name, e.g. "Oct". */
  label: string
  /** The month in full, for the tooltip, e.g. "October 2026". */
  name: string
  cents: number
  current: boolean
}

const props = defineProps<{
  months: Month[]
  currency: string
  /** What the chart is, for screen readers. */
  label: string
  /** Shown over the chart while every month is empty. */
  emptyText?: string
}>()

/** Ink on white, like the platform's buttons; the current month in the accent. */
const c = {
  grid: 'border-neutral-200',
  base: 'border-neutral-300',
  stroke: 'rgb(23 23 23)',
  empty: 'rgb(212 212 212)',
  fill: 'rgb(23 23 23)',
  fillOpacity: 0.08,
  guide: 'bg-neutral-300',
  current: 'h-3 w-3 bg-emerald-500 ring-4 ring-emerald-500/20',
  hover: 'h-2.5 w-2.5 bg-neutral-900',
  dot: 'h-2 w-2 bg-white ring-2 ring-neutral-900',
  tip: 'bg-neutral-900 text-white',
  tipName: 'text-neutral-400',
  focus: 'focus-visible:bg-neutral-100/60',
  label: 'text-neutral-400',
  labelCurrent: 'font-medium text-neutral-900',
  emptyText: 'text-neutral-400',
}

const W = 600
const H = 100
/** Room over the tallest month, so its dot and tooltip stay inside. */
const HEADROOM = 1.25

const max = computed(() => Math.max(...props.months.map((m) => m.cents), 0))
const active = ref<string | null>(null)

/** Each month's point, in percent of the box: x across, y down from the top. */
const points = computed(() =>
  props.months.map((m, i) => ({
    ...m,
    x: props.months.length > 1 ? (i / (props.months.length - 1)) * 100 : 50,
    // an empty chart lies on the baseline, a hair above it so the line shows
    y: max.value ? 100 - (m.cents / (max.value * HEADROOM)) * 100 : 98,
  })),
)

/** A smooth line through the points: each segment eases out and in horizontally, so it never overshoots. */
const line = computed(() => {
  const p = points.value.map((pt) => [(pt.x / 100) * W, (pt.y / 100) * H] as const)
  if (!p.length) return ''
  let d = `M${p[0][0]},${p[0][1]}`
  for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1]
    const [x1, y1] = p[i]
    const mx = (x0 + x1) / 2
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`
  }
  return d
})

const area = computed(() => (line.value ? `${line.value} L${W},${H} L0,${H} Z` : ''))

const activePoint = computed(() => points.value.find((p) => p.key === active.value) ?? null)
</script>

<template>
  <div class="flex h-full flex-col" role="group" :aria-label="label">
    <div class="relative min-h-0 flex-1">
      <!-- the grid: three recessive lines -->
      <div class="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
        <span v-for="i in 3" :key="i" :class="c.grid" class="border-t border-dashed" />
        <span class="border-t" :class="c.base" />
      </div>

      <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="earnings-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="c.fill" :stop-opacity="c.fillOpacity" />
            <stop offset="100%" :stop-color="c.fill" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path v-if="max" :d="area" fill="url(#earnings-fill)" />
        <path
          :d="line"
          fill="none"
          :stroke="max ? c.stroke : c.empty"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
          :stroke-dasharray="max ? undefined : '4 5'"
        />
      </svg>

      <p v-if="!max && emptyText" class="absolute inset-0 flex items-center justify-center text-xs" :class="c.emptyText">
        {{ emptyText }}
      </p>

      <!-- the guide down from the month in hand -->
      <span
        v-if="activePoint"
        class="pointer-events-none absolute bottom-0 w-px -translate-x-1/2"
        :class="c.guide"
        :style="{ left: `${activePoint.x}%`, top: `${activePoint.y}%` }"
        aria-hidden="true"
      />

      <!-- the dots: the current month ringed, the one in hand grown -->
      <template v-if="max">
        <span
          v-for="p in points"
          :key="p.key"
          class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all"
          :class="p.current ? c.current : active === p.key ? c.hover : c.dot"
          :style="{ left: `${p.x}%`, top: `${p.y}%` }"
          aria-hidden="true"
        />
      </template>

      <!-- the tooltip, kept inside the card at both ends -->
      <span
        v-if="activePoint"
        class="pointer-events-none absolute z-10 mb-3 -translate-y-full rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg"
        :class="[c.tip, activePoint.x < 15 ? '' : activePoint.x > 85 ? '-translate-x-full' : '-translate-x-1/2']"
        :style="{ left: `${activePoint.x}%`, top: `${activePoint.y}%` }"
        role="tooltip"
      >
        <span class="block text-[11px]" :class="c.tipName">{{ activePoint.name }}</span>
        <span class="font-semibold tabular-nums">{{ formatMoney(activePoint.cents, currency) }}</span>
      </span>

      <!-- a month's whole column answers the pointer -->
      <div class="absolute inset-0 flex">
        <button
          v-for="(p, i) in points"
          :key="p.key"
          type="button"
          class="h-full cursor-default focus:outline-none"
          :class="c.focus"
          :style="{
            width: i === 0 || i === points.length - 1 ? `${50 / (points.length - 1)}%` : `${100 / (points.length - 1)}%`,
          }"
          :aria-label="`${p.name}: ${formatMoney(p.cents, currency)}`"
          @mouseenter="active = p.key"
          @mouseleave="active = null"
          @focus="active = p.key"
          @blur="active = null"
        />
      </div>
    </div>

    <div class="relative mt-2 h-4" aria-hidden="true">
      <span
        v-for="(p, i) in points"
        :key="p.key"
        class="absolute text-[11px]"
        :class="[p.current ? c.labelCurrent : c.label, i === 0 ? '' : i === points.length - 1 ? '-translate-x-full' : '-translate-x-1/2']"
        :style="{ left: `${p.x}%` }"
        >{{ p.label }}</span
      >
    </div>
  </div>
</template>
