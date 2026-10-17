<script setup lang="ts">
import { t } from '@/i18n'
/**
 * Picks the report type with two cards, each a miniature of the printed
 * sheet — like choosing a résumé template. Native radios underneath, so the
 * arrow keys and screen readers work as usual.
 */
import { computed, useId } from 'vue'
import type { ReportKind } from '@/types/reports'

withDefaults(
  defineProps<{
    modelValue: ReportKind
    disabled?: boolean
    /** Smaller thumbnails, for the narrow report panel. */
    compact?: boolean
    /** One row of wide cards: a small sheet icon, then the name. */
    inline?: boolean
  }>(),
  { disabled: false, compact: false, inline: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: ReportKind] }>()

const name = useId()

/** The hint explains the type where a report is made (inline cards only). */
const KINDS = computed<{ value: ReportKind; label: string; hint: string }[]>(() => [
  { value: 'basic', label: t('reportKind.basic'), hint: t('reportKind.basicHint') },
  { value: 'detailed', label: t('reportKind.detailed'), hint: t('reportKind.detailedHint') },
])

/** Task rows in the miniature; a detailed sheet adds note lines under each. */
const ROWS = [
  { title: 'w-3/5', notes: ['w-11/12', 'w-2/3'] },
  { title: 'w-1/2', notes: ['w-4/5'] },
  { title: 'w-2/3', notes: ['w-10/12', 'w-3/4'] },
  { title: 'w-2/5', notes: ['w-2/3'] },
]
/** The icon in an inline card is a smaller sheet with fewer rows. */
const ICON_ROWS = ROWS.slice(0, 3)
</script>

<template>
  <div class="grid grid-cols-2 gap-3" role="radiogroup" :aria-label="$t('reportKind.aria')">
    <label
      v-for="k in KINDS"
      :key="k.value"
      class="group relative rounded-xl border bg-white transition"
      :class="[
        inline ? 'flex items-center gap-3 p-2.5' : 'block p-2',
        modelValue === k.value ? 'border-neutral-900 ring-1 ring-neutral-900' : 'border-neutral-200 hover:border-neutral-400',
        disabled ? 'cursor-wait opacity-70' : 'cursor-pointer',
      ]"
    >
      <input
        type="radio"
        class="peer sr-only"
        :name="name"
        :value="k.value"
        :checked="modelValue === k.value"
        :disabled="disabled"
        @change="emit('update:modelValue', k.value)"
      />

      <!-- inline: a small sheet as the icon, then the name and the pick mark -->
      <template v-if="inline">
        <div
          class="h-12 w-10 shrink-0 overflow-hidden rounded-sm bg-neutral-50 px-1.5 pt-1.5 ring-1 ring-neutral-200 ring-inset peer-focus-visible:ring-2 peer-focus-visible:ring-neutral-900"
          aria-hidden="true"
        >
          <div class="mx-auto h-0.5 w-2/3 rounded-full bg-neutral-700" />
          <div class="mt-1 h-px bg-neutral-700" />
          <div class="mt-1 space-y-1">
            <div v-for="(row, i) in ICON_ROWS" :key="i">
              <div class="h-0.5 rounded-full bg-neutral-500" :class="row.title" />
              <div v-if="k.value === 'detailed'" class="mt-px ml-1 h-px rounded-full bg-neutral-300" :class="row.notes[0]" />
            </div>
          </div>
        </div>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium text-neutral-900">{{ k.label }}</span>
          <span class="block text-xs leading-snug text-neutral-500">{{ k.hint }}</span>
        </span>
        <span
          class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
          :class="modelValue === k.value ? 'bg-neutral-900 text-white' : 'ring-1 ring-neutral-300 ring-inset'"
          aria-hidden="true"
        >
          <svg v-if="modelValue === k.value" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      </template>

      <template v-else>
        <!-- the miniature sheet -->
        <div
          class="overflow-hidden rounded-md bg-neutral-50 ring-1 ring-neutral-200 ring-inset peer-focus-visible:ring-2 peer-focus-visible:ring-neutral-900"
          :class="compact ? 'h-32 px-2.5 pt-2.5' : 'h-40 px-4 pt-4'"
          aria-hidden="true"
        >
          <div class="mx-auto h-1 w-1/3 rounded-full bg-neutral-300" />
          <div class="mx-auto mt-1 h-1.5 w-2/3 rounded-full bg-neutral-700" />
          <div class="mt-1.5 h-px bg-neutral-700" />
          <div :class="compact ? 'mt-1.5 space-y-1.5' : 'mt-2.5 space-y-2'">
            <div v-for="(row, i) in ROWS" :key="i" class="border-b border-neutral-200 pb-1 last:border-0">
              <div class="flex items-center gap-1">
                <div class="h-1 w-1 shrink-0 rounded-full bg-neutral-300" />
                <div class="h-1 rounded-full bg-neutral-500" :class="row.title" />
                <div class="ml-auto h-1 w-3 shrink-0 rounded-full bg-neutral-400" />
              </div>
              <template v-if="k.value === 'detailed'">
                <div v-for="(w, j) in row.notes" :key="j" class="mt-0.5 ml-2 h-0.5 rounded-full bg-neutral-300" :class="w" />
              </template>
            </div>
          </div>
          <div class="mt-1.5 ml-auto h-1 w-1/4 rounded-full bg-neutral-700" />
        </div>

        <p class="mt-2 px-0.5 text-sm font-medium text-neutral-900">{{ k.label }}</p>

        <!-- picked -->
        <span
          v-if="modelValue === k.value"
          class="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white shadow-sm"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      </template>
    </label>
  </div>
</template>
