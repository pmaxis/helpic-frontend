<script setup lang="ts">
/**
 * One account in full, in a card beside the accounts list, as a task's
 * details sit beside the task: who they are, their team, how much they have
 * done (counts only), the days they used Helpic, the devices they're signed
 * in on, each one signed out on its own, and the rate limits holding them
 * back, each lifted at once; on a tab of its own the
 * account's history, what admins did to it; and under both what an admin can
 * do to it, each asked for a reason and the admin's two-factor code again,
 * and recorded. Escape or the close button
 * closes it.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { deviceName, formatDate, formatDuration, parseDevice, timeAgo } from '@/utils/format'
import { timeAgoDay } from '../chart'
import { intlLocale, LOCALE_NAMES } from '@/i18n'
import { toast } from '@/composables/useToasts'
import Modal from '@/components/ui/Modal.vue'
import Pagination from '@/components/ui/Pagination.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import HistoryIllustration from '@/components/illustrations/HistoryIllustration.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import TwoFactorCodeInput from '@/components/auth/TwoFactorCodeInput.vue'
import { ApiRequestError } from '@/services/api'
import DeviceIcon from '@/components/account/DeviceIcon.vue'
import ActivityHeatmap from './ActivityHeatmap.vue'
import AccountAvatar from './AccountAvatar.vue'
import { actOnAccount, clearAdminLimit, endAccountSession, fetchAccountSessions, fetchAdminAccount, fetchAdminActions, fetchAdminLimits } from '../api'
import { untilText } from '../limits'
import type { AdminAccountDetail, AdminAction, AdminActionPath, AdminLimit, AdminSession } from '../types'

const props = defineProps<{ id: string }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const { t } = useI18n()

const account = ref<AdminAccountDetail | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)

const TABS = ['overview', 'history'] as const
const tab = ref<(typeof TABS)[number]>('overview')

const HISTORY = 10
const history = ref<AdminAction[] | null>(null)
const historyTotal = ref(0)
const historyPage = ref(1)

const card = 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs'

async function loadHistory() {
  try {
    const page = await fetchAdminActions({ target: props.id, page: historyPage.value, limit: HISTORY })
    history.value = page.actions
    historyTotal.value = page.total
  } catch {
    history.value = []
    toast.error(t('admin.loadFailed'))
  }
}
watch(historyPage, loadHistory)

/** The devices and the limits, loaded beside the account and again after each change. */
const sessions = ref<AdminSession[] | null>(null)
const limits = ref<AdminLimit[]>([])

async function loadAccess() {
  try {
    const [s, l] = await Promise.all([fetchAccountSessions(props.id), fetchAdminLimits({ account: props.id })])
    sessions.value = s
    limits.value = l
  } catch {
    sessions.value = []
    toast.error(t('admin.loadFailed'))
  }
}

/** Something changed the account: its history and its access are new. */
function refreshAfterChange() {
  emit('changed')
  void loadAccess()
  if (historyPage.value === 1) void loadHistory()
  else historyPage.value = 1
}

async function load() {
  account.value = null
  history.value = null
  sessions.value = null
  limits.value = []
  tab.value = 'overview'
  try {
    account.value = await fetchAdminAccount(props.id)
  } catch {
    toast.error(t('admin.loadFailed'))
    emit('close')
    return
  }
  void loadAccess()
  if (historyPage.value === 1) void loadHistory()
  else historyPage.value = 1
}
watch(() => props.id, load, { immediate: true })

// --- what an admin can do ------------------------------------------------------------

const ACTIONS: Record<AdminActionPath, { label: string; text: string; tone: 'danger' | 'primary' }> = {
  block: { label: 'admin.manage.block', text: 'admin.manage.blockText', tone: 'danger' },
  unblock: { label: 'admin.manage.unblock', text: 'admin.manage.unblockText', tone: 'primary' },
  'end-sessions': { label: 'admin.manage.endSessions', text: 'admin.manage.endSessionsText', tone: 'danger' },
  'reset-two-factor': { label: 'admin.manage.resetTwoFactor', text: 'admin.manage.resetTwoFactorText', tone: 'danger' },
}

/** The actions that would change something now, for the bar under the card: blocking first. */
const available = computed<AdminActionPath[]>(() => {
  const a = account.value
  if (!a) return []
  const out: AdminActionPath[] = [a.blocked_at ? 'unblock' : 'block']
  if (a.sessions > 0) out.push('end-sessions')
  if (a.two_factor) out.push('reset-two-factor')
  return out
})

/** The dot of each action in the history. */
const DOTS: Record<AdminAction['action'], string> = {
  block: 'bg-red-500',
  unblock: 'bg-emerald-500',
  end_sessions: 'bg-amber-500',
  reset_two_factor: 'bg-amber-500',
  retry_email: 'bg-sky-500',
  resend_signup: 'bg-sky-500',
  delete_signup: 'bg-neutral-400',
  end_session: 'bg-amber-500',
  clear_limit: 'bg-sky-500',
}

