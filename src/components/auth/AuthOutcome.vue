<script setup lang="ts">
/** A finished auth screen: what happened, what to do next, and one action. */
import { RouterLink } from 'vue-router'
import AuthCard from '@/components/auth/AuthCard.vue'

export type OutcomeStep = {
  title: string
  text: string
  icon: 'mail' | 'enter'
}

defineProps<{
  title: string
  subtitle: string
  steps: OutcomeStep[]
  actionTo: string
  actionLabel: string
}>()
</script>

<template>
  <AuthCard :title="title" :subtitle="subtitle">
    <div class="space-y-5">
      <ul class="divide-y divide-neutral-200 overflow-hidden rounded-xl ring-1 ring-neutral-200">
        <li v-for="step in steps" :key="step.title" class="flex gap-3 bg-neutral-50/80 px-3.5 py-3.5">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-neutral-700 shadow-sm ring-1 ring-neutral-200">
            <svg v-if="step.icon === 'mail'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" x2="3" y1="12" y2="12" />
            </svg>
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-medium text-neutral-900">{{ step.title }}</span>
            <span class="mt-0.5 block text-sm leading-relaxed text-neutral-500">{{ step.text }}</span>
          </span>
        </li>
      </ul>

      <div class="pt-1">
        <RouterLink
          :to="actionTo"
          class="inline-flex h-10 w-full items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white shadow-xs transition-colors hover:bg-neutral-800 focus:outline-none"
        >
          {{ actionLabel }}
        </RouterLink>
        <slot />
      </div>
    </div>
  </AuthCard>
</template>
