<script setup lang="ts">
/**
 * The field for a second factor: six digits from an authenticator app, or a
 * recovery code. Phones offer their number pad and fill in a code they got;
 * a recovery code has letters, so it isn't restricted to digits.
 */
import BaseInput from '@/components/ui/BaseInput.vue'

defineProps<{
  modelValue: string
  label: string
  error?: string
  /** Helper text under the field while there's no error. */
  hint?: string
  required?: boolean
  size?: 'md' | 'lg'
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <div>
    <BaseInput
      :model-value="modelValue"
      :label="label"
      :error="error"
      :required="required"
      :size="size"
      autocomplete="one-time-code"
      inputmode="numeric"
      placeholder="123 456"
      data-two-factor-code
      @update:model-value="emit('update:modelValue', $event)"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
          <rect x="6" y="2" width="12" height="20" rx="2" />
          <path d="M11 18h2" />
        </svg>
      </template>
    </BaseInput>
    <p v-if="hint && !error" class="mt-1.5 text-sm text-neutral-500">{{ hint }}</p>
  </div>
</template>
