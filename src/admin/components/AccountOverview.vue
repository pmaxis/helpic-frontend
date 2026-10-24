<script setup lang="ts">
/**
 * An account's overview in the admin's card: the rate limits holding it
 * back, the days it used Helpic, its team, how much it has done (counts
 * only), when it joined and signed in, and the devices it's signed in on.
 */
import { useI18n } from 'vue-i18n'
import { deviceName, formatDate, formatDuration, parseDevice, timeAgo } from '@/utils/format'
import { timeAgoDay } from '../chart'
import DeviceIcon from '@/components/account/DeviceIcon.vue'
import ActivityHeatmap from './ActivityHeatmap.vue'
import { untilText } from '../limits'
import type { AdminAccountDetail, AdminLimit, AdminSession } from '../types'

defineProps<{
  account: AdminAccountDetail
  /** null while they load. */
  sessions: AdminSession[] | null
  limits: AdminLimit[]
  /** The limit being lifted, as "scope key". */
  clearing: string | null
}>()
const emit = defineEmits<{
  clear: [limit: AdminLimit]
  end: [session: AdminSession]
}>()
const { t } = useI18n()

/** The account's counts, in the order the panel shows them. */
function usage(a: AdminAccountDetail): { label: string; value: string | number }[] {
  return [
    { label: t(a.role === 'client' ? 'admin.account.freelancers' : 'admin.account.clients'), value: a.partners },
    { label: t('admin.columns.projects'), value: a.projects },
    { label: t('admin.columns.tasks'), value: a.tasks },
    { label: t('admin.account.comments'), value: a.comments },
    { label: t('admin.account.reportsSent'), value: a.reports_sent },
    { label: t('admin.account.reportsPaid'), value: a.reports_paid },
    { label: t('admin.account.timeLogged'), value: a.seconds_logged ? formatDuration(a.seconds_logged) : '–' },
  ]
}
</script>

<template>
  <div class="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
    <section v-if="limits.length" class="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
      <h3 class="text-xs font-semibold text-amber-700">{{ $t('admin.limits.inAccount') }}</h3>
      <ul class="mt-2 space-y-2">
        <li v-for="l in limits" :key="l.scope + ' ' + l.key" class="flex items-start justify-between gap-3">
          <div class="min-w-0 text-sm">
            <p class="font-medium text-neutral-900">{{ $t(`admin.limits.scopes.${l.scope}`) }}</p>
            <p class="text-xs text-amber-700 tabular-nums">
              {{ untilText(l.opens_at) }}<template v-if="l.ip"> · {{ l.ip }}</template>
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-neutral-900 ring-1 ring-neutral-200 transition-colors ring-inset hover:bg-neutral-100 disabled:opacity-50"
            :disabled="clearing === l.scope + ' ' + l.key"
            @click="emit('clear', l)"
          >
            {{ $t('admin.limits.clear') }}
          </button>
        </li>
      </ul>
    </section>

    <section>
      <h3 class="text-xs font-semibold text-neutral-900">{{ $t('admin.account.activity') }}</h3>
      <p class="mt-0.5 text-xs text-neutral-500">
        {{ $t('admin.account.activeDays', { n: account.active_on.length }, account.active_on.length) }} ·
        {{ account.last_active ? $t('admin.account.lastActive', { when: timeAgoDay(account.last_active) }) : $t('admin.never') }}
      </p>
      <div class="mt-3"><ActivityHeatmap :since="account.active_since" :days="account.active_on" /></div>
    </section>

    <section v-if="account.team">
      <h3 class="text-xs font-semibold text-neutral-900">{{ $t('admin.account.team') }}</h3>
      <p class="mt-1 text-sm text-neutral-700">
        {{ account.team.name || $t('admin.account.unnamedTeam') }}
        <span class="text-neutral-400">· {{ $t(`admin.account.teamRoles.${account.team.role}`) }} · {{ $t('admin.account.members', { n: account.team.members }, account.team.members) }}</span>
      </p>
    </section>

    <section>
      <h3 class="text-xs font-semibold text-neutral-900">{{ $t('admin.account.usage') }}</h3>
      <dl class="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-neutral-200 bg-neutral-200">
        <div v-for="item in usage(account)" :key="item.label" class="bg-white px-3 py-2.5 odd:last:col-span-2">
          <dt class="text-[11px] text-neutral-500">{{ item.label }}</dt>
          <dd class="mt-0.5 text-sm font-semibold text-neutral-900">{{ item.value }}</dd>
        </div>
      </dl>
    </section>

    <section>
      <h3 class="text-xs font-semibold text-neutral-900">{{ $t('admin.account.access') }}</h3>
      <dl class="mt-2 space-y-1.5 text-sm">
        <div class="flex justify-between gap-4">
          <dt class="text-neutral-500">{{ $t('admin.account.joined') }}</dt>
          <dd class="text-neutral-900">{{ formatDate(account.created_at) }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-neutral-500">{{ $t('admin.account.lastSignIn') }}</dt>
          <dd class="text-neutral-900">{{ account.last_sign_in ? timeAgo(account.last_sign_in) : $t('admin.never') }}</dd>
        </div>
      </dl>
    </section>

    <section>
      <h3 class="text-xs font-semibold text-neutral-900">
        {{ $t('admin.account.sessions') }} <span class="font-normal text-neutral-400 tabular-nums">{{ account.sessions }}</span>
      </h3>
      <div v-if="!sessions" class="mt-2 space-y-2" aria-hidden="true">
        <div v-for="i in 2" :key="i" class="h-12 animate-pulse rounded-lg bg-neutral-100" />
      </div>
      <p v-else-if="!sessions.length" class="mt-1 text-sm text-neutral-500">{{ $t('admin.account.noSessions') }}</p>
      <ul v-else class="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
        <li v-for="s in sessions" :key="s.id" class="flex items-center gap-3 px-3 py-2.5">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
            <DeviceIcon :kind="parseDevice(s.user_agent).kind" class="h-4 w-4" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-neutral-900">{{ deviceName(s.user_agent) }}</p>
            <p class="truncate text-xs text-neutral-500">
              {{ $t('admin.account.activeAgo', { when: timeAgo(s.last_used_at) }) }}<template v-if="s.ip"> · {{ s.ip }}</template>
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600"
            @click="emit('end', s)"
          >
            {{ $t('admin.account.endSession') }}
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
