<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import ProfileSettings from '@/components/account/ProfileSettings.vue'
import SignInSettings from '@/components/account/SignInSettings.vue'
import SessionsSettings from '@/components/account/SessionsSettings.vue'
import TelegramIntegration from '@/components/account/TelegramIntegration.vue'
import TwoFactorSettings from '@/components/account/TwoFactorSettings.vue'
import NotificationMatrix from '@/components/account/NotificationMatrix.vue'
import DeleteAccountSettings from '@/components/account/DeleteAccountSettings.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

/** Four groups: who you are, how and where you sign in, what you hear about, and the apps Helpic works with. */
const ALL_TABS = [{ value: 'profile' }, { value: 'security' }, { value: 'notifications' }, { value: 'integrations' }] as const
type Tab = (typeof ALL_TABS)[number]['value']
/** An admin has no work to hear about or act on, so no notifications or integrations. */
const TABS = computed(() => (auth.isAdmin ? ALL_TABS.filter((t) => t.value === 'profile' || t.value === 'security') : ALL_TABS))

/** The old tabs, still in links (an email confirmation goes to ?tab=email), now live under security. */
const MOVED: Record<string, Tab> = { email: 'security', password: 'security', sessions: 'security' }

/** The open tab lives in the URL (?tab=security) so it survives a reload and can be linked to. */
const tab = computed<Tab>({
  get: () => {
    const q = String(route.query.tab ?? '')
    return TABS.value.find((t) => t.value === q)?.value ?? MOVED[q] ?? 'profile'
  },
  set: (value) => void router.replace({ query: { ...route.query, tab: value === 'profile' ? undefined : value } }),
})

const sessions = ref<InstanceType<typeof SessionsSettings> | null>(null)
</script>

<template>
  <DashboardLayout>
    <PageHeader :title="$t('settings.title')" />

    <nav class="mt-5 flex gap-6 overflow-x-auto border-b border-neutral-200" :aria-label="$t('settings.sections')">
      <button
        v-for="item in TABS"
        :key="item.value"
        type="button"
        class="-mb-px shrink-0 border-b-2 pb-2.5 text-sm font-medium whitespace-nowrap transition-colors"
        :class="tab === item.value ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'"
        :aria-current="tab === item.value ? 'page' : undefined"
        @click="tab = item.value"
      >
        {{ $t(`settings.tabs.${item.value}`) }}
      </button>
    </nav>

    <div class="mt-6">
      <div class="min-w-0 space-y-8">
        <ProfileSettings v-if="tab === 'profile'" />

        <template v-else-if="tab === 'security'">
          <SignInSettings />
          <!-- turning it on signs the other devices out -->
          <TwoFactorSettings @enabled="sessions?.load()" />
          <SessionsSettings ref="sessions" />
          <!-- admin accounts are the server cli's to remove -->
          <DeleteAccountSettings v-if="!auth.isAdmin" />
        </template>

        <section v-else-if="tab === 'integrations'">
          <h2 class="text-base font-semibold text-neutral-900">{{ $t('settings.groups.integrations') }}</h2>
          <div class="mt-3 space-y-3">
            <TelegramIntegration />
          </div>
        </section>

        <section v-else>
          <h2 class="text-base font-semibold text-neutral-900">{{ $t('settings.groups.channels') }}</h2>
          <div class="mt-3">
            <NotificationMatrix />
          </div>
        </section>
      </div>
    </div>
  </DashboardLayout>
</template>
