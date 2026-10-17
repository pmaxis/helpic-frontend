<script setup lang="ts">
import { computed, useId } from 'vue'
import SelectInput from './SelectInput.vue'

defineProps<{
  modelValue: string
  label: string
  options: { value: string; label: string }[]
  placeholder?: string
  error?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const selectId = useId()
const errorId = computed(() => `${selectId}-error`)
</script>

<template>
  <div>
    <label :for="selectId" class="block text-sm font-medium text-neutral-700">{{ label }}</label>
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