const dateTime = computed(() => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))
const formatDateTime = (iso: string) => dateTime.value.format(new Date(iso))

/** How each action's button looks: blocking red, unblocking green, the rest plain. */
const TONES: Record<AdminActionPath, string> = {
  block: 'bg-red-50 text-red-700 ring-red-200 hover:bg-red-100',
  unblock: 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100',
  'end-sessions': 'bg-white text-neutral-700 ring-neutral-200 hover:bg-neutral-100 hover:text-neutral-900',
  'reset-two-factor': 'bg-white text-neutral-700 ring-neutral-200 hover:bg-neutral-100 hover:text-neutral-900',
}

const asking = ref<AdminActionPath | null>(null)
const reason = ref('')
/** The admin's two-factor code, asked again for every change: a stolen session can't make one. */
const code = ref('')
const codeError = ref('')
const acting = ref(false)

function ask(action: AdminActionPath) {
  asking.value = action
  reason.value = ''
  code.value = ''
  codeError.value = ''
}

/** A refused code stays in the question, to try again; anything else is a toast. */
function failed(e: unknown) {
  if (e instanceof ApiRequestError && (e.fields?.code || e.status === 429)) {
    codeError.value = e.fields?.code ?? e.message
    return
  }
  toast.error(t('admin.manage.failed'))
}

async function act() {
  if (!asking.value || !account.value) return
  acting.value = true
  try {
    account.value = await actOnAccount(account.value.id, asking.value, reason.value.trim(), code.value)
    asking.value = null
    toast.success(t('admin.manage.done'))
    refreshAfterChange()
  } catch (e) {
    failed(e)
  } finally {
    acting.value = false
  }
}

// --- one device, one limit ---------------------------------------------------------

/** The device asked to be signed out, and why. */
const ending = ref<AdminSession | null>(null)

function askEnd(s: AdminSession) {
  ending.value = s
  reason.value = ''
  code.value = ''
  codeError.value = ''
}

async function endSession() {
  if (!ending.value || !account.value) return
  acting.value = true
  try {
    account.value = await endAccountSession(account.value.id, ending.value.id, reason.value.trim(), code.value)
    ending.value = null
    toast.success(t('admin.manage.done'))
    refreshAfterChange()
  } catch (e) {
    failed(e)
  } finally {
    acting.value = false
  }
}

const clearing = ref<string | null>(null)

async function clearLimit(l: AdminLimit) {
  clearing.value = l.scope + ' ' + l.key
  try {
    await clearAdminLimit(l)
    toast.success(t('admin.limits.cleared'))
    refreshAfterChange()
  } catch {
    toast.error(t('admin.limits.failed'))
    void loadAccess()
  } finally {
    clearing.value = null
  }
}

/** A history entry's reason; a lifted limit's is the limit, named in the reader's language. */
function reasonText(h: AdminAction): string {
  return h.action === 'clear_limit' && h.reason ? t(`admin.limits.scopes.${h.reason}`) : h.reason
}

