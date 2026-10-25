<script setup lang="ts">
/**
 * Telegram as an integration: the Helpic bot, connected with a one-time link
 * or disconnected here, and what it does once it is — notifications, and acting
 * on them from the chat. Which notifications go there is picked under
 * Notifications.
 */
import { RouterLink } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useTelegram } from '@/composables/useTelegram'
import { formatDate } from '@/utils/format'

const { status, loadFailed, connecting, pending, connect, cancelWaiting, disconnecting, disconnect } = useTelegram()

/** What the bot does, each with its icon's paths. */
const CAN = [
  { key: 'notify', icon: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'] },
  { key: 'reply', icon: ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'] },
  { key: 'timer', icon: ['M10 2h4', 'M12 14l3-3', 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z'] },
  { key: 'task', icon: ['M12 5v14', 'M5 12h14'] },
  { key: 'approve', icon: ['M20 6 9 17l-5-5'] },
] as const
</script>

<template>
  <div v-if="!status && !loadFailed" class="h-[92px] animate-pulse rounded-xl bg-neutral-100" aria-busy="true" />

  <section v-else class="rounded-xl border border-neutral-200" aria-labelledby="integration-telegram">
    <div class="flex flex-wrap items-center gap-4 p-5">
      <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-[18px] w-[18px]" aria-hidden="true">
          <path d="m22 2-7 20-4-9-9-4z" />
          <path d="M22 2 11 13" />
        </svg>
      </span>

      <div class="min-w-0 flex-1">
        <p id="integration-telegram" class="text-sm font-medium text-neutral-900">{{ $t('notificationSettings.telegram.title') }}</p>
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
        <p v-else class="text-xs text-neutral-500">{{ $t('integrations.telegram.tagline') }}</p>
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

    <!-- what the bot does -->
    <div v-if="status?.enabled" class="border-t border-neutral-100 px-5 py-4">
      <h3 class="text-xs font-semibold tracking-wide text-neutral-500 uppercase">{{ $t('integrations.telegram.can') }}</h3>
      <ul class="mt-3 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
        <li v-for="item in CAN" :key="item.key" class="flex items-start gap-2.5 text-sm text-neutral-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 h-4 w-4 shrink-0 text-sky-500" aria-hidden="true">
            <path v-for="d in item.icon" :key="d" :d="d" />
          </svg>
          {{ $t(`integrations.telegram.does.${item.key}`) }}
        </li>
      </ul>
      <p class="mt-4 text-xs text-neutral-500">
        {{ $t('integrations.telegram.commands') }}
        <code class="rounded bg-neutral-100 px-1 py-px text-neutral-700">/timer</code>
        <code class="rounded bg-neutral-100 px-1 py-px text-neutral-700">/help</code>
        <code class="rounded bg-neutral-100 px-1 py-px text-neutral-700">/stop</code>
      </p>
      <p v-if="status.connected" class="mt-2 text-xs text-neutral-500">
        {{ $t('integrations.telegram.kinds') }}
        <RouterLink :to="{ query: { tab: 'notifications' } }" class="font-medium text-neutral-700 underline-offset-4 hover:text-neutral-900 hover:underline">
          {{ $t('integrations.telegram.toNotifications') }}
        </RouterLink>
      </p>
    </div>
  </section>
</template>
