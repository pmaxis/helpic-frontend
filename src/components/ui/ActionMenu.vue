<script setup lang="ts">
// A "⋯" button that opens a small menu of actions. Closes on a pick, an
// outside click or Escape.
import { onBeforeUnmount, ref, watch } from 'vue'

export interface MenuAction {
  label: string
  /** Red, for destructive actions. */
  danger?: boolean
  onSelect: () => void
}

withDefaults(
  defineProps<{
    actions: MenuAction[]
    /** Accessible name of the button, e.g. "Project options". */
    label: string
    /** sm matches toolbar icons; md matches a default select. */
    size?: 'sm' | 'md'
  }>(),
  { size: 'sm' },
)

const open = ref(false)
const root = ref<HTMLElement | null>(null)

function onDocPointer(e: PointerEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    // Close just the menu, not an enclosing modal.
    e.stopPropagation()
    open.value = false
  }
}

function stopListening() {
  document.removeEventListener('pointerdown', onDocPointer)
  window.removeEventListener('keydown', onKeydown, true)
}

watch(open, (isOpen) => {
  if (!isOpen) return stopListening()
  document.addEventListener('pointerdown', onDocPointer)
  window.addEventListener('keydown', onKeydown, true)
})
onBeforeUnmount(stopListening)

function pick(action: MenuAction) {
  open.value = false
  action.onSelect()
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="inline-flex items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 shadow-xs transition-colors hover:bg-neutral-50 hover:text-neutral-900"
      :class="[size === 'md' ? 'h-[38px] w-[38px]' : 'h-8 w-8', open ? 'bg-neutral-50 text-neutral-900' : '']"
      :aria-label="label"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="open = !open"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4" aria-hidden="true">
        <circle cx="5" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="19" cy="12" r="1.6" />
      </svg>
    </button>
    <div
      v-if="open"
      role="menu"
      class="animate-pop-down absolute top-full right-0 z-20 mt-1 w-48 rounded-lg border border-neutral-200 bg-white p-1 text-sm shadow-lg shadow-black/10"
    >
      <button
        v-for="a in actions"
        :key="a.label"
        type="button"
        role="menuitem"
        class="w-full rounded-md px-2.5 py-1.5 text-left"
        :class="a.danger ? 'text-red-600 hover:bg-red-50' : 'text-neutral-700 hover:bg-neutral-100'"
        @click="pick(a)"
      >
        {{ a.label }}
      </button>
    </div>
  </div>
</template>
