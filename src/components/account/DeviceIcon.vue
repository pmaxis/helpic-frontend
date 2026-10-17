<script setup lang="ts">
import type { DeviceKind } from '@/utils/format'

defineProps<{
  kind: DeviceKind
}>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="shrink-0"
    aria-hidden="true"
  >
    <template v-if="kind === 'desktop'">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M2 20h20" />
    </template>
    <template v-else-if="kind === 'phone'">
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </template>
    <template v-else-if="kind === 'tablet'">
      <rect x="4" y="2" width="16" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
    </template>
  </svg>
</template>
