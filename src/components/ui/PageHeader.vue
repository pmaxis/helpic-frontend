<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-5">
    <div class="min-w-0">
      <slot name="before" />
      <h1 class="text-2xl font-semibold tracking-tight text-neutral-900">{{ title }}</h1>
      <p v-if="description" class="mt-1 text-sm text-neutral-500">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap items-center justify-end gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
