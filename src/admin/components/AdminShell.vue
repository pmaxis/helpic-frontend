<script setup lang="ts">
/**
 * The frame of the admin pages: the header, and in place of the page a note
 * to turn on two-factor while the admin has it off (the backend refuses them
 * until then). The pages are the admin's sidebar. A page with something open
 * beside it (the side slot) splits in two cards, as a task and its details do.
 */
import { useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import TwoFactorIllustration from '@/components/illustrations/TwoFactorIllustration.vue'
import { useAuthStore } from '@/stores/auth'

defineProps<{
  title: string
  description: string
  /** Let the page fill the window's height, for an empty state in its middle. */
  fill?: boolean
}>()

const auth = useAuthStore()
const router = useRouter()
</script>

<template>
  <DashboardLayout :bare="!!$slots.side && auth.canOpenAdmin" :fill="fill || !auth.canOpenAdmin">
    <div v-if="$slots.side && auth.canOpenAdmin" class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div class="flex min-h-0 flex-col overflow-y-auto rounded-xl border border-neutral-200 bg-white p-5 shadow-xs sm:p-8">
        <PageHeader :title="title" :description="description">
          <template v-if="$slots.actions" #actions>
            <slot name="actions" />
          </template>
        </PageHeader>
        <div class="mt-6 flex flex-1 flex-col">
          <slot />
        </div>
      </div>
      <!-- on a narrow screen the open item comes first -->
      <div class="order-first flex min-h-0 flex-col lg:order-none">
        <slot name="side" />
      </div>
    </div>

    <template v-else>
      <PageHeader :title="title" :description="description">
        <template v-if="auth.canOpenAdmin && $slots.actions" #actions>
          <slot name="actions" />
        </template>
      </PageHeader>

      <div class="mt-6 flex flex-1 flex-col">
        <EmptyState v-if="!auth.canOpenAdmin" class="flex-1 justify-center" :title="$t('admin.needsTwoFactor')" :description="$t('admin.needsTwoFactorText')">
          <template #illustration>
            <TwoFactorIllustration />
          </template>
          <BaseButton size="sm" :block="false" @click="router.push({ name: 'settings', query: { tab: 'security' } })">{{ $t('admin.openSettings') }}</BaseButton>
        </EmptyState>
        <slot v-else />
      </div>
    </template>
  </DashboardLayout>
</template>
