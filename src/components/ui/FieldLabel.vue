<script setup lang="ts">
/**
 * A field's label. A required field gets a red asterisk, and screen readers
 * hear "required" instead, since the asterisk means nothing read aloud.
 */
defineProps<{
  /** The id of the control the label is for. */
  target: string
  label: string
  required?: boolean
  /** Keep the label for screen readers only. */
  hidden?: boolean
}>()
</script>

<template>
  <label :for="target" :class="hidden ? 'sr-only' : 'block text-sm font-medium text-neutral-700'">
    {{ label }}<template v-if="required"><span class="ml-0.5 text-red-500" aria-hidden="true">*</span><span class="sr-only"> {{ $t('ui.required') }}</span></template>
  </label>
</template>
