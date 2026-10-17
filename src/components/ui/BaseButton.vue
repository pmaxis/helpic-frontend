<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: 'button' | 'submit'
    variant?: 'primary' | 'ghost' | 'danger'
    size?: 'sm' | 'md'
    loading?: boolean
    disabled?: boolean
    /** Full-width (form buttons) vs. inline-sized (toolbar/header buttons). */
    block?: boolean
  }>(),
  { type: 'button', variant: 'primary', size: 'md', loading: false, disabled: false, block: true },
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    class="inline-flex items-center justify-center gap-1.5 rounded-lg font-medium shadow-xs transition-colors focus:outline-none disabled:cursor-not-allowed"
    :class="[
      block ? 'w-full' : '',
      // sm is exactly 32px whatever the border, like the toggles and selects beside it
      size === 'sm' ? 'h-8 px-3 text-sm' : 'px-4 py-2 text-sm',
      variant === 'primary'
        ? 'bg-neutral-900 text-white hover:bg-neutral-800 disabled:bg-neutral-300'
        : variant === 'danger'
          ? 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300'
          : 'border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50 disabled:text-neutral-400',
    ]"
  >
    <span v-if="loading" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
    <slot />
  </button>
</template>
