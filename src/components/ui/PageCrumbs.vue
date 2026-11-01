<script setup lang="ts">
/**
 * Small crumbs over a page's title, the way a report or a project's settings
 * read: a quiet back arrow, the way here ("Projects › Landing"), each crumb a
 * link, then this page's own name when it has one.
 */
import { RouterLink, type RouteLocationRaw } from 'vue-router'

defineProps<{
  /** The way here, this page left out: each crumb links back. */
  crumbs: { label: string; to: RouteLocationRaw }[]
  /** This page, the last crumb; left out when the title says it. */
  current?: string
  backTo: RouteLocationRaw
  backLabel: string
  label: string
}>()
</script>

<template>
  <nav class="flex min-w-0 items-center gap-1.5 self-start text-sm text-neutral-500" :aria-label="label">
    <RouterLink
      :to="backTo"
      class="-ml-1.5 mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-neutral-100 hover:text-neutral-900"
      :aria-label="backLabel"
      :title="backLabel"
      data-back
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
        <path d="M19 12H5" />
        <polyline points="12 19 5 12 12 5" />
      </svg>
    </RouterLink>
    <template v-for="(c, i) in crumbs" :key="i">
      <svg v-if="i > 0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 shrink-0 text-neutral-300" aria-hidden="true">
        <polyline points="9 18 15 12 9 6" />
      </svg>
      <RouterLink :to="c.to" class="truncate hover:text-neutral-900">{{ c.label }}</RouterLink>
    </template>
    <template v-if="current">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 shrink-0 text-neutral-300" aria-hidden="true">
        <polyline points="9 18 15 12 9 6" />
      </svg>
      <span class="truncate text-neutral-700" data-current-crumb>{{ current }}</span>
    </template>
  </nav>
</template>
