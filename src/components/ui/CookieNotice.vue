<script setup lang="ts">
import { RouterLink } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useStoredFlag } from '@/composables/useStoredFlag'

// Only what's needed is kept, so nothing to consent to: it just says so, once.
const seen = useStoredFlag('helpic:cookie-notice-seen')
</script>

<template>
  <Transition name="cookie-notice">
    <section
      v-if="!seen"
      class="fixed inset-x-4 bottom-4 z-[90] rounded-xl border border-neutral-200 bg-white p-5 shadow-xl sm:left-auto sm:right-6 sm:bottom-6 sm:w-[22rem]"
      aria-labelledby="cookie-notice-title"
    >
      <div class="flex items-center gap-3">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600" aria-hidden="true">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
            <path d="M8.5 8.5v.01M16 15.5v.01M12 12v.01M11 17v.01M7 14v.01" />
          </svg>
        </span>
        <h2 id="cookie-notice-title" class="text-sm font-semibold text-neutral-900">{{ $t('cookies.label') }}</h2>
      </div>
      <p class="mt-3 text-sm leading-relaxed text-neutral-600">
        {{ $t('cookies.text') }}
        <RouterLink to="/cookies" class="font-medium text-neutral-900 underline underline-offset-2">{{ $t('policies.cookiesMore') }}</RouterLink>
      </p>
      <BaseButton class="mt-4" @click="seen = true">{{ $t('cookies.ok') }}</BaseButton>
    </section>
  </Transition>
</template>

<style scoped>
.cookie-notice-enter-active,
.cookie-notice-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.cookie-notice-enter-from,
.cookie-notice-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
</style>
