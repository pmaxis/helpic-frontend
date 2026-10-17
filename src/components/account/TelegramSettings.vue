<script setup lang="ts">
/**
 * Notifications in Telegram: connect the bot with a one-time link, pick which
 * kinds go there, disconnect. While the link is open in Telegram the card
 * checks every few seconds (and when the tab regains focus) whether the chat
 * got connected.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import NotificationKindToggles from '@/components/account/NotificationKindToggles.vue'
import { ApiRequestError } from '@/services/api'
import { createTelegramLink, disconnectTelegram, fetchTelegram, setTelegramKinds } from '@/services/telegram'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import { formatDate } from '@/utils/format'
import type { NotificationKind } from '@/types/notifications'
import type { TelegramLink, TelegramStatus } from '@/types/telegram'

const status = ref<TelegramStatus | null>(null)
const loadFailed = ref(false)

onMounted(async () => {
  try {
    status.value = await fetchTelegram()
  } catch {
    loadFailed.value = true
  }
})

// --- connecting -------------------------------------------------------------------

const connecting = ref(false)
/** The link waiting to be opened in Telegram. */
const pending = ref<TelegramLink | null>(null)
const POLL_MS = 2500
let timer: number | undefined

async function connect() {
  connecting.value = true
  // Opened now, while the click still counts, or the browser blocks it.
  const win = window.open('', '_blank')
  try {
    const link = await createTelegramLink()
    pending.value = link
    if (win) {
      win.opener = null
      win.location.href = link.url
    }
    startWaiting()
  } catch (error) {
    win?.close()
    toast.error(error instanceof ApiRequestError ? error.message : t('notificationSettings.telegram.connectFailed'))
  } finally {
    connecting.value = false
  }
}

function startWaiting() {
  stopWaiting()
  timer = window.setInterval(() => void check(), POLL_MS)
  window.addEventListener('focus', check)
}

function stopWaiting() {
  window.clearInterval(timer)
  window.removeEventListener('focus', check)
}

function cancelWaiting() {
  pending.value = null
  stopWaiting()
}

async function check() {
  if (!pending.value) return
  if (new Date(pending.value.expires_at).getTime() < Date.now()) {
    cancelWaiting()
    toast.info(t('notificationSettings.telegram.expired'))
    return
  }
  try {
    const s = await fetchTelegram()
    if (s.connected) {
      status.value = s
      cancelWaiting()
      toast.success(t('notificationSettings.telegram.connectedToast'))
    }
  } catch {
    // Try again on the next tick.
  }
}

onBeforeUnmount(stopWaiting)

// --- what goes there ------------------------------------------------------------

/** Saves run one after another, so quick toggles land in order. */
let saving = Promise.resolve()

function toggle(kind: NotificationKind, on: boolean) {
  const s = status.value
  if (!s) return
  const previous = s.kinds
  const next = on ? [...previous, kind] : previous.filter((k) => k !== kind)
  s.kinds = next
  saving = saving.then(async () => {
    try {
      status.value = await setTelegramKinds(next)
    } catch (error) {
      s.kinds = previous
      toast.error(error instanceof ApiRequestError ? error.message : t('notificationSettings.saveFailed'))
    }
  })
}

// --- disconnecting ----------------------------------------------------------------

const disconnecting = ref(false)

async function disconnect() {
  disconnecting.value = true
  try {
    await disconnectTelegram()
    status.value = await fetchTelegram()
    toast.success(t('notificationSettings.telegram.disconnected'))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('notificationSettings.telegram.disconnectFailed'))
  } finally {
    disconnecting.value = false
  }
}
</script>

<template>
  <div v-if="!status && !loadFailed" class="h-[92px] animate-pulse rounded-xl bg-neutral-100" aria-busy="true" />

  <section v-else class="rounded-xl border border-neutral-200">
    <div class="flex flex-wrap items-center gap-4 p-5">
      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-[18px] w-[18px]" aria-hidden="true">
          <path d="m22 2-7 20-4-9-9-4z" />
          <path d="M22 2 11 13" />
        </svg>
      </span>

      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-neutral-900">{{ $t('notificationSettings.telegram.title') }}</p>
        <p v-if="loadFailed" class="text-xs text-neutral-500">{{ $t('notificationSettings.loadFailed') }}</p>
        <p v-else-if="!status?.enabled" class="text-xs text-neutral-500">{{ $t('notificationSettings.telegram.notSetUp') }}</p>
        <p v-else-if="status.connected" class="truncate text-xs text-neutral-500">
          <span class="font-medium text-emerald-600">{{ $t('notificationSettings.telegram.connected') }}</span>
          <template v-if="status.username">{{ ' ' + $t('notificationSettings.telegram.as', { name: status.username }) }}</template>
          <template v-if="status.linked_at"> · {{ $t('notificationSettings.telegram.since', { date: formatDate(status.linked_at) }) }}</template>
        </p>
        <i18n-t v-else-if="pending" keypath="notificationSettings.telegram.pressStart" tag="p" class="text-xs text-neutral-500" scope="global">
          <template #start>
            <b class="font-medium text-neutral-700">{{ $t('notificationSettings.telegram.start') }}</b>
          </template>
        </i18n-t>
        <p v-else class="text-xs text-neutral-500">{{ $t('notificationSettings.telegram.intro') }}</p>
      </div>

      <template v-if="status?.enabled">
        <button
          v-if="status.connected"
          type="button"
          class="shrink-0 rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-50"
          :disabled="disconnecting"
          @click="disconnect"
        >
          {{ disconnecting ? $t('notificationSettings.telegram.disconnecting') : $t('notificationSettings.telegram.disconnect') }}
        </button>
        <div v-else-if="pending" class="flex shrink-0 items-center gap-1">
          <a
            :href="pending.url"
            target="_blank"
            rel="noopener noreferrer"
            class="rounded-md px-2 py-1 text-sm font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
          >
            {{ $t('notificationSettings.telegram.open') }}
          </a>
          <button type="button" class="rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900" @click="cancelWaiting">
            {{ $t('common.cancel') }}
          </button>
        </div>
        <BaseButton v-else size="sm" :block="false" :loading="connecting" :disabled="connecting" @click="connect">{{ $t('notificationSettings.telegram.connect') }}</BaseButton>
      </template>
    </div>

    <!-- what goes to the chat -->
    <div v-if="status?.connected" class="border-t border-neutral-100 px-5 py-3">
      <NotificationKindToggles
        :title="$t('notificationSettings.telegram.what')"
        storage-key="telegram"
        :available="status.available"
        :selected="status.kinds"
        @toggle="toggle"
      >
        {{ $t('notificationSettings.telegram.explain') }}
      </NotificationKindToggles>
    </div>
  </section>
</template>
