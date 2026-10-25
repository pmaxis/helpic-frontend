<script setup lang="ts">
/**
 * A policy drawn as a document on the dark side of its page: its mark and
 * name over lines of text that light up as the reader gets through the real
 * one, and how much they've read. It says nothing of what the policy says,
 * so it holds whatever an admin writes.
 */
import { computed } from 'vue'
import { APP_NAME } from '@/config'
import type { PolicyKind } from '@/types/policies'

const props = defineProps<{
  kind: PolicyKind
  /** How much of the text has been read, 0 to 1. */
  progress: number
}>()

/** The document's lines: a heading, then its text, as a policy reads. */
const LINES = [
  { heading: true, width: '45%' },
  { width: '100%' },
  { width: '92%' },
  { width: '64%' },
  { heading: true, width: '38%' },
  { width: '96%' },
  { width: '100%' },
  { width: '78%' },
  { heading: true, width: '52%' },
  { width: '88%' },
  { width: '58%' },
]

/** How many lines are lit: as far down the document as the reader is in the text. */
const lit = computed(() => Math.round(props.progress * LINES.length))
const percent = computed(() => Math.round(props.progress * 100))
</script>

<template>
  <div class="relative mt-10" aria-hidden="true">
    <!-- a second sheet under the first, for depth -->
    <div class="absolute inset-x-6 -bottom-3 top-3 rounded-2xl border border-white/5 bg-white/[0.02]" />

    <div class="relative rounded-2xl border border-white/10 bg-neutral-900/80 p-6 shadow-2xl shadow-black/40 backdrop-blur">
      <div class="flex items-center gap-3">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400 ring-1 ring-emerald-400/20">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
            <template v-if="kind === 'privacy'">
              <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />
              <path d="m9 12 2 2 4-4" />
            </template>
            <template v-else-if="kind === 'terms'">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5M9 13h6M9 17h4" />
            </template>
            <template v-else>
              <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
              <path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01" />
            </template>
          </svg>
        </span>
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-white">{{ $t(`policies.names.${kind}`) }}</p>
          <p class="text-xs text-neutral-500">{{ APP_NAME }}</p>
        </div>
      </div>

      <div class="mt-6 space-y-2.5">
        <div
          v-for="(line, i) in LINES"
          :key="i"
          class="rounded-full transition-colors duration-500"
          :class="[line.heading ? 'mt-5 h-2.5 first:mt-0' : 'h-1.5', i < lit ? (line.heading ? 'bg-emerald-400' : 'bg-emerald-400/40') : line.heading ? 'bg-white/20' : 'bg-white/10']"
          :style="{ width: line.width }"
        />
      </div>

      <div class="mt-7 flex items-center gap-3">
        <div class="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
          <div class="h-full rounded-full bg-emerald-400 transition-[width] duration-300" :style="{ width: `${percent}%` }" />
        </div>
        <span class="text-xs text-neutral-400 tabular-nums">{{ $t('policies.read', { pct: percent }) }}</span>
      </div>
    </div>
  </div>
</template>
