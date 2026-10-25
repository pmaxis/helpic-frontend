<script setup lang="ts">
defineProps<{
  modelValue: boolean
  label: string
  /** Shown as it is, and can't be switched. */
  disabled?: boolean
}>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-neutral-900/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
    :class="modelValue ? 'bg-neutral-900' : 'bg-neutral-300'"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span
      class="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
      :class="modelValue ? 'translate-x-[18px]' : 'translate-x-0.5'"
    />
  </button>
</template>
