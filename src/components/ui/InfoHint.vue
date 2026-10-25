<script setup lang="ts">
/**
 * A detail behind an "i" beside what it explains: shown on hover, on focus
 * from the keyboard, or on a tap where there's no hover. It opens below,
 * lined up with the icon's right edge, or centred under it.
 */
import { onBeforeUnmount, ref, useId, watch } from 'vue'

withDefaults(
  defineProps<{
    text: string
    /** What the icon is for, for screen readers. */
    label: string
    align?: 'center' | 'right'
  }>(),
  { align: 'center' },
)

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
      class="inline-flex h-4 w-4 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
      :aria-label="label"
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
      class="absolute top-full z-20 mt-1.5 max-w-[calc(100vw-2rem)] rounded-md bg-neutral-900 px-2.5 py-1.5 text-left text-[11px] leading-snug font-normal whitespace-nowrap text-white shadow-lg transition-opacity group-focus-within/hint:visible group-focus-within/hint:opacity-100 group-hover/hint:visible group-hover/hint:opacity-100"
      :class="[open ? 'visible opacity-100' : 'invisible opacity-0', align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2']"
    >
      {{ text }}
    </span>
  </span>
</template>
