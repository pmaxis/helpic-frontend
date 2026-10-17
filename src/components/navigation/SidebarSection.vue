<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    /** Hides the section label when the sidebar is collapsed to icon-only. */
    collapsed?: boolean
  }>(),
  {
    collapsed: false,
  },
)
</script>

<template>
  <div>
    <template v-if="label">
      <p v-if="!collapsed" class="px-2.5 text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
        {{ label }}
      </p>
      <!-- Icon-only sidebar: a divider stands in for the heading. -->
      <div v-else class="mx-auto h-px w-6 bg-neutral-200" aria-hidden="true" />
    </template>
    <div class="flex flex-col gap-0.5" :class="label ? 'mt-2' : ''">
      <slot />
    </div>
  </div>
</template>
