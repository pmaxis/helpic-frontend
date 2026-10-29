<script setup lang="ts">
/**
 * One account in full, in a card beside the accounts list, as a task's
 * details sit beside the task: who they are, their team, how much they have
 * done (counts only), the days they used Helpic, the devices they're signed
 * in on, each one signed out on its own, and the rate limits holding them
 * back, each lifted at once; on a tab of its own the
 * account's history, what admins did to it; and under both what an admin can
 * do to it, deleting it last, each asked for a reason and the admin's
 * two-factor code again, and recorded. Escape or the close button
 * closes it.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { deviceName, timeAgo } from '@/utils/format'
import { LOCALE_NAMES } from '@/i18n'
import { toast } from '@/composables/useToasts'
import { ApiRequestError } from '@/services/api'
import AccountAvatar from './AccountAvatar.vue'
import AccountOverview from './AccountOverview.vue'
import AccountHistoryList from './AccountHistoryList.vue'
import AdminConfirmModal from './AdminConfirmModal.vue'
import { actOnAccount, clearAdminLimit, deleteAdminAccount, endAccountSession, fetchAccountSessions, fetchAdminAccount, fetchAdminActions, fetchAdminLimits } from '../api'
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

/** How each action's button looks: blocking red, unblocking green, the rest plain. */
const TONES: Record<AdminActionPath, string> = {
  block: 'bg-red-50 text-red-700 ring-red-200 hover:bg-red-100',
  unblock: 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100',
  'end-sessions': 'bg-white text-neutral-700 ring-neutral-200 hover:bg-neutral-100 hover:text-neutral-900',
  'reset-two-factor': 'bg-white text-neutral-700 ring-neutral-200 hover:bg-neutral-100 hover:text-neutral-900',
}

const asking = ref<AdminActionPath | null>(null)
/** The admin's two-factor code was refused: shown in the question, to try again. */
const codeError = ref('')
const acting = ref(false)

function ask(action: AdminActionPath) {
  asking.value = action
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

async function act(reason: string, code: string) {
  if (!asking.value || !account.value) return
  acting.value = true
  try {
    account.value = await actOnAccount(account.value.id, asking.value, reason, code)
    asking.value = null
    toast.success(t('admin.manage.done'))
    refreshAfterChange()
  } catch (e) {
    failed(e)
  } finally {
    acting.value = false
  }
}

/** Deleting is asked like the rest, but leaves no account to show: the card closes. */
const deleting = ref(false)

function askDelete() {
  deleting.value = true
  codeError.value = ''
}

async function remove(reason: string, code: string) {
  if (!account.value) return
  acting.value = true
  try {
    await deleteAdminAccount(account.value.id, reason, code)
    deleting.value = false
    toast.success(t('admin.manage.deleted'))
    emit('changed')
    emit('close')
  } catch (e) {
    // Refused while their company has people: the reason is the backend's to say.
    if (e instanceof ApiRequestError && e.status === 409) toast.error(e.message)
    else failed(e)
  } finally {
    acting.value = false
  }
}

// --- one device, one limit ---------------------------------------------------------

/** The device asked to be signed out. */
const ending = ref<AdminSession | null>(null)

function askEnd(s: AdminSession) {
  ending.value = s
  codeError.value = ''
}

async function endSession(reason: string, code: string) {
  if (!ending.value || !account.value) return
  acting.value = true
  try {
    account.value = await endAccountSession(account.value.id, ending.value.id, reason, code)
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

function onKeydown(e: KeyboardEvent) {
  // The question's own Escape closes only the question.
  if (e.key === 'Escape' && !asking.value && !ending.value && !deleting.value) emit('close')
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  closeButton.value?.focus()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
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

    <AccountOverview
      v-if="account && tab === 'overview'"
      :account="account"
      :sessions="sessions"
      :limits="limits"
      :clearing="clearing"
      @clear="clearLimit"
      @end="askEnd"
    />
    <AccountHistoryList v-else-if="account" v-model:page="historyPage" :history="history" :total="historyTotal" :limit="HISTORY" />

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
      <button
        type="button"
        class="col-span-2 truncate rounded-lg bg-white px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 transition-colors ring-inset hover:bg-red-50"
        @click="askDelete"
      >
        {{ $t('admin.manage.delete') }}
      </button>
    </footer>
  </aside>

  <AdminConfirmModal
    v-if="asking && account"
    :title="`${$t(ACTIONS[asking].label)}: ${account.name || account.email}`"
    :text="$t(ACTIONS[asking].text)"
    :confirm-label="$t(ACTIONS[asking].label)"
    :tone="ACTIONS[asking].tone"
    :acting="acting"
    :code-error="codeError"
    @confirm="act"
    @close="asking = null"
  />
  <AdminConfirmModal
    v-if="deleting && account"
    :title="`${$t('admin.manage.delete')}: ${account.name || account.email}`"
    :text="$t('admin.manage.deleteText')"
    :confirm-label="$t('admin.manage.delete')"
    tone="danger"
    :acting="acting"
    :code-error="codeError"
    @confirm="remove"
    @close="deleting = false"
  />
  <AdminConfirmModal
    v-if="ending && account"
    :title="$t('admin.account.endSessionTitle', { device: deviceName(ending.user_agent) })"
    :text="$t('admin.account.endSessionText')"
    :confirm-label="$t('admin.account.endSession')"
    tone="danger"
    :acting="acting"
    :code-error="codeError"
    @confirm="endSession"
    @close="ending = null"
  />
</template>
