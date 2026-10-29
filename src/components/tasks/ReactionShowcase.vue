<script setup lang="ts">
/**
 * Reactions to a shared task, on the dark side of its page: 👍, 🔥 and 👏,
 * each counting its clicks and sending its emoji floating up. Just for fun —
 * nothing is sent or kept anywhere, and the counts start over with the page.
 *
 * With "reduce motion" on nothing floats; the counts still go up. It is
 * decoration, so it is hidden from screen readers and kept out of the tab
 * order.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

/** The reactions: their names are "shared.react.names.<name>". */
const REACTIONS = [
  { name: 'like', emoji: '👍' },
  { name: 'fire', emoji: '🔥' },
  { name: 'clap', emoji: '👏' },
] as const
type Reaction = (typeof REACTIONS)[number]

const counts = ref<Record<string, number>>(Object.fromEntries(REACTIONS.map((r) => [r.name, 0])))
/** The reaction just clicked, for a brief pop. */
const popped = ref<string | null>(null)

/** An emoji on its way up: where it starts, which way it drifts and turns. */
interface Floater {
  id: number
  emoji: string
  left: string
  drift: string
  turn: string
}
const floaters = ref<Floater[]>([])
let nextId = 0
/** At most this many in the air at once. */
const MAX_FLOATERS = 24

const reduceMotion = ref(false)
const timers = new Set<number>()

function later(fn: () => void, ms: number) {
  const id = window.setTimeout(() => {
    timers.delete(id)
    fn()
  }, ms)
  timers.add(id)
}

function react(r: Reaction, index: number) {
  counts.value[r.name]++
  popped.value = r.name
  later(() => popped.value === r.name && (popped.value = null), 200)
  if (reduceMotion.value) return
  const id = nextId++
  // From over its button, give or take a little.
  const left = `${((index + 0.5) / REACTIONS.length) * 100 + (Math.random() * 12 - 6)}%`
  floaters.value = [
    ...floaters.value.slice(-(MAX_FLOATERS - 1)),
    { id, emoji: r.emoji, left, drift: `${Math.random() * 60 - 30}px`, turn: `${Math.random() * 50 - 25}deg` },
  ]
  later(() => (floaters.value = floaters.value.filter((f) => f.id !== id)), 1500)
}

let motionQuery: MediaQueryList | undefined

function onMotionChange() {
  reduceMotion.value = !!motionQuery?.matches
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  onMotionChange()
  motionQuery.addEventListener('change', onMotionChange)
})

onBeforeUnmount(() => {
  for (const id of timers) window.clearTimeout(id)
  motionQuery?.removeEventListener('change', onMotionChange)
})
</script>

<template>
  <div class="mt-10" aria-hidden="true">
    <div class="relative rounded-xl bg-white/[0.06] p-5 ring-1 ring-white/10 backdrop-blur">
      <p class="text-sm font-semibold">{{ $t('shared.react.title') }}</p>
      <p class="mt-1 text-xs text-neutral-400">{{ $t('shared.react.text') }}</p>

      <div class="relative mt-5">
        <!-- the emojis, floating up from the buttons -->
        <div class="pointer-events-none absolute inset-x-0 bottom-full h-40">
          <span
            v-for="f in floaters"
            :key="f.id"
            class="floater absolute bottom-0 -translate-x-1/2 text-2xl"
            :style="{ left: f.left, '--drift': f.drift, '--turn': f.turn }"
          >
            {{ f.emoji }}
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="(r, i) in REACTIONS"
            :key="r.name"
            type="button"
            tabindex="-1"
            class="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2.5 ring-1 ring-white/10 transition duration-150 select-none ring-inset hover:-translate-y-0.5 hover:bg-white/[0.1] active:scale-95"
            :class="counts[r.name] ? 'ring-emerald-400/30' : ''"
            :title="$t(`shared.react.names.${r.name}`)"
            @click="react(r, i)"
          >
            <span class="text-xl transition-transform duration-200" :class="popped === r.name ? 'scale-125' : ''">{{ r.emoji }}</span>
            <span class="min-w-4 text-sm font-medium tabular-nums" :class="counts[r.name] ? 'text-neutral-100' : 'text-neutral-500'">{{ counts[r.name] }}</span>
          </button>
        </div>
      </div>
    </div>
    <p class="mt-3 text-center text-[11px] text-neutral-500">{{ $t('shared.react.hint') }}</p>
  </div>
</template>

<style scoped>
/* Each emoji rises, drifting and turning a little, and fades out. */
.floater {
  animation: float-up 1.5s cubic-bezier(0.2, 0.7, 0.4, 1) forwards;
}
@keyframes float-up {
  0% {
    transform: translate(-50%, 0) scale(0.6) rotate(0);
    opacity: 0;
  }
  15% {
    transform: translate(-50%, -16px) scale(1.1) rotate(0);
    opacity: 1;
  }
  100% {
    transform: translate(calc(-50% + var(--drift)), -150px) scale(0.9) rotate(var(--turn));
    opacity: 0;
  }
}
</style>
