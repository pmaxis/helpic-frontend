<script setup lang="ts">
/**
 * The live glimpse of the app beside the sign-in and sign-up forms: a
 * project whose tasks move along by themselves (or when you click their
 * status), and a feed of what happens in Helpic. The cards tilt a little
 * toward the pointer (the layout draws the light that follows it).
 *
 * With "reduce motion" on, nothing moves by itself and nothing tilts; the
 * statuses still change on click. It is decoration, so it is hidden from
 * screen readers and kept out of the tab order.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { statusLabel } from '@/constants/tasks'

type Status = 'new' | 'in_progress' | 'done'
const NEXT: Record<Status, Status> = { new: 'in_progress', in_progress: 'done', done: 'new' }
const TONE: Record<Status, string> = {
  done: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30',
  in_progress: 'bg-amber-300/15 text-amber-200 ring-amber-300/30',
  new: 'bg-sky-400/15 text-sky-300 ring-sky-400/30',
}

/** The demo project's tasks: their titles are "showcase.tasks.<n>" in the messages. */
const START: { n: number; status: Status }[] = [
  { n: 0, status: 'done' },
  { n: 1, status: 'in_progress' },
  { n: 2, status: 'new' },
]
const tasks = ref(START.map((t) => ({ ...t })))
const done = computed(() => tasks.value.filter((t) => t.status === 'done').length)
const progress = computed(() => Math.round((done.value / tasks.value.length) * 100))

/** Which task just changed, for a brief highlight. */
const flashed = ref(-1)
let flashTimer: number | undefined

function advance(i: number) {
  tasks.value[i].status = NEXT[tasks.value[i].status]
  flashed.value = i
  window.clearTimeout(flashTimer)
  flashTimer = window.setTimeout(() => (flashed.value = -1), 700)
}

/** The project moves on by itself: the first unfinished task takes a step; once all are done it starts over. */
function tick() {
  if (paused.value) return
  const i = tasks.value.findIndex((t) => t.status !== 'done')
  if (i >= 0) advance(i)
  else tasks.value = START.map((t) => ({ ...t }))
}

// --- what happens in Helpic ------------------------------------------------------

/** What happens: `what` and `text`/`side` given as message keys are translated; the rest is shown as is. */
const EVENTS = [
  { who: 'AI', from: 'Acme Inc', what: 'newTask', text: 'faq', side: 'dueFri' },
  { who: 'OP', from: 'Olena', what: 'commentOn', task: 1, side: 'ago' },
  { who: 'AI', from: 'Acme Inc', what: 'fileOn', file: 'brand-guidelines.pdf', size: '1.2 MB' },
  { who: 'AI', from: 'Acme Inc', what: 'reportPaid', text: 'reportTitle', amount: '$1,250.00' },
] as const
const eventIndex = ref(0)
const event = computed(() => EVENTS[eventIndex.value])

function nextEvent() {
  if (!paused.value) eventIndex.value = (eventIndex.value + 1) % EVENTS.length
}

// --- pointer: tilt -------------------------------------------------------------------

const cards = ref<HTMLElement | null>(null)
const tilt = ref({ x: 0, y: 0 })
const hovering = ref(false)
const reduceMotion = ref(false)
const hidden = ref(false)
/** Hovering the cards, or a tab in the background, stops the self-running parts. */
const paused = computed(() => hovering.value || hidden.value || reduceMotion.value)

/** Tilts toward the pointer anywhere on the page, a few degrees at most. */
function onPointerMove(e: PointerEvent) {
  const el = cards.value
  if (!el || reduceMotion.value) return
  const r = el.getBoundingClientRect()
  const dx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / r.width))
  const dy = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / r.height))
  tilt.value = { x: -dy * 4, y: dx * 6 }
}

let taskTimer: number | undefined
let eventTimer: number | undefined
let motionQuery: MediaQueryList | undefined

function onMotionChange() {
  reduceMotion.value = !!motionQuery?.matches
  if (reduceMotion.value) tilt.value = { x: 0, y: 0 }
}

