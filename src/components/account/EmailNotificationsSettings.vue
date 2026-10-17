<script setup lang="ts">
/**
 * Notifications by email: which kinds. They arrive a few minutes after the
 * fact, grouped into one email, and not at all once read in the app.
 */
import { onMounted, ref } from 'vue'
import NotificationKindToggles from '@/components/account/NotificationKindToggles.vue'
import { useAuthStore } from '@/stores/auth'
import { ApiRequestError } from '@/services/api'
import { fetchEmailNotifications, setEmailNotificationKinds, type EmailNotificationPrefs } from '@/services/emailNotifications'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { NotificationKind } from '@/types/notifications'

const auth = useAuthStore()
const prefs = ref<EmailNotificationPrefs | null>(null)
const loadFailed = ref(false)

onMounted(async () => {
  try {
    prefs.value = await fetchEmailNotifications()
  } catch {
    loadFailed.value = true
  }
})

/** Saves run one after another, so quick toggles land in order. */
let saving = Promise.resolve()

function save(next: NotificationKind[]) {
  const p = prefs.value
  if (!p) return
  const previous = p.kinds
  p.kinds = next
  saving = saving.then(async () => {
    try {
      prefs.value = await setEmailNotificationKinds(next)
    } catch (error) {
      p.kinds = previous
      toast.error(error instanceof ApiRequestError ? error.message : t('notificationSettings.saveFailed'))
    }
  })
}

function toggle(kind: NotificationKind, on: boolean) {
  const kinds = prefs.value?.kinds ?? []
  save(on ? [...kinds, kind] : kinds.filter((k) => k !== kind))
}
</script>

<template>
  <div v-if="!prefs && !loadFailed" class="h-[92px] animate-pulse rounded-xl bg-neutral-100" aria-busy="true" />

  <section v-else class="rounded-xl border border-neutral-200">
    <div class="flex flex-wrap items-center gap-4 p-5">
      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-[18px] w-[18px]" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      </span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-neutral-900">{{ $t('notificationSettings.email.title') }}</p>
        <p v-if="loadFailed" class="text-xs text-neutral-500">{{ $t('notificationSettings.loadFailed') }}</p>
        <p v-else-if="!prefs?.kinds.length" class="truncate text-xs text-neutral-500">
          {{ $t('notificationSettings.email.off', { email: auth.user?.email }) }}
        </p>
        <p v-else class="truncate text-xs text-neutral-500">
          <span class="font-medium text-emerald-600">{{ $t('notificationSettings.email.on') }}</span> ·
          {{ $t('notificationSettings.email.to', { email: auth.user?.email }) }}
        </p>
      </div>
      <template v-if="prefs">
        <button
          v-if="prefs.kinds.length"
          type="button"
          class="shrink-0 rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          @click="save([])"
        >
          {{ $t('notificationSettings.email.turnOff') }}
        </button>
        <button
          v-else
          type="button"
          class="shrink-0 rounded-md px-2 py-1 text-sm font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
          @click="save([...prefs.default_kinds])"
        >
          {{ $t('notificationSettings.email.turnOn') }}
        </button>
      </template>
    </div>

    <div v-if="prefs" class="border-t border-neutral-100 px-5 py-3">
      <NotificationKindToggles
        :title="$t('notificationSettings.email.what')"
        storage-key="email"
        :available="prefs.available"
        :selected="prefs.kinds"
        @toggle="toggle"
      >
        {{ $t('notificationSettings.email.explain') }}
      </NotificationKindToggles>
    </div>
  </section>
</template>
