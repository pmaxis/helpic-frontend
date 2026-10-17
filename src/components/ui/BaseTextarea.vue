<script setup lang="ts">
import { computed, useId } from 'vue'
import FieldLabel from '@/components/ui/FieldLabel.vue'

withDefaults(
  defineProps<{
    modelValue: string
    label: string
    placeholder?: string
    rows?: number
    error?: string
    required?: boolean
  }>(),
  { rows: 4 },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const textareaId = useId()
const errorId = computed(() => `${textareaId}-error`)
</script>

<template>
  <div>
    <FieldLabel :target="textareaId" :label="label" :required="required" />
    <textarea
      :id="textareaId"
      :value="modelValue"
      :rows="rows"
      :placeholder="placeholder"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? errorId : undefined"
      class="mt-1.5 block w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 focus:outline-none"
      :class="error ? 'border-neutral-900' : ''"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
    <p v-if="error" :id="errorId" class="mt-1.5 text-sm text-neutral-600">{{ error }}</p>
  </div>
</template>
