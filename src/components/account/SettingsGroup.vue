<script setup lang="ts">
/**
 * A group of settings: a heading with a line under it, and one card whose
 * rows are the settings themselves (SettingsRow), a rule between each.
 */
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <section>
    <h2 class="text-base font-semibold text-neutral-900">{{ title }}</h2>
    <p v-if="description" class="mt-0.5 text-sm text-neutral-500">{{ description }}</p>
    <div class="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
      <slot />
    </div>
  </section>
</template>
