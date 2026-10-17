<script setup lang="ts">
import { computed, useId } from 'vue'
import FieldLabel from '@/components/ui/FieldLabel.vue'

defineProps<{
  modelValue: string
  label: string
  type?: string
  autocomplete?: string
  placeholder?: string
  error?: string
  required?: boolean
  disabled?: boolean
  /** id of a <datalist> with suggestions. */
  list?: string
  /** Taller field, for prominent forms like sign-in. */
  size?: 'md' | 'lg'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputId = useId()
const errorId = computed(() => `${inputId}-error`)

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <div>
    <FieldLabel :target="inputId" :label="label" :required="required" />
    <div class="relative mt-1.5">
      <span v-if="$slots.icon" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400" aria-hidden="true">
        <slot name="icon" />
      </span>
      <input
        :id="inputId"
        :value="modelValue"
        :type="type ?? 'text'"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :disabled="disabled"
        :list="list"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? errorId : undefined"
        class="block w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400"
        :class="[error ? 'border-neutral-900' : '', size === 'lg' ? 'py-2.5' : 'py-2', $slots.icon ? 'pl-9' : '']"
        @input="onInput"
      />
    </div>
    <p v-if="error" :id="errorId" class="mt-1.5 text-sm text-neutral-600">
      {{ error }}
    </p>
  </div>
</template>
