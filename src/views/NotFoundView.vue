<script setup lang="ts">
/** A path no page answers to: inside the app when signed in, on the sign-in side when not. */
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NotFoundIllustration from '@/components/illustrations/NotFoundIllustration.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()

/** Where the way back leads: an admin's panel, someone's dashboard, or signing in. */
const home = computed(() => (auth.isAdmin ? '/admin' : auth.isAuthenticated ? '/dashboard' : '/login'))
</script>

<template>
  <DashboardLayout v-if="auth.isAuthenticated" fill>
    <EmptyState class="flex-1 justify-center" :title="$t('notFound.title')" :description="$t('notFound.text')">
      <template #illustration>
        <NotFoundIllustration />
      </template>
      <p class="mb-5 max-w-sm font-mono text-xs break-all text-neutral-400">{{ route.fullPath }}</p>
      <RouterLink
        :to="home"
        class="inline-flex h-9 items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white shadow-xs transition-colors hover:bg-neutral-800 focus:outline-none"
      >
        {{ auth.isAdmin ? $t('notFound.toPanel') : $t('notFound.toDashboard') }}
      </RouterLink>
    </EmptyState>
  </DashboardLayout>

  <AuthLayout v-else>
    <AuthCard :title="$t('notFound.title')" :subtitle="$t('notFound.text')">
      <div class="flex justify-center pb-6">
        <NotFoundIllustration />
      </div>
      <RouterLink
        :to="home"
        class="inline-flex h-10 w-full items-center justify-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white shadow-xs transition-colors hover:bg-neutral-800 focus:outline-none"
      >
        {{ $t('notFound.toSignIn') }}
      </RouterLink>
    </AuthCard>
  </AuthLayout>
</template>
