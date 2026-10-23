<script setup lang="ts">
/**
 * One account in full, in a panel from the right: who they are, their team,
 * how much they have done (counts only) and the days they used Helpic.
 * Escape or the backdrop closes it.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDate, formatDuration, timeAgo } from '@/utils/format'
import { timeAgoDay } from '../chart'
import { LOCALE_NAMES } from '@/i18n'
import { toast } from '@/composables/useToasts'
import ActivityHeatmap from './ActivityHeatmap.vue'
import AccountAvatar from './AccountAvatar.vue'
import { fetchAdminAccount } from '../api'
import type { AdminAccountDetail } from '../types'

const props = defineProps<{ id: string }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

const account = ref<AdminAccountDetail | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)

async function load() {
  account.value = null
  try {
    account.value = await fetchAdminAccount(props.id)
  } catch {
    toast.error(t('admin.loadFailed'))
    emit('close')
  }
}
watch(() => props.id, load, { immediate: true })

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  closeButton.value?.focus()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

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
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex justify-end">
      <div class="absolute inset-0 bg-black/30 backdrop-blur-[1px]" @click="emit('close')" />
      <aside
        role="dialog"
        aria-modal="true"
        :aria-label="account?.name || account?.email || $t('admin.account.title')"
        class="relative flex h-full w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-xl"
      >
        <header class="flex shrink-0 items-start gap-3 border-b border-neutral-200 px-5 py-4">
          <template v-if="account">
            <AccountAvatar :name="account.name" :email="account.email" size="lg" />
            <div class="min-w-0 flex-1">
              <h2 class="truncate text-base font-semibold text-neutral-900">{{ account.name || account.email }}</h2>
              <p class="truncate text-sm text-neutral-500">{{ account.email }}</p>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">{{ $t(`admin.roles.${account.role}`) }}</span>
                <span v-if="account.two_factor" class="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">2FA</span>
                <span v-if="account.telegram" class="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">Telegram</span>
                <span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">{{ LOCALE_NAMES[account.locale] }} · {{ account.currency }}</span>
              </div>
            </div>
          </template>
          <div v-else class="flex-1 space-y-2" aria-hidden="true">
            <div class="h-4 w-40 animate-pulse rounded bg-neutral-100" />
            <div class="h-3 w-56 animate-pulse rounded bg-neutral-100" />
          </div>
          <button
            ref="closeButton"
            type="button"
            class="shrink-0 rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
            :aria-label="$t('ui.close')"
            @click="emit('close')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div v-if="account" class="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
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
              <div class="flex justify-between gap-4">
                <dt class="text-neutral-500">{{ $t('admin.account.sessions') }}</dt>
                <dd class="text-neutral-900 tabular-nums">{{ account.sessions }}</dd>
              </div>
            </dl>
          </section>

          <p class="text-[11px] text-neutral-400">{{ $t('admin.account.privacy') }}</p>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

