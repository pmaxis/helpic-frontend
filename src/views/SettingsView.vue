<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { z } from 'zod'
import { useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import FormError from '@/components/auth/FormError.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DeviceIcon from '@/components/account/DeviceIcon.vue'
import TelegramSettings from '@/components/account/TelegramSettings.vue'
import EmailNotificationsSettings from '@/components/account/EmailNotificationsSettings.vue'
import { useAuthStore } from '@/stores/auth'
import { ApiRequestError } from '@/services/api'
import { endOtherSessions, endSession, fetchSessions } from '@/services/sessions'
import { toast } from '@/composables/useToasts'
import { useForm } from '@/composables/useForm'
import { currentPassword, email, LIMITS, newPassword, optionalText, passwordsMatch, requiredText } from '@/utils/validation'
import { isLocale, LOCALE_NAMES, LOCALES, t } from '@/i18n'
import { useI18n } from 'vue-i18n'
import { CURRENCIES } from '@/utils/money'
import { deviceName, formatDate, parseDevice, timeAgo } from '@/utils/format'
import type { Session } from '@/types/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const TABS = [
  { value: 'profile' },
  { value: 'email' },
  { value: 'password' },
  { value: 'notifications' },
  { value: 'sessions' },
] as const
type Tab = (typeof TABS)[number]['value']

/** The open tab lives in the URL (?tab=email) so it survives a reload and can be linked to. */
const tab = computed<Tab>({
  get: () => TABS.find((t) => t.value === route.query.tab)?.value ?? 'profile',
  set: (value) => void router.replace({ query: { ...route.query, tab: value === 'profile' ? undefined : value } }),
})

// --- name -------------------------------------------------------------------

const nameForm = useForm(
  z.object({ first_name: requiredText('firstName', LIMITS.name), last_name: optionalText('lastName', LIMITS.name) }),
  { first_name: auth.user?.first_name ?? '', last_name: auth.user?.last_name ?? '' },
)

function saveName() {
  void nameForm.submit(async (data) => {
    await auth.updateName(data.first_name, data.last_name)
    toast.success(t('settings.profile.nameUpdated'))
  })
}

// --- language ---------------------------------------------------------------------

const { locale } = useI18n()
const localeOptions = LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))
const savingLocale = ref(false)

/** Switches at once; the account keeps it for emails and Telegram. */
async function saveLocale(value: string) {
  if (!isLocale(value) || value === locale.value) return
  savingLocale.value = true
  try {
    await auth.setLocale(value)
    toast.success(t('settings.profile.languageChanged'))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('errors.generic'))
  } finally {
    savingLocale.value = false
  }
}

// --- currency (freelancers) ---------------------------------------------------

const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }))
const savingCurrency = ref(false)

/** Saved as soon as it's picked. */
async function saveCurrency(currency: string) {
  if (currency === auth.user?.currency) return
  savingCurrency.value = true
  try {
    await auth.setCurrency(currency)
    toast.success(t('settings.profile.currencyChanged', { currency }))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('settings.profile.currencyFailed'))
  } finally {
    savingCurrency.value = false
  }
}

// --- email ------------------------------------------------------------------

const emailForm = useForm(z.object({ email: email(), current_password: currentPassword(() => t('validation.currentPassword')) }), {
  email: auth.user?.email ?? '',
  current_password: '',
})

/** Where the last confirmation link went: the email changes once it's opened. */
const pendingEmail = ref('')

function saveEmail() {
  void emailForm.submit(async (data) => {
    pendingEmail.value = await auth.changeEmail(data)
    emailForm.reset({ email: auth.user?.email ?? '' })
  })
}

// --- password ---------------------------------------------------------------

const passwordForm = useForm(
  z
    .object({
      current_password: currentPassword(() => t('validation.currentPassword')),
      password: newPassword(),
      password_confirmation: currentPassword(() => t('validation.confirmNewPassword')),
    })
    .refine(...passwordsMatch()),
  { current_password: '', password: '', password_confirmation: '' },
)
/** Bumped to remount the form after a change, hiding any shown passwords. */
const passwordKey = ref(0)

