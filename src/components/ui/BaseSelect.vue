<script setup lang="ts">
import { computed, useId } from 'vue'
import SelectInput from './SelectInput.vue'
import FieldLabel from '@/components/ui/FieldLabel.vue'

defineProps<{
  modelValue: string
  label: string
  options: { value: string; label: string }[]
  placeholder?: string
  error?: string
  required?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const selectId = useId()
const errorId = computed(() => `${selectId}-error`)
</script>

<template>
  <div>
    <FieldLabel :target="selectId" :label="label" :required="required" />
    <SelectInput
      :id="selectId"
      class="mt-1.5"
      :model-value="modelValue"
      :options="options"
      :placeholder="placeholder"
      :invalid="!!error"
      :aria-describedby="error ? errorId : undefined"
      @update:model-value="emit('update:modelValue', $event)"
    />
    <p v-if="error" :id="errorId" class="mt-1.5 text-sm text-neutral-600">{{ error }}</p>
  </div>
</template>
