<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="w-full max-w-md">
    <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200 sm:p-8">
      <h1 class="text-2xl font-semibold tracking-tight text-neutral-900">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1.5 text-sm leading-relaxed text-neutral-500">{{ subtitle }}</p>

      <div v-if="$slots.default" class="mt-7">
        <slot />
      </div>
    </div>

    <p v-if="$slots.footer" class="mt-6 text-center text-sm text-neutral-500">
      <slot name="footer" />
    </p>
  </div>
</template>
