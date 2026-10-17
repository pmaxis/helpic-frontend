<script setup lang="ts">
// A compact filter button ("Experience: Any ▾") that opens a small panel with
// the filter's options. Closes on outside click and Escape.
import { onBeforeUnmount, ref, useId } from 'vue'

defineProps<{
  label: string
  /** The current value, shown after the label. */
  value: string
  /** Highlight when the filter narrows the results. */
  active?: boolean
  /** Panel alignment under the button. */
  align?: 'left' | 'right'
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const button = ref<HTMLButtonElement | null>(null)
const panelId = useId()

function onDocPointer(e: PointerEvent) {
  if (root.value && !root.value.contains(e.target as Node)) close()
}

function toggle() {
  if (open.value) close()
  else {
    open.value = true
    document.addEventListener('pointerdown', onDocPointer)
  }
}

function close(refocus = false) {
  open.value = false
  document.removeEventListener('pointerdown', onDocPointer)
  if (refocus) button.value?.focus()
}

onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointer))

defineExpose({ close })
</script>

<template>
  <div ref="root" class="relative" @keydown.esc.stop="close(true)">
    <button
      ref="button"
      type="button"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="panelId"
      class="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 transition-colors ring-inset"
      :class="active ? 'bg-neutral-900 text-white ring-neutral-900 hover:bg-neutral-800' : 'bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-50'"
      @click="toggle"
    >
      <slot name="icon" />
      <span :class="active ? 'text-neutral-300' : 'text-neutral-500'">{{ label }}:</span>
      <span>{{ value }}</span>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 transition-transform" :class="open ? 'rotate-180' : ''" aria-hidden="true">
        <path d="m6 8 4 4 4-4" />
      </svg>
    </button>
    <div
      v-if="open"
      :id="panelId"
      role="dialog"
      :aria-label="label"
      class="animate-pop-down absolute top-full z-30 mt-1.5 min-w-48 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-neutral-200"
      :class="align === 'right' ? 'right-0' : 'left-0'"
    >
      <slot :close="close" />
    </div>
  </div>
</template>