function onKeydown(e: KeyboardEvent) {
  // The question's own Escape closes only the question.
  if (e.key === 'Escape' && !asking.value && !ending.value) emit('close')
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
  <aside :class="card" :aria-label="account?.name || account?.email || $t('admin.account.title')">
    <header class="flex shrink-0 items-start gap-3 border-b border-neutral-200 px-5 py-4">
      <template v-if="account">
        <AccountAvatar :name="account.name" :email="account.email" size="lg" />
        <div class="min-w-0 flex-1">
          <h2 class="truncate text-base font-semibold text-neutral-900">{{ account.name || account.email }}</h2>
          <p class="truncate text-sm text-neutral-500">{{ account.email }}</p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            <span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">{{ $t(`admin.roles.${account.role}`) }}</span>
            <span v-if="account.blocked_at" class="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">{{ $t('admin.manage.blocked') }}</span>
            <span v-if="account.two_factor" class="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">2FA</span>
            <span v-if="account.telegram" class="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">Telegram</span>
            <span class="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">{{ LOCALE_NAMES[account.locale] }} · {{ account.currency }}</span>
          </div>
          <p v-if="account.blocked_at" class="mt-2 text-xs text-red-600">{{ $t('admin.manage.blockedSince', { when: timeAgo(account.blocked_at) }) }}</p>
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

    <nav v-if="account" class="flex shrink-0 gap-5 border-b border-neutral-200 px-5" :aria-label="$t('admin.account.title')">
      <button
        v-for="item in TABS"
        :key="item"
        type="button"
        class="-mb-px flex items-center gap-1.5 border-b-2 py-2.5 text-sm font-medium transition-colors"
        :class="tab === item ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'"
        :aria-current="tab === item ? 'page' : undefined"
        @click="tab = item"
      >
        {{ $t(`admin.account.tabs.${item}`) }}
        <span v-if="item === 'history' && historyTotal" class="rounded-full bg-neutral-100 px-1.5 text-[11px] text-neutral-500 tabular-nums">{{ historyTotal }}</span>
      </button>
    </nav>

    <div v-if="account && tab === 'overview'" class="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
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
              @click="clearLimit(l)"
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
              @click="askEnd(s)"
            >
              {{ $t('admin.account.endSession') }}
            </button>
          </li>
        </ul>
      </section>
    </div>

    <div v-else-if="account" class="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5">
      <div v-if="!history" class="space-y-3" aria-hidden="true">
        <div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-neutral-100" />
      </div>
      <EmptyState v-else-if="!history.length" class="flex-1 justify-center" :title="$t('admin.actions.empty')" :description="$t('admin.manage.noHistory')">
        <template #illustration>
          <HistoryIllustration />
        </template>
      </EmptyState>
      <template v-else>
        <ol class="space-y-4 border-l border-neutral-200 pl-4">
          <li v-for="h in history" :key="h.id" class="relative">
            <span class="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full ring-4 ring-white" :class="DOTS[h.action]" aria-hidden="true" />
            <p class="text-sm font-medium text-neutral-900">{{ $t(`admin.actions.names.${h.action}`) }}</p>
            <p class="text-xs text-neutral-500">{{ formatDateTime(h.at) }} · {{ h.admin_email }}</p>
            <p v-if="h.reason" class="mt-1 rounded-md bg-neutral-50 px-2.5 py-1.5 text-xs break-words text-neutral-700">{{ reasonText(h) }}</p>
          </li>
        </ol>
        <Pagination v-if="historyTotal > HISTORY" v-model:page="historyPage" class="mt-5" :total="historyTotal" :limit="HISTORY" />
        <RouterLink to="/admin/actions" class="mt-5 text-xs text-neutral-500 hover:text-neutral-900">{{ $t('admin.manage.allActions') }} →</RouterLink>
      </template>
    </div>

    <!-- what an admin can do, pinned under the scrolling details: two equal buttons a row -->
    <footer v-if="account" class="grid shrink-0 grid-cols-2 gap-2 border-t border-neutral-200 bg-neutral-50 px-4 py-3" role="group" :aria-label="$t('admin.manage.title')">
      <button
        v-for="(action, i) in available"
        :key="action"
        type="button"
        class="truncate rounded-lg px-3 py-2 text-sm font-medium ring-1 transition-colors ring-inset"
        :class="[TONES[action], i === available.length - 1 && available.length % 2 ? 'col-span-2' : '']"
        :title="$t(ACTIONS[action].label)"
        @click="ask(action)"
      >
        {{ $t(action === 'end-sessions' ? 'admin.manage.endSessionsShort' : ACTIONS[action].label) }}
      </button>
    </footer>
  </aside>

  <Modal v-if="asking && account" :title="`${$t(ACTIONS[asking].label)}: ${account.name || account.email}`" @close="acting || (asking = null)">
    <p class="text-sm leading-relaxed text-neutral-600">{{ $t(ACTIONS[asking].text) }}</p>
    <div class="mt-4 space-y-4">
      <BaseTextarea v-model="reason" :label="$t('admin.manage.reason')" :placeholder="$t('admin.manage.reasonHint')" :rows="3" />
      <TwoFactorCodeInput v-model="code" :label="$t('admin.manage.code')" :hint="$t('admin.manage.codeHint')" :error="codeError" required />
    </div>
    <template #footer>
      <BaseButton variant="ghost" size="sm" :block="false" :disabled="acting" @click="asking = null">{{ $t('common.cancel') }}</BaseButton>
      <BaseButton :variant="ACTIONS[asking].tone" size="sm" :block="false" :loading="acting" :disabled="acting || !code.trim()" @click="act">
        {{ $t(ACTIONS[asking].label) }}
      </BaseButton>
    </template>
  </Modal>

  <Modal v-if="ending && account" :title="$t('admin.account.endSessionTitle', { device: deviceName(ending.user_agent) })" @close="acting || (ending = null)">
    <p class="text-sm leading-relaxed text-neutral-600">{{ $t('admin.account.endSessionText') }}</p>
    <div class="mt-4 space-y-4">
      <BaseTextarea v-model="reason" :label="$t('admin.manage.reason')" :placeholder="$t('admin.manage.reasonHint')" :rows="3" />
      <TwoFactorCodeInput v-model="code" :label="$t('admin.manage.code')" :hint="$t('admin.manage.codeHint')" :error="codeError" required />
    </div>
    <template #footer>
      <BaseButton variant="ghost" size="sm" :block="false" :disabled="acting" @click="ending = null">{{ $t('common.cancel') }}</BaseButton>
      <BaseButton variant="danger" size="sm" :block="false" :loading="acting" :disabled="acting || !code.trim()" @click="endSession">
        {{ $t('admin.account.endSession') }}
      </BaseButton>
    </template>
  </Modal>
</template>

