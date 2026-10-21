<script setup lang="ts">
/**
 * One setting in a group's card: its name and a hint on the left, its
 * control on the right. Whatever goes in "below" — a form opened from the
 * row — spans the row under them.
 */
defineProps<{
  label: string
  hint?: string
}>()
</script>

<template>
  <div class="px-5 py-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div class="min-w-0">
        <p class="text-sm font-medium text-neutral-900">{{ label }}</p>
        <p v-if="hint" class="mt-0.5 text-sm text-neutral-500">{{ hint }}</p>
      </div>
      <div v-if="$slots.default" class="shrink-0 sm:max-w-[60%]">
        <slot />
      </div>
    </div>
    <div v-if="$slots.below" class="mt-4">
      <slot name="below" />
    </div>
  </div>
</template>
