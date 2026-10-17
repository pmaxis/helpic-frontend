<script setup lang="ts">
import { computed } from 'vue'
import SelectInput from './SelectInput.vue'

/** Month + year picker bound to a "YYYY-MM" string ('' = not set). */
const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    invalid?: boolean
    id?: string
    /** How many years back the year list goes. */
    yearsBack?: number
  }>(),
  { yearsBack: 50 },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, '0'),
  label: new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' }),
}))

const thisYear = new Date().getFullYear()
const YEARS = Array.from({ length: props.yearsBack + 6 }, (_, i) => {
  const y = String(thisYear + 5 - i)
  return { value: y, label: y }
})

const year = computed(() => props.modelValue.slice(0, 4))
const month = computed(() => props.modelValue.slice(5, 7))

function update(nextYear: string, nextMonth: string) {
  // Picking just one half still yields a valid value: default the other.
  if (!nextYear && !nextMonth) return emit('update:modelValue', '')
  emit('update:modelValue', `${nextYear || thisYear}-${nextMonth || '01'}`)
}
</script>

<template>
  <div class="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
    <SelectInput
      :id="id"
      :model-value="month"
      :options="MONTHS"
      placeholder="Month"
      :disabled="disabled"
      :invalid="invalid"
      :searchable="false"
      aria-label="Month"
      @update:model-value="update(year, $event)"
    />
    <SelectInput
      :model-value="year"
      :options="YEARS"
      placeholder="Year"
      :disabled="disabled"
      :invalid="invalid"
      :searchable="false"
      aria-label="Year"
      @update:model-value="update($event, month)"
    />
  </div>
</template>
