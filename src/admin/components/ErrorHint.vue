<script setup lang="ts">
/**
 * An error behind an "i" beside the state it explains: shown on hover, on
 * focus from the keyboard, or on a tap where there's no hover, so a long
 * message from a service doesn't stretch its card.
 */
import { onBeforeUnmount, ref, useId, watch } from 'vue'

defineProps<{ error: string }>()

const id = useId()
/** Opened by a tap; hover and focus show it without. */
const open = ref(false)
const root = ref<HTMLElement | null>(null)

function onDocPointer(e: PointerEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false
}
watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', onDocPointer)
  else document.removeEventListener('pointerdown', onDocPointer)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocPointer))
</script>

<template>
  <span ref="root" class="group/hint relative inline-flex">
    <button
      type="button"
      class="inline-flex h-4 w-4 items-center justify-center rounded-full text-red-500 transition-colors hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
      :aria-label="$t('admin.system.errorDetails')"
      :aria-describedby="id"
      :aria-expanded="open"
      @click="open = !open"
      @keydown.esc="open = false"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 7.5h.01" />
      </svg>
    </button>
    <span
      :id="id"
      role="tooltip"
      class="absolute right-0 bottom-full z-20 mb-1.5 w-64 max-w-[calc(100vw-2rem)] rounded-md bg-neutral-900 px-2.5 py-1.5 text-left font-mono text-[11px] leading-snug font-normal break-words whitespace-normal text-white shadow-lg transition-opacity group-focus-within/hint:visible group-focus-within/hint:opacity-100 group-hover/hint:visible group-hover/hint:opacity-100"
      :class="open ? 'visible opacity-100' : 'invisible opacity-0'"
    >
      {{ error }}
    </span>
  </span>
</template>
