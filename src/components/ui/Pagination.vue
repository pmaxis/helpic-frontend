<script setup lang="ts">
/**
 * Numbered pages under a list: which items are shown out of how many, and
 * the pages — the first, the last and a few around the current one, with
 * gaps between — plus previous and next. Hidden when everything fits on one.
 */
import { computed } from 'vue'

const props = defineProps<{
  /** The current page, from 1. */
  page: number
  /** Items in all. */
  total: number
  /** Items a page holds. */
  limit: number
}>()

const emit = defineEmits<{ 'update:page': [page: number] }>()

const pages = computed(() => Math.max(1, Math.ceil(props.total / props.limit)))
const from = computed(() => (props.total ? (props.page - 1) * props.limit + 1 : 0))
const to = computed(() => Math.min(props.page * props.limit, props.total))

/** The pages to show, null for a gap: 1 … 4 5 6 … 12. */
const items = computed<(number | null)[]>(() => {
  const n = pages.value
  const cur = props.page
  if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1)
  const around = [cur - 1, cur, cur + 1].filter((p) => p > 1 && p < n)
  // near an end, show a few more there instead of a gap of one
  if (cur <= 3) around.push(...[2, 3, 4].filter((p) => !around.includes(p)))
  if (cur >= n - 2) around.push(...[n - 3, n - 2, n - 1].filter((p) => !around.includes(p)))
  const shown = [1, ...[...new Set(around)].sort((a, b) => a - b), n]
  const out: (number | null)[] = []
  shown.forEach((p, i) => {
    if (i && p - shown[i - 1] > 1) out.push(null)
    out.push(p)
  })
  return out
})

function go(p: number) {
  if (p >= 1 && p <= pages.value && p !== props.page) emit('update:page', p)
}
</script>

<template>
  <nav v-if="pages > 1" class="flex flex-wrap items-center justify-between gap-3" :aria-label="$t('ui.pagination')">
    <p class="text-sm text-neutral-500 tabular-nums">{{ $t('ui.shownOf', { from, to, total }) }}</p>
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:pointer-events-none disabled:opacity-40"
        :disabled="page <= 1"
        :aria-label="$t('ui.prevPage')"
        @click="go(page - 1)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <template v-for="(p, i) in items" :key="p ?? `gap-${i}`">
        <span v-if="p === null" class="flex h-8 w-6 items-center justify-center text-sm text-neutral-400" aria-hidden="true">…</span>
        <button
          v-else
          type="button"
          class="h-8 min-w-8 rounded-lg px-2 text-sm font-medium tabular-nums transition-colors"
          :class="p === page ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'"
          :aria-current="p === page ? 'page' : undefined"
          :aria-label="$t('ui.goToPage', { page: p })"
          @click="go(p)"
        >
          {{ p }}
        </button>
      </template>
      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:pointer-events-none disabled:opacity-40"
        :disabled="page >= pages"
        :aria-label="$t('ui.nextPage')"
        @click="go(page + 1)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  </nav>
</template>
