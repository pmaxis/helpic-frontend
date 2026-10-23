<script setup lang="ts">
/**
 * The frame of the admin pages: the header, and in place of the page a note
 * to turn on two-factor while the admin has it off (the backend refuses them
 * until then). The pages are the admin's sidebar.
 */
import { useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAuthStore } from '@/stores/auth'

defineProps<{ title: string; description: string }>()

const auth = useAuthStore()
const router = useRouter()
</script>

<template>
  <DashboardLayout>
    <PageHeader :title="title" :description="description">
      <template v-if="auth.canOpenAdmin && $slots.actions" #actions>
        <slot name="actions" />
      </template>
    </PageHeader>

    <div class="mt-6">
      <EmptyState v-if="!auth.canOpenAdmin" :title="$t('admin.needsTwoFactor')" :description="$t('admin.needsTwoFactorText')">
        <template #icon>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </template>
        <BaseButton size="sm" :block="false" @click="router.push({ name: 'settings', query: { tab: 'security' } })">{{ $t('admin.openSettings') }}</BaseButton>
      </EmptyState>
      <slot v-else />
    </div>
  </DashboardLayout>
</template>
