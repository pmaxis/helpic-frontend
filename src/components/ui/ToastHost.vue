<script setup lang="ts">
import { useToasts } from '@/composables/useToasts'

const { toasts, dismiss } = useToasts()
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end sm:pr-6">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="pointer-events-auto flex max-w-sm items-start gap-3 rounded-md border bg-white px-3.5 py-2.5 text-sm shadow-sm"
        :class="{
          'border-neutral-900': t.tone === 'error',
          'border-neutral-300': t.tone !== 'error',
        }"
        role="status"
      >
        <span
          class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
          :class="t.tone === 'error' ? 'bg-neutral-900' : t.tone === 'success' ? 'bg-neutral-700' : 'bg-neutral-400'"
          aria-hidden="true"
        />
        <p class="flex-1 text-neutral-800">{{ t.message }}</p>
        <button
          type="button"
          class="shrink-0 text-neutral-400 transition-colors hover:text-neutral-900"
          :aria-label="$t('ui.dismiss')"
          @click="dismiss(t.id)"
        >
          ✕
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.18s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
