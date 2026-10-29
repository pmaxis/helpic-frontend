<script setup lang="ts">
/**
 * What the user hears about, and where: one row per kind of notification, in
 * groups, one column per channel — the app's bell, email, and Telegram on a
 * server with a bot. An "i" by email's and Telegram's names tells where they
 * go: the email address, the Telegram account. Telegram's column waits, switched off,
 * until the bot is connected under Integrations. The first row turns a whole
 * channel off, or back on to its defaults.
 */
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import InfoHint from '@/components/ui/InfoHint.vue'
import { useAuthStore } from '@/stores/auth'
import { useTelegram } from '@/composables/useTelegram'
import { ApiRequestError } from '@/services/api'
import {
  fetchAppNotifications,
  fetchEmailNotifications,
  setAppNotificationKinds,
  setEmailNotificationKinds,
  type AppNotificationPrefs,
  type EmailNotificationPrefs,
} from '@/services/emailNotifications'
import { NOTIFICATION_GROUPS, type NotificationKindInfo } from '@/constants/notifications'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import type { NotificationKind } from '@/types/notifications'

const auth = useAuthStore()
const telegram = useTelegram()

// --- the bell and email --------------------------------------------------------

type Prefs = AppNotificationPrefs | EmailNotificationPrefs

const app = ref<AppNotificationPrefs | null>(null)
const email = ref<EmailNotificationPrefs | null>(null)
const loadFailed = ref(false)

onMounted(async () => {
  try {
    ;[app.value, email.value] = await Promise.all([fetchAppNotifications(), fetchEmailNotifications()])
  } catch {
    loadFailed.value = true
  }
})

/** Saves run one after another, so quick toggles land in order. */
let saving = Promise.resolve()

/** Shows the new kinds at once, and puts them back if the server refuses. */
function save<P extends Prefs>(prefs: typeof app | typeof email, send: (kinds: NotificationKind[]) => Promise<P>, next: NotificationKind[]) {
  const p = prefs.value
  if (!p) return
  const previous = p.kinds
  p.kinds = next
  saving = saving.then(async () => {
    try {
      prefs.value = await send(next)
    } catch (error) {
      p.kinds = previous
      toast.error(error instanceof ApiRequestError ? error.message : t('notificationSettings.saveFailed'))
    }
  })
}

function toggled(kinds: NotificationKind[], kind: NotificationKind, on: boolean): NotificationKind[] {
  return on ? [...kinds, kind] : kinds.filter((k) => k !== kind)
}

const saveApp = (next: NotificationKind[]) => save(app, setAppNotificationKinds, next)
const saveEmail = (next: NotificationKind[]) => save(email, setEmailNotificationKinds, next)

// --- the table ------------------------------------------------------------------

const tg = computed(() => telegram.status.value)
/** Telegram has a column on a server with a bot; it's live once the chat is connected. */
const showTelegram = computed(() => !!tg.value?.enabled)
const telegramLive = computed(() => !!tg.value?.connected)

const loading = computed(() => (!email.value && !loadFailed.value) || (!tg.value && !telegram.loadFailed.value))

function fits(k: NotificationKindInfo): boolean {
  if (k.for === 'freelancer') return auth.isFreelancer
  if (k.for === 'owner') return auth.isTeamOwner
  if (k.for === 'parties') return auth.isFreelancer || auth.isTeamOwner
  if (k.for === 'client') return auth.isClient
  return true
}

function offered(kind: NotificationKind): boolean {
  return [app.value, email.value, showTelegram.value ? tg.value : null].some((p) => p?.available.includes(kind))
}

/** The kinds this user can get, in their groups. */
const groups = computed(() =>
  NOTIFICATION_GROUPS.map((g) => ({ ...g, kinds: g.kinds.filter((k) => fits(k) && offered(k.kind)) })).filter((g) => g.kinds.length),
)

const visible = computed(() => groups.value.flatMap((g) => g.kinds.map((k) => k.kind)))

/** One column per channel after the kinds'. */
const grid = computed(() => (showTelegram.value ? 'grid-cols-[minmax(0,1fr)_repeat(3,5.5rem)]' : 'grid-cols-[minmax(0,1fr)_repeat(2,5.5rem)]'))

/** A channel is on while any kind this user can get goes there. */
function onIn(kinds: NotificationKind[]): boolean {
  return visible.value.some((k) => kinds.includes(k))
}

function label(kind: NotificationKind, channel: string): string {
  return t('notificationSettings.inChannel', { kind: t(`notificationKinds.${kind}`), channel })
}
</script>

