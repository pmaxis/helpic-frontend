<script setup lang="ts">
/**
 * The board's sideways scrolling. The native scrollbar is hidden for a slim
 * one of our own, drawn in the page's bottom padding under the board. It
 * shows while the board moves — scrolling, panning, dragging a card or
 * column — or while hovered. An empty part of the board can be grabbed and
 * dragged sideways, and a card or column dragged near an edge scrolls that
 * way. The slot is the row of columns.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  /** A card or a column is being dragged. */
  dragging: boolean
}>()

const scroller = ref<HTMLElement | null>(null)

const MIN_THUMB = 40
const metrics = ref({ client: 0, scroll: 0, left: 0 })
const scrolling = ref(false)
const thumbDragging = ref(false)
const trackHover = ref(false)
let scrollTimer: number | undefined

const overflowing = computed(() => metrics.value.scroll > metrics.value.client + 1)
const thumbWidth = computed(() => {
  const m = metrics.value
  return m.scroll ? Math.max(MIN_THUMB, (m.client / m.scroll) * m.client) : 0
})
const thumbLeft = computed(() => {
  const m = metrics.value
  const range = m.scroll - m.client
  return range > 0 ? (m.left / range) * (m.client - thumbWidth.value) : 0
})
const scrollbarVisible = computed(() => scrolling.value || panning.value || thumbDragging.value || trackHover.value || props.dragging)

function measure() {
  const el = scroller.value
  if (el)
    metrics.value = {
      client: el.clientWidth,
      scroll: el.scrollWidth,
      left: el.scrollLeft,
    }
}

function onScroll() {
  measure()
  scrolling.value = true
  window.clearTimeout(scrollTimer)
  scrollTimer = window.setTimeout(() => (scrolling.value = false), 900)
}

let thumbFromX = 0
let thumbFromScroll = 0

function onThumbDown(e: PointerEvent) {
  e.preventDefault()
  thumbDragging.value = true
  thumbFromX = e.clientX
  thumbFromScroll = scroller.value?.scrollLeft ?? 0
  window.addEventListener('pointermove', onThumbMove)
  window.addEventListener('pointerup', onThumbUp, { once: true })
}

function onThumbMove(e: PointerEvent) {
  const el = scroller.value
  const m = metrics.value
  const free = m.client - thumbWidth.value
  if (el && free > 0) el.scrollLeft = thumbFromScroll + ((e.clientX - thumbFromX) * (m.scroll - m.client)) / free
}

function onThumbUp() {
  thumbDragging.value = false
  window.removeEventListener('pointermove', onThumbMove)
}

/** Clicking the track jumps the thumb there. */
function onTrackDown(e: PointerEvent) {
  const el = scroller.value
  if (!el || (e.target as HTMLElement).dataset.thumb !== undefined) return
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const m = metrics.value
  const at = (e.clientX - r.left - thumbWidth.value / 2) / (m.client - thumbWidth.value)
  el.scrollTo({
    left: Math.max(0, Math.min(1, at)) * (m.scroll - m.client),
    behavior: 'smooth',
  })
}

// The row of columns is the slot's root: it grows and shrinks with the columns.
let resizeObserver: ResizeObserver | undefined
onMounted(() => {
  resizeObserver = new ResizeObserver(measure)
  const el = scroller.value
  if (el) resizeObserver.observe(el)
  if (el?.firstElementChild) resizeObserver.observe(el.firstElementChild)
  measure()
})

const EDGE = 96
const MAX_STEP = 24

/** While a card or column is dragged near the board's left or right edge, scroll that way. */
function onDragOver(e: DragEvent) {
  const el = scroller.value
  if (!props.dragging || !el) return
  const r = el.getBoundingClientRect()
  if (e.clientX < r.left + EDGE) el.scrollLeft -= Math.ceil(((r.left + EDGE - e.clientX) / EDGE) * MAX_STEP)
  else if (e.clientX > r.right - EDGE) el.scrollLeft += Math.ceil(((e.clientX - (r.right - EDGE)) / EDGE) * MAX_STEP)
}

/** Grab an empty part of the board and drag sideways to scroll it. */
const panning = ref(false)
let panFromX = 0
let panFromScroll = 0

function onPanStart(e: PointerEvent) {
  const target = e.target as HTMLElement
  if (
    e.button !== 0 ||
    e.pointerType === 'touch' ||
    target.closest('[data-card], [data-column-handle], [data-scrollbar], button, a, input, [data-column-menu]')
  )
    return
  const el = scroller.value
  if (!el || el.scrollWidth <= el.clientWidth) return
  panning.value = true
  panFromX = e.clientX
  panFromScroll = el.scrollLeft
  window.addEventListener('pointermove', onPanMove)
  window.addEventListener('pointerup', onPanEnd, { once: true })
}

function onPanMove(e: PointerEvent) {
  if (scroller.value) scroller.value.scrollLeft = panFromScroll - (e.clientX - panFromX)
}

function onPanEnd() {
  panning.value = false
  window.removeEventListener('pointermove', onPanMove)
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPanMove)
  window.removeEventListener('pointermove', onThumbMove)
  window.clearTimeout(scrollTimer)
  resizeObserver?.disconnect()
})
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col">
    <!-- Fills the page's height; the scrollbar sits in the page's bottom padding below it. -->
    <div
      ref="scroller"
      class="no-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-hidden"
      :class="panning ? 'cursor-grabbing select-none' : ''"
      @scroll="onScroll"
      @dragover="onDragOver"
      @pointerdown="onPanStart"
    >
      <slot />
    </div>

    <!-- scrollbar, centred in the page's bottom padding (p-5 / sm:p-8) -->
    <div
      v-if="overflowing"
      class="absolute inset-x-0 top-full mt-1.5 h-2 sm:mt-3"
      data-scrollbar
      @pointerdown="onTrackDown"
      @mouseenter="trackHover = true"
      @mouseleave="trackHover = false"
    >
      <div
        data-thumb
        class="absolute inset-y-0 rounded-full bg-neutral-300 transition-opacity duration-300 hover:bg-neutral-400"
        :class="scrollbarVisible ? 'opacity-100' : 'opacity-0'"
        :style="{
          width: `${thumbWidth}px`,
          transform: `translateX(${thumbLeft}px)`,
        }"
        @pointerdown="onThumbDown"
      />
    </div>
  </div>
</template>
