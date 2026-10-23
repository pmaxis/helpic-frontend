<script setup lang="ts">
/**
 * The frame of the admin pages: the header with the tabs, and in place of
 * the page a note to turn on two-factor while the admin has it off (the
 * backend refuses them until then).
 */
import { RouterLink, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAdminStore } from '../store'

defineProps<{ description: string }>()

const admin = useAdminStore()
const router = useRouter()

const tabs = [
  { to: '/admin', label: 'admin.tabs.stats' },
  { to: '/admin/users', label: 'admin.tabs.users' },
] as const
</script>

<template>
  <DashboardLayout>
    <PageHeader :title="$t('admin.title')" :description="description">
      <template v-if="admin.canOpen && $slots.actions" #actions>
        <slot name="actions" />
      </template>
    </PageHeader>

    <nav class="mt-4 flex gap-1 border-b border-neutral-200" :aria-label="$t('admin.title')">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors"
        :class="$route.path === tab.to ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'"
      >
        {{ $t(tab.label) }}
      </RouterLink>
    </nav>

    <div class="mt-6">
      <EmptyState v-if="!admin.canOpen" :title="$t('admin.needsTwoFactor')" :description="$t('admin.needsTwoFactorText')">
        <template #icon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </template>
        <BaseButton size="sm" :block="false" @click="router.push('/settings')">{{ $t('admin.openSettings') }}</BaseButton>
      </EmptyState>
      <slot v-else />
    </div>
  </DashboardLayout>
</template>
