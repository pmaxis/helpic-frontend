<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

withDefaults(
  defineProps<{
    title: string
    size?: 'md' | 'lg'
  }>(),
  { size: 'md' },
)

const sizeClass = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
} as const

const emit = defineEmits<{ close: [] }>()

// Escape closes the modal wherever focus is. Controls that use Escape
// themselves (e.g. an open select) stop it from reaching the window.
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-neutral-900/40 backdrop-blur-[2px]" @click="$emit('close')" />

      <div
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        class="relative flex max-h-[85vh] w-full flex-col rounded-xl border border-neutral-200 bg-white shadow-xl"
        :class="sizeClass[size]"
      >
        <div class="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 class="text-sm font-semibold text-neutral-900">{{ title }}</h2>
          <button
            type="button"
            class="inline-flex rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Close"
            @click="$emit('close')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="overflow-y-auto px-5 py-4">
          <slot />
        </div>

        <div v-if="$slots.footer" class="flex shrink-0 justify-end gap-2 border-t border-neutral-100 px-5 py-4">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