function onVisibility() {
  hidden.value = document.hidden
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  onMotionChange()
  motionQuery.addEventListener('change', onMotionChange)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pointermove', onPointerMove)
  taskTimer = window.setInterval(tick, 2600)
  eventTimer = window.setInterval(nextEvent, 3800)
})

onBeforeUnmount(() => {
  window.clearInterval(taskTimer)
  window.clearInterval(eventTimer)
  window.clearTimeout(flashTimer)
  motionQuery?.removeEventListener('change', onMotionChange)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pointermove', onPointerMove)
})
</script>

<template>
  <!-- the cards; hovering them pauses the self-running parts -->
  <div
    ref="cards"
    class="relative mt-10 space-y-3 transition-transform duration-300 ease-out [perspective:900px]"
    aria-hidden="true"
    @pointerenter="hovering = true"
    @pointerleave="hovering = false"
  >
    <div class="transition-transform duration-300 ease-out" :style="{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }">
      <div class="rounded-xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
            </span>
            <div>
              <p class="text-sm font-semibold">{{ $t('showcase.project') }}</p>
              <p class="text-xs text-neutral-400">Acme Inc · {{ $t('showcase.progress', { done, total: tasks.length }) }}</p>
            </div>
          </div>
          <span class="text-xs font-medium text-neutral-400 tabular-nums">{{ progress }}%</span>
        </div>
        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div class="h-full rounded-full bg-emerald-400 transition-[width] duration-700 ease-out" :style="{ width: `${progress}%` }" />
        </div>
        <ul class="mt-3 space-y-1">
          <li
            v-for="(t, i) in tasks"
            :key="t.n"
            class="-mx-1.5 flex items-center justify-between gap-3 rounded-md px-1.5 py-1 text-xs transition-colors duration-500"
            :class="flashed === i ? 'bg-white/[0.07]' : ''"
          >
            <span class="truncate transition-colors" :class="t.status === 'done' ? 'text-neutral-500 line-through decoration-neutral-600' : 'text-neutral-300'">
              {{ $t(`showcase.tasks.${t.n}`) }}
            </span>
            <button
              type="button"
              tabindex="-1"
              class="shrink-0 cursor-pointer rounded-full px-2 py-0.5 font-medium ring-1 transition hover:brightness-125 active:scale-95 ring-inset"
              :class="TONE[t.status]"
              :title="$t('showcase.moveAlong')"
              @click="advance(i)"
            >
              {{ statusLabel(t.status) }}
            </button>
          </li>
        </ul>
      </div>

      <div class="relative mt-3 ml-8 h-[68px]">
        <Transition
          mode="out-in"
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="translate-y-2 opacity-0"
          leave-active-class="transition duration-200 ease-in"
          leave-to-class="-translate-y-2 opacity-0"
        >
          <div :key="eventIndex" class="flex items-center gap-3 rounded-xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">{{ event.who }}</span>
            <div class="min-w-0 flex-1">
              <p class="text-xs text-neutral-400">{{ $t(`showcase.events.${event.what}`) }} · <span class="text-neutral-200">{{ event.from }}</span></p>
              <p class="truncate text-sm font-semibold">
                <template v-if="'text' in event">{{ $t(`showcase.events.${event.text}`) }}</template>
                <template v-else-if="'task' in event">{{ $t(`showcase.tasks.${event.task}`) }}</template>
                <template v-else>{{ event.file }}</template>
              </p>
            </div>
            <span class="shrink-0 text-xs text-neutral-400" :class="event.what === 'reportPaid' ? 'font-medium text-emerald-300' : ''">
              <template v-if="'side' in event">{{ $t(`showcase.events.${event.side}`) }}</template>
              <template v-else-if="'size' in event">{{ event.size }}</template>
              <template v-else>{{ event.amount }}</template>
            </span>
          </div>
        </Transition>
      </div>
    </div>
    <p class="text-center text-[11px] text-neutral-500">{{ $t('showcase.tryIt') }}</p>
  </div>
</template>
