<script setup lang="ts">
/**
 * One admin, in a card beside the admins list, as an account sits beside the
 * accounts: who they are, when they signed in and the devices they're signed
 * in on, each signed out on its own (with your own code; they get an email,
 * the alert chat hears of it); on a tab of its own their sign-ins, the failed
 * attempts too. Locking or resetting an admin is the server's cli's, not
 * this card's. Escape or the close button closes it.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/ui/Modal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseTextarea from '@/components/ui/BaseTextarea.vue'
import Pagination from '@/components/ui/Pagination.vue'
import TwoFactorCodeInput from '@/components/auth/TwoFactorCodeInput.vue'
import DeviceIcon from '@/components/account/DeviceIcon.vue'
import { ApiRequestError } from '@/services/api'
import { toast } from '@/composables/useToasts'
import { intlLocale } from '@/i18n'
import { deviceName, formatDate, parseDevice, timeAgo } from '@/utils/format'
import { useAuthStore } from '@/stores/auth'
import AccountAvatar from './AccountAvatar.vue'
import { endAdminSession, fetchAdminSignIns } from '../api'
import type { AdminAccountAdmin, AdminSession, AdminSignIn, AdminSignInOutcome } from '../types'

const props = defineProps<{ admin: AdminAccountAdmin }>()
const emit = defineEmits<{ close: []; changed: [] }>()
const { t } = useI18n()
const auth = useAuthStore()

const closeButton = ref<HTMLButtonElement | null>(null)
const card = 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs'

const TABS = ['overview', 'signIns'] as const
const tab = ref<(typeof TABS)[number]>('overview')

// --- their sign-ins ------------------------------------------------------------------

const SIGN_INS = 10
const signIns = ref<AdminSignIn[] | null>(null)
const signInsTotal = ref(0)
const signInsPage = ref(1)

async function loadSignIns() {
  try {
    const page = await fetchAdminSignIns({ admin: props.admin.id, page: signInsPage.value, limit: SIGN_INS })
    signIns.value = page.sign_ins
    signInsTotal.value = page.total
  } catch {
    signIns.value = []
    toast.error(t('admin.loadFailed'))
  }
}
watch(signInsPage, loadSignIns)
watch(
  () => props.admin.id,
  () => {
    tab.value = 'overview'
    signIns.value = null
    if (signInsPage.value === 1) void loadSignIns()
    else signInsPage.value = 1
  },
  { immediate: true },
)

const TONES: Record<AdminSignInOutcome, string> = {
  ok: 'bg-emerald-500',
  wrong_password: 'bg-red-500',
  wrong_code: 'bg-red-500',
  limited: 'bg-amber-500',
}

const dateTime = computed(() => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))

// --- signing them out of one device ------------------------------------------------

const ending = ref<AdminSession | null>(null)
const reason = ref('')
const code = ref('')
const codeError = ref('')
const acting = ref(false)

function askEnd(s: AdminSession) {
  ending.value = s
  reason.value = ''
  code.value = ''
  codeError.value = ''
}

async function endSession() {
  if (!ending.value) return
  acting.value = true
  try {
    await endAdminSession(props.admin.id, ending.value.id, reason.value.trim(), code.value)
    ending.value = null
    toast.success(t('admin.manage.done'))
    emit('changed')
  } catch (e) {
    // A refused code stays in the question, to try again.
    if (e instanceof ApiRequestError && (e.fields?.code || e.status === 429)) codeError.value = e.fields?.code ?? e.message
    else toast.error(t('admin.manage.failed'))
  } finally {
    acting.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  // The question's own Escape closes only the question.
  if (e.key === 'Escape' && !ending.value) emit('close')
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  closeButton.value?.focus()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <aside :class="card" :aria-label="admin.name || admin.email">
    <header class="flex shrink-0 items-start gap-3 border-b border-neutral-200 px-5 py-4">
      <AccountAvatar :name="admin.name" :email="admin.email" size="lg" />
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-base font-semibold text-neutral-900">{{ admin.name || admin.email }}</h2>
        <p class="truncate text-sm text-neutral-500">{{ admin.email }}</p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          <span v-if="admin.id === auth.user?.id" class="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">{{ $t('admin.admins.you') }}</span>
          <span v-if="admin.two_factor" class="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">2FA</span>
        </div>
        <p v-if="!admin.two_factor" class="mt-2 text-xs text-amber-700">{{ $t('admin.admins.noTwoFactor') }}</p>
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

    <nav class="flex shrink-0 gap-5 border-b border-neutral-200 px-5" :aria-label="$t('admin.admins.title')">
      <button
        v-for="item in TABS"
        :key="item"
        type="button"
        class="-mb-px flex items-center gap-1.5 border-b-2 py-2.5 text-sm font-medium transition-colors"
        :class="tab === item ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'"
        :aria-current="tab === item ? 'page' : undefined"
        @click="tab = item"
      >
        {{ $t(`admin.admins.tabs.${item}`) }}
        <span v-if="item === 'signIns' && signInsTotal" class="rounded-full bg-neutral-100 px-1.5 text-[11px] text-neutral-500 tabular-nums">{{ signInsTotal }}</span>
      </button>
    </nav>

    <div v-if="tab === 'overview'" class="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
      <section>
        <h3 class="text-xs font-semibold text-neutral-900">{{ $t('admin.account.access') }}</h3>
        <dl class="mt-2 space-y-1.5 text-sm">
          <div class="flex justify-between gap-4">
            <dt class="text-neutral-500">{{ $t('admin.admins.columns2.created') }}</dt>
            <dd class="text-neutral-900">{{ formatDate(admin.created_at) }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-neutral-500">{{ $t('admin.account.lastSignIn') }}</dt>
            <dd class="text-neutral-900">{{ admin.last_sign_in ? timeAgo(admin.last_sign_in) : $t('admin.never') }}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 class="text-xs font-semibold text-neutral-900">
          {{ $t('admin.account.sessions') }} <span class="font-normal text-neutral-400 tabular-nums">{{ admin.sessions.length }}</span>
        </h3>
        <p v-if="!admin.sessions.length" class="mt-1 text-sm text-neutral-500">{{ $t('admin.account.noSessions') }}</p>
        <ul v-else class="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          <li v-for="s in admin.sessions" :key="s.id" class="flex items-center gap-3 px-3 py-2.5">
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

    <div v-else class="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5">
      <div v-if="!signIns" class="space-y-3" aria-hidden="true">
        <div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-lg bg-neutral-100" />
      </div>
      <p v-else-if="!signIns.length" class="text-sm text-neutral-500">{{ $t('admin.admins.empty') }}</p>
      <template v-else>
        <ol class="space-y-4 border-l border-neutral-200 pl-4">
          <li v-for="s in signIns" :key="s.id" class="relative">
            <span class="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full ring-4 ring-white" :class="TONES[s.outcome]" aria-hidden="true" />
            <p class="text-sm font-medium text-neutral-900">{{ $t(`admin.admins.outcomes.${s.outcome}`) }}</p>
            <p class="text-xs text-neutral-500">
              {{ dateTime.format(new Date(s.at)) }} · {{ deviceName(s.user_agent) }}<template v-if="s.ip"> · {{ s.ip }}</template>
            </p>
          </li>
        </ol>
        <Pagination v-if="signInsTotal > SIGN_INS" v-model:page="signInsPage" class="mt-5" :total="signInsTotal" :limit="SIGN_INS" />
      </template>
    </div>
  </aside>

  <Modal
    v-if="ending"
    :title="`${$t('admin.account.endSessionTitle', { device: deviceName(ending.user_agent) })}: ${admin.name || admin.email}`"
    @close="acting || (ending = null)"
  >
    <p class="text-sm leading-relaxed text-neutral-600">{{ $t('admin.admins.endSessionText') }}</p>
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