function savePassword() {
  void passwordForm.submit(async (data) => {
    await auth.changePassword(data)
    toast.success(t('settings.password.changed'))
    passwordForm.reset()
    passwordKey.value++
  })
}

// --- sessions ---------------------------------------------------------------

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

async function loadSessions() {
  try {
    sessions.value = await fetchSessions()
  } catch {
    toast.error(t('settings.sessions.loadFailed'))
  } finally {
    sessionsLoaded.value = true
  }
}

/** Loaded when the tab opens, so it shows what changing the password did. */
watch(
  tab,
  (value) => {
    if (value === 'sessions') void loadSessions()
  },
  { immediate: true },
)

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
</script>

<template>
  <DashboardLayout>
    <PageHeader :title="$t('settings.title')" />

    <nav class="mt-5 flex gap-6 border-b border-neutral-200" :aria-label="$t('settings.sections')">
      <button
        v-for="t in TABS"
        :key="t.value"
        type="button"
        class="-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors"
        :class="tab === t.value ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'"
        :aria-current="tab === t.value ? 'page' : undefined"
        @click="tab = t.value"
      >
        {{ $t(`settings.tabs.${t.value}`) }}
      </button>
    </nav>

    <div class="mt-6">
      <template v-if="tab === 'profile'">
        <section class="rounded-xl border border-neutral-200 p-5">
          <form class="space-y-4" novalidate @submit.prevent="saveName">
            <FormError :message="nameForm.formError" />
            <div class="grid gap-4 sm:grid-cols-2">
              <BaseInput
                v-bind="nameForm.field('first_name')"
                :label="auth.isClient ? $t('settings.profile.firstNameOrCompany') : $t('settings.profile.firstName')"
                autocomplete="given-name"
              />
              <BaseInput v-bind="nameForm.field('last_name')" :label="$t('settings.profile.lastName')" autocomplete="family-name" />
            </div>
            <div class="flex justify-end">
              <BaseButton type="submit" size="sm" :block="false" :loading="nameForm.submitting" :disabled="nameForm.submitting">{{ $t('common.save') }}</BaseButton>
            </div>
          </form>
        </section>

        <section class="mt-4 grid gap-4 rounded-xl border border-neutral-200 p-5 sm:grid-cols-2">
          <BaseSelect
            :model-value="locale"
            :label="$t('common.language')"
            :options="localeOptions"
            :class="savingLocale ? 'pointer-events-none opacity-60' : ''"
            @update:model-value="saveLocale"
          />
          <BaseSelect
            v-if="auth.isFreelancer"
            :model-value="auth.user?.currency ?? 'USD'"
            :label="$t('settings.profile.currency')"
            :options="currencyOptions"
            :class="savingCurrency ? 'pointer-events-none opacity-60' : ''"
            @update:model-value="saveCurrency"
          />
        </section>
      </template>

      <section v-else-if="tab === 'email'" class="rounded-xl border border-neutral-200 p-5">
        <p class="text-sm text-neutral-500">{{ $t('settings.email.text') }}</p>
        <div
          v-if="pendingEmail"
          class="mt-4 flex items-start gap-3 rounded-lg bg-sky-50 px-3.5 py-3 text-sm text-sky-900 ring-1 ring-sky-600/15 ring-inset"
          role="status"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
          <i18n-t keypath="settings.email.pending" tag="p" scope="global">
            <template #email><span class="font-medium">{{ pendingEmail }}</span></template>
            <template #current>{{ auth.user?.email }}</template>
          </i18n-t>
        </div>
        <form class="mt-4 space-y-4" novalidate @submit.prevent="saveEmail">
          <FormError :message="emailForm.formError" />
          <BaseInput v-bind="emailForm.field('email')" :label="$t('settings.email.email')" type="email" autocomplete="email" />
          <PasswordInput
            v-bind="emailForm.field('current_password')"
            :label="$t('settings.email.currentPassword')"
            autocomplete="current-password"
          />
          <div class="flex justify-end">
            <BaseButton type="submit" size="sm" :block="false" :loading="emailForm.submitting" :disabled="emailForm.submitting">{{ $t('settings.email.change') }}</BaseButton>
          </div>
        </form>
      </section>

      <div v-else-if="tab === 'notifications'" class="space-y-4">
        <EmailNotificationsSettings />
        <TelegramSettings />
      </div>

      <template v-else-if="tab === 'sessions'">
        <div v-if="!sessionsLoaded" class="space-y-4" aria-busy="true">
          <div class="h-[88px] animate-pulse rounded-xl bg-neutral-100" />
          <div class="h-44 animate-pulse rounded-xl bg-neutral-100" />
        </div>

        <template v-else>
          <!-- the device looking at the page -->
          <section v-if="currentSession" class="rounded-xl border border-neutral-200 p-5">
            <p class="text-xs font-medium tracking-wide text-neutral-400 uppercase">{{ $t('settings.sessions.thisDevice') }}</p>
            <div class="mt-3 flex items-center gap-4">
              <span class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white">
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
            </div>
          </section>

          <!-- everywhere else -->
          <section class="mt-4 rounded-xl border border-neutral-200">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3.5">
              <div>
                <h2 class="text-sm font-semibold text-neutral-900">
                  {{ $t('settings.sessions.otherDevices') }}
                  <span v-if="otherSessions.length" class="ml-1 font-normal text-neutral-400">{{ otherSessions.length }}</span>
                </h2>
                <p class="mt-0.5 text-xs text-neutral-500">{{ $t('settings.sessions.otherText') }}</p>
              </div>
              <BaseButton v-if="otherSessions.length > 1" variant="danger" size="sm" :block="false" @click="confirmEndOthers = true">
                {{ $t('settings.sessions.signOutAll') }}
              </BaseButton>
            </div>

            <ul v-if="otherSessions.length" class="divide-y divide-neutral-100">
              <li v-for="s in otherSessions" :key="s.id" class="flex items-center gap-3 px-5 py-3">
                <span class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                  <DeviceIcon :kind="parseDevice(s.user_agent).kind" class="h-5 w-5" />
                  <span
                    v-if="isRecent(s)"
                    class="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
                  />
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
            </ul>

            <div v-else class="flex items-center gap-3 px-5 py-5">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </span>
              <div>
                <p class="text-sm text-neutral-900">{{ $t('settings.sessions.onlyHere') }}</p>
                <p class="text-xs text-neutral-500">{{ $t('settings.sessions.onlyHereText') }}</p>
              </div>
            </div>
          </section>
        </template>

        <ConfirmDialog
          v-model:open="confirmEndOthers"
          :title="$t('settings.sessions.confirmOthers')"
          :description="$t('settings.sessions.confirmOthersText', { n: otherSessions.length }, otherSessions.length)"
          :confirm-label="$t('settings.sessions.signOut')"
          :loading="endingOthers"
          @confirm="signOutOthers"
        />
      </template>

      <section v-else class="rounded-xl border border-neutral-200 p-5">
        <p class="text-sm text-neutral-500">{{ $t('settings.password.text') }}</p>
        <form :key="passwordKey" class="mt-4 space-y-4" novalidate @submit.prevent="savePassword">
          <FormError :message="passwordForm.formError" />
          <PasswordInput
            v-bind="passwordForm.field('current_password')"
            :label="$t('settings.password.current')"
            autocomplete="current-password"
          />
          <PasswordInput
            v-bind="passwordForm.field('password')"
            :label="$t('settings.password.new')"
            autocomplete="new-password"
            :hint="$t('validation.passwordHint', { n: LIMITS.password })"
          />
          <PasswordInput
            v-bind="passwordForm.field('password_confirmation')"
            :label="$t('settings.password.confirm')"
            autocomplete="new-password"
          />
          <div class="flex justify-end">
            <BaseButton type="submit" size="sm" :block="false" :loading="passwordForm.submitting" :disabled="passwordForm.submitting">
              {{ $t('settings.password.change') }}
            </BaseButton>
          </div>
        </form>
      </section>
    </div>
  </DashboardLayout>
</template>
