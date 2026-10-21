<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 px-6 py-14 text-center">
    <!-- an illustration, when the page has one, takes the icon's place -->
    <slot v-if="$slots.illustration" name="illustration" />
    <span v-else class="flex h-11 w-11 items-center justify-center rounded-full bg-white text-neutral-500 shadow-sm ring-1 ring-neutral-200">
      <slot name="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        </svg>
      </slot>
    </span>
    <p class="mt-4 text-sm font-semibold text-neutral-900">{{ title }}</p>
    <p v-if="description" class="mt-1 max-w-sm text-sm text-neutral-500">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5"><slot /></div>
  </div>
</template>
