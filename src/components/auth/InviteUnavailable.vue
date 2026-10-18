<script setup lang="ts">
/** Shown when an invite link is dead, or the lookup itself failed. */
import { RouterLink } from 'vue-router'
import AuthCard from '@/components/auth/AuthCard.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

defineProps<{
  /** The server's reason, or a generic load failure. */
  message: string
  /** The link is invalid, already used, or expired. */
  gone?: boolean
}>()

function retry() {
  window.location.reload()
}
</script>

<template>
  <AuthCard :title="$t('invite.unavailable')" :subtitle="message">
    <div class="space-y-5">
      <ul v-if="gone" class="divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
        <li class="flex gap-3 bg-neutral-50/80 px-3.5 py-3.5">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-neutral-700 shadow-sm ring-1 ring-neutral-200">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-medium text-neutral-900">{{ $t('invite.next.ask.title') }}</span>
            <span class="mt-0.5 block text-sm leading-relaxed text-neutral-500">{{ $t('invite.next.ask.text') }}</span>
          </span>
        </li>
        <li class="flex gap-3 bg-neutral-50/80 px-3.5 py-3.5">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-neutral-700 shadow-sm ring-1 ring-neutral-200">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" x2="3" y1="12" y2="12" />
            </svg>
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-medium text-neutral-900">{{ $t('invite.next.account.title') }}</span>
            <span class="mt-0.5 block text-sm leading-relaxed text-neutral-500">{{ $t('invite.next.account.text') }}</span>
          </span>
        </li>
      </ul>

      <div class="pt-1">
        <RouterLink
          v-if="gone"
          to="/login"
          class="inline-flex h-10 w-full items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white shadow-xs transition-colors hover:bg-neutral-800 focus:outline-none"
        >
          {{ $t('invite.goToSignIn') }}
        </RouterLink>
        <BaseButton v-else type="button" class="h-10" @click="retry">{{ $t('invite.tryAgain') }}</BaseButton>
      </div>
    </div>

    <template v-if="!gone" #footer>
      <RouterLink to="/login" class="font-medium text-neutral-900 underline-offset-4 hover:underline">{{ $t('invite.goToSignIn') }}</RouterLink>
    </template>
  </AuthCard>
</template>
