<script setup lang="ts">
/** Starts dictating the whole task, so it sits by the form's title, not in a field. On a phone, just the microphone. */
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="flex h-7 items-center gap-1.5 rounded-md px-2 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900/20 focus-visible:outline-none"
    :aria-label="$t('dictation.start')"
    :title="$t('dictation.start')"
    @click="$emit('click')"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
    <span class="hidden sm:inline">{{ $t('dictation.start') }}</span>
  </button>
</template>
