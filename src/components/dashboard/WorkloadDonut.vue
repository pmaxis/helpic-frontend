<script setup lang="ts">
/**
 * The tasks by status as a ring: new, in progress and done as arcs with a gap
 * between them, the open count in the middle. A legend row links to its
 * status's tasks; the one under the pointer lifts its arc. With no tasks the
 * ring is an empty track.
 */
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

export interface Slice {
  key: string
  label: string
  count: number
  /** The arc's colour, as a Tailwind stroke class. */
  stroke: string
  /** The legend dot's colour, as a Tailwind background class. */
  dot: string
}

const props = defineProps<{
  slices: Slice[]
  /** The figure in the middle and what it counts. */
  value: string
  caption: string
}>()

const R = 42
const C = 2 * Math.PI * R
/** The gap between arcs, along the ring. */
const GAP = 3

const total = computed(() => props.slices.reduce((s, x) => s + x.count, 0))
const lifted = ref<string | null>(null)

/** Each non-empty slice's dash and where it starts along the ring. */
const arcs = computed(() => {
  const shown = props.slices.filter((s) => s.count)
  const gap = shown.length > 1 ? GAP : 0
  let at = 0
  return shown.map((s) => {
    const len = (s.count / total.value) * C
    const arc = { ...s, dash: `${Math.max(len - gap, 0.5)} ${C}`, offset: -at }
    at += len
    return arc
  })
})
</script>

<template>
  <div class="flex items-center gap-5">
    <div class="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 100 100" class="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" :r="R" fill="none" class="stroke-neutral-100" stroke-width="10" />
        <circle
          v-for="a in arcs"
          :key="a.key"
          cx="50"
          cy="50"
          :r="R"
          fill="none"
          :class="a.stroke"
          :stroke-width="lifted === a.key ? 13 : 10"
          :stroke-dasharray="a.dash"
          :stroke-dashoffset="a.offset"
          stroke-linecap="butt"
          class="transition-[stroke-width] duration-150"
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="text-3xl font-semibold tracking-tight text-neutral-900 tabular-nums">{{ value }}</span>
        <span class="text-[11px] text-neutral-500">{{ caption }}</span>
      </div>
    </div>

    <ul class="min-w-0 flex-1 space-y-1">
      <li v-for="s in slices" :key="s.key">
        <RouterLink
          :to="`/tasks?status=${s.key}`"
          class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-100"
          @mouseenter="lifted = s.key"
          @mouseleave="lifted = null"
          @focus="lifted = s.key"
          @blur="lifted = null"
        >
          <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="s.dot" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ s.label }}</span>
          <span class="font-medium text-neutral-900 tabular-nums">{{ s.count }}</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