<template>
  <div v-if="loading" class="h-64 animate-pulse rounded-xl bg-neutral-100" aria-busy="true" />

  <div v-else class="overflow-x-auto rounded-xl border border-neutral-200 bg-white" role="table" :aria-label="$t('settings.groups.channels')">
    <!-- the channels, each with where it goes -->
    <div class="grid items-start gap-x-2 border-b border-neutral-200 px-5 py-3" :class="grid" role="row">
      <span class="pt-px text-xs font-medium tracking-wide text-neutral-500 uppercase" role="columnheader">{{ $t('notificationSettings.event') }}</span>

      <div class="flex min-w-0 flex-col items-center text-center" role="columnheader">
        <span class="text-xs font-medium text-neutral-900">{{ $t('notificationSettings.app.title') }}</span>
      </div>

      <div class="flex min-w-0 flex-col items-center text-center" role="columnheader">
        <span class="inline-flex items-center gap-1 text-xs font-medium text-neutral-900">
          {{ $t('notificationSettings.email.title') }}
          <InfoHint v-if="auth.user?.email" :text="auth.user.email" :label="$t('notificationSettings.where')" />
        </span>
      </div>

      <div v-if="showTelegram" class="flex min-w-0 flex-col items-center text-center" role="columnheader">
        <span class="inline-flex items-center gap-1 text-xs font-medium text-neutral-900">
          {{ $t('notificationSettings.telegram.title') }}
          <InfoHint v-if="telegramLive && tg?.username" :text="tg.username" :label="$t('notificationSettings.where')" align="right" />
          <!-- not connected yet: to Integrations, where the bot is connected -->
          <RouterLink
            v-if="!telegramLive"
            :to="{ query: { tab: 'integrations' } }"
            class="inline-flex h-4 w-4 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900/20"
            :aria-label="$t('notificationSettings.telegram.toIntegrations')"
            :title="$t('notificationSettings.telegram.toIntegrations')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5" aria-hidden="true">
              <path d="M9 17H7A5 5 0 0 1 7 7h2" />
              <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
              <line x1="8" x2="16" y1="12" y2="12" />
            </svg>
          </RouterLink>
        </span>
      </div>
    </div>

    <!-- a whole channel off, or back on to its defaults -->
    <div class="grid items-center gap-x-2 border-b border-neutral-200 px-5 py-2" :class="grid" role="row">
      <span class="text-sm font-medium text-neutral-900" role="rowheader">{{ $t('notificationSettings.all') }}</span>
      <span class="flex justify-center" role="cell">
        <ToggleSwitch
          v-if="app"
          :model-value="onIn(app.kinds)"
          :label="$t('notificationSettings.allIn', { channel: $t('notificationSettings.app.title') })"
          @update:model-value="saveApp($event ? [...app.default_kinds] : [])"
        />
      </span>
      <span class="flex justify-center" role="cell">
        <ToggleSwitch
          v-if="email"
          :model-value="onIn(email.kinds)"
          :label="$t('notificationSettings.allIn', { channel: $t('notificationSettings.email.title') })"
          @update:model-value="saveEmail($event ? [...email.default_kinds] : [])"
        />
      </span>
      <span v-if="showTelegram" class="flex justify-center" role="cell">
        <ToggleSwitch
          v-if="tg"
          :model-value="telegramLive && onIn(tg.kinds)"
          :disabled="!telegramLive"
          :label="$t('notificationSettings.allIn', { channel: $t('notificationSettings.telegram.title') })"
          @update:model-value="telegram.setKinds($event ? [...tg.default_kinds] : [])"
        />
      </span>
    </div>

    <p v-if="loadFailed || telegram.loadFailed.value" class="border-b border-neutral-100 px-5 py-2 text-xs text-red-600">
      {{ $t('notificationSettings.loadFailed') }}
    </p>

    <div v-for="g in groups" :key="g.group" role="rowgroup">
      <p class="bg-neutral-50 px-5 py-1.5 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">{{ $t(`notificationKinds.groups.${g.group}`) }}</p>
      <div v-for="k in g.kinds" :key="k.kind" class="grid items-center gap-x-2 border-t border-neutral-100 px-5 py-2" :class="grid" role="row">
        <span class="text-sm text-neutral-700" role="rowheader">{{ $t(`notificationKinds.${k.kind}`) }}</span>
        <span class="flex justify-center" role="cell">
          <ToggleSwitch
            v-if="app?.available.includes(k.kind)"
            :model-value="app.kinds.includes(k.kind)"
            :label="label(k.kind, $t('notificationSettings.app.title'))"
            @update:model-value="saveApp(toggled(app.kinds, k.kind, $event))"
          />
          <span v-else class="text-neutral-300" aria-hidden="true">—</span>
        </span>
        <span class="flex justify-center" role="cell">
          <ToggleSwitch
            v-if="email?.available.includes(k.kind)"
            :model-value="email.kinds.includes(k.kind)"
            :label="label(k.kind, $t('notificationSettings.email.title'))"
            @update:model-value="saveEmail(toggled(email.kinds, k.kind, $event))"
          />
          <span v-else class="text-neutral-300" aria-hidden="true">—</span>
        </span>
        <span v-if="showTelegram" class="flex justify-center" role="cell">
          <ToggleSwitch
            v-if="tg?.available.includes(k.kind)"
            :model-value="telegramLive && tg.kinds.includes(k.kind)"
            :disabled="!telegramLive"
            :label="label(k.kind, $t('notificationSettings.telegram.title'))"
            @update:model-value="telegram.toggle(k.kind, $event)"
          />
          <span v-else class="text-neutral-300" aria-hidden="true">—</span>
        </span>
      </div>
    </div>
  </div>
</template>
