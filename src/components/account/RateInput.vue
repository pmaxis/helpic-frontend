<script setup lang="ts">
/**
 * An hourly rate, edited in place: the currency before it, "/h" after. It
 * saves on Enter or when it loses focus, if it changed; emptied, it clears.
 */
import { ref, watch } from 'vue'
import { currencySymbol, priceInput } from '@/utils/money'

const props = defineProps<{
  /** The rate in cents; null when there is none. */
  cents: number | null
  currency: string
  label: string
  saving?: boolean
  error?: string
}>()
const emit = defineEmits<{ save: [rate: string | null] }>()

const draft = ref(priceInput(props.cents))
/** What was last sent, so Enter and the blur after it save once. */
let sent: string | undefined
watch(
  () => props.cents,
  (c) => {
    draft.value = priceInput(c)
    sent = undefined
  },
)

// A refused rate can be sent again.
watch(
  () => props.error,
  () => (sent = undefined),
)

function commit() {
  const value = draft.value.trim()
  if (value === priceInput(props.cents) || value === sent) return
  sent = value
  emit('save', value || null)
}
</script>

<template>
  <div>
    <div
      class="flex items-center rounded-lg border bg-white text-sm focus-within:border-neutral-900 focus-within:ring-2 focus-within:ring-neutral-900/10"
      :class="error ? 'border-red-500' : 'border-neutral-300'"
    >
      <span class="pl-3 text-neutral-400" aria-hidden="true">{{ currencySymbol(currency) }}</span>
      <input
        v-model="draft"
        type="text"
        inputmode="decimal"
        :aria-label="label"
        :aria-invalid="!!error"
        :placeholder="$t('timelog.ratePlaceholder')"
        :disabled="saving"
        class="min-w-0 flex-1 bg-transparent px-1.5 py-2 text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        @keydown.enter.prevent="commit"
        @blur="commit"
      />
      <span class="pr-3 text-neutral-400" aria-hidden="true">{{ $t('timelog.perHour', { amount: '' }) }}</span>
    </div>
    <p v-if="error" class="mt-1 text-xs text-red-600">{{ error }}</p>
  </div>
</template>
