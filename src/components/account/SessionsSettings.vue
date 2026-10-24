<script setup lang="ts">
/** Settings › Security › Devices: where the account is signed in, each signed out on its own or all at once. */
import { computed, onMounted, ref } from 'vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DeviceIcon from '@/components/account/DeviceIcon.vue'
import { ApiRequestError } from '@/services/api'
import { endOtherSessions, endSession, fetchSessions } from '@/services/sessions'
import { toast } from '@/composables/useToasts'
import { t } from '@/i18n'
import { deviceName, formatDate, parseDevice, timeAgo } from '@/utils/format'
import type { Session } from '@/types/auth'

const sessions = ref<Session[]>([])
const sessionsLoaded = ref(false)
const endingId = ref('')
const confirmEndOthers = ref(false)
const endingOthers = ref(false)

const currentSession = computed(() => sessions.value.find((s) => s.current))
const otherSessions = computed(() => sessions.value.filter((s) => !s.current))

/** An active device refreshes its session every 15 minutes, so a recent use means it's in use. */
const RECENT_MS = 15 * 60 * 1000

function isRecent(s: Session): boolean {
  return Date.now() - new Date(s.last_used_at).getTime() < RECENT_MS
}

async function load() {
  try {
    sessions.value = await fetchSessions()
  } catch {
    toast.error(t('settings.sessions.loadFailed'))
  } finally {
    sessionsLoaded.value = true
  }
}

/** Loaded when the tab opens, so it shows what changing the password did. */
onMounted(load)

async function signOut(session: Session) {
  endingId.value = session.id
  try {
    await endSession(session.id)
    sessions.value = sessions.value.filter((s) => s.id !== session.id)
    toast.success(t('settings.sessions.signedOut', { device: deviceName(session.user_agent) }))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('settings.sessions.signOutFailed'))
  } finally {
    endingId.value = ''
  }
}

async function signOutOthers() {
  endingOthers.value = true
  try {
    await endOtherSessions()
    sessions.value = sessions.value.filter((s) => s.current)
    confirmEndOthers.value = false
    toast.success(t('settings.sessions.othersSignedOut'))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('settings.sessions.othersFailed'))
  } finally {
    endingOthers.value = false
  }
}

/** Loads the devices again — after something else signed some out. */
defineExpose({ load })
</script>

<template>
  <section>
    <div class="flex items-end justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold text-neutral-900">{{ $t('settings.groups.devices') }}</h2>
        <p class="mt-0.5 text-sm text-neutral-500">{{ $t('settings.groups.devicesText') }}</p>
      </div>
      <BaseButton
        v-if="otherSessions.length > 1"
        variant="ghost"
        size="sm"
        :block="false"
        class="text-red-600 hover:text-red-700"
        @click="confirmEndOthers = true"
      >
        {{ $t('settings.sessions.signOutAll') }}
      </BaseButton>
    </div>

    <div v-if="!sessionsLoaded" class="mt-3 h-40 animate-pulse rounded-xl bg-neutral-100" aria-busy="true" />

    <ul v-else class="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200">
      <!-- the device looking at the page -->
      <li v-if="currentSession" class="flex items-center gap-3 px-5 py-4">
        <span class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white">
          <DeviceIcon :kind="parseDevice(currentSession.user_agent).kind" class="h-[18px] w-[18px]" />
          <span class="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-neutral-900">{{ deviceName(currentSession.user_agent) }}</p>
          <p class="truncate text-xs text-neutral-500">
            <span class="font-medium text-emerald-600">{{ $t('settings.sessions.activeNow') }}</span>
            <template v-if="currentSession.ip"> · {{ currentSession.ip }}</template>
            · {{ $t('settings.sessions.signedIn', { date: formatDate(currentSession.created_at) }) }}
          </p>
        </div>
        <span class="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">{{
          $t('settings.sessions.thisDevice')
        }}</span>
      </li>

      <!-- everywhere else -->
      <li v-for="s in otherSessions" :key="s.id" class="flex items-center gap-3 px-5 py-4">
        <span class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
          <DeviceIcon :kind="parseDevice(s.user_agent).kind" class="h-5 w-5" />
          <span v-if="isRecent(s)" class="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-neutral-900">{{ deviceName(s.user_agent) }}</p>
          <p class="truncate text-xs text-neutral-500">
            <span v-if="isRecent(s)" class="text-emerald-600">{{ $t('settings.sessions.activeRecently') }}</span>
            <template v-else>{{ $t('settings.sessions.active', { ago: timeAgo(s.last_used_at) }) }}</template>
            <template v-if="s.ip"> · {{ s.ip }}</template>
            <span class="hidden sm:inline"> · {{ $t('settings.sessions.signedIn', { date: formatDate(s.created_at) }) }}</span>
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-50"
          :disabled="endingId === s.id"
          @click="signOut(s)"
        >
          {{ endingId === s.id ? $t('settings.sessions.signingOut') : $t('settings.sessions.signOut') }}
        </button>
      </li>

      <li v-if="!otherSessions.length" class="flex items-center gap-3 px-5 py-4 text-sm text-neutral-500">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.75"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="h-5 w-5 shrink-0 text-emerald-600"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        {{ $t('settings.sessions.onlyHere') }} {{ $t('settings.sessions.onlyHereText') }}
      </li>
    </ul>

    <ConfirmDialog
      v-model:open="confirmEndOthers"
      :title="$t('settings.sessions.confirmOthers')"
      :description="$t('settings.sessions.confirmOthersText', { n: otherSessions.length }, otherSessions.length)"
      :confirm-label="$t('settings.sessions.signOut')"
      :loading="endingOthers"
      @confirm="signOutOthers"
    />
  </section>
</template>
