<script setup lang="ts">
// A password field with a show/hide toggle; otherwise looks like BaseInput.
import { computed, ref, useId } from 'vue'
import FieldLabel from '@/components/ui/FieldLabel.vue'

defineProps<{
  modelValue: string
  label: string
  autocomplete: 'current-password' | 'new-password'
  error?: string
  /** Helper text under the field while there's no error. */
  hint?: string
  required?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const id = useId()
const describedBy = computed(() => `${id}-desc`)
const visible = ref(false)
</script>

<template>
  <div>
    <FieldLabel :target="id" :label="label" :required="required" />
    <div class="relative mt-1.5">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      <input
        :id="id"
        :value="modelValue"
        :type="visible ? 'text' : 'password'"
        :autocomplete="autocomplete"
        placeholder="••••••••"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error || hint ? describedBy : undefined"
        class="block w-full rounded-lg border bg-white py-2.5 pr-10 pl-9 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
        :class="error ? 'border-neutral-900' : 'border-neutral-300'"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <button
        type="button"
        class="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-neutral-400 hover:text-neutral-700 focus-visible:text-neutral-900 focus-visible:outline-none"
        :aria-label="visible ? $t('passwordInput.hide') : $t('passwordInput.show')"
        :aria-pressed="visible"
        @click="visible = !visible"
      >
        <svg v-if="!visible" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
          <path d="M9.9 4.2A10 10 0 0 1 12 4c6.4 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.6 8 10 8a9.7 9.7 0 0 0 5.4-1.6" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          <path d="m2 2 20 20" />
        </svg>
      </button>
    </div>
    <p v-if="error" :id="describedBy" class="mt-1.5 text-sm text-neutral-600">{{ error }}</p>
    <p v-else-if="hint" :id="describedBy" class="mt-1.5 text-xs text-neutral-500">{{ hint }}</p>
  </div>
</template>
