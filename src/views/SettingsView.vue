<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { z } from 'zod'
import { useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import FormError from '@/components/auth/FormError.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import DeviceIcon from '@/components/account/DeviceIcon.vue'
import TelegramSettings from '@/components/account/TelegramSettings.vue'
import EmailNotificationsSettings from '@/components/account/EmailNotificationsSettings.vue'
import ConfirmPasswordModal from '@/components/account/ConfirmPasswordModal.vue'
import SettingsGroup from '@/components/account/SettingsGroup.vue'
import SettingsRow from '@/components/account/SettingsRow.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import { useAuthStore } from '@/stores/auth'
import { ApiRequestError } from '@/services/api'
import { endOtherSessions, endSession, fetchSessions } from '@/services/sessions'
import { toast } from '@/composables/useToasts'
import { useForm } from '@/composables/useForm'
import { THEMES, useTheme } from '@/composables/useTheme'
import { currentPassword, email, LIMITS, newPassword, optionalText, passwordsMatch, requiredText } from '@/utils/validation'
import { isLocale, LOCALE_NAMES, LOCALES, t } from '@/i18n'
import { useI18n } from 'vue-i18n'
import { CURRENCIES } from '@/utils/money'
import { deviceName, formatDate, parseDevice, timeAgo } from '@/utils/format'
import type { Session } from '@/types/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

/** Three groups: who you are, how and where you sign in, and what you hear about. */
const TABS = [{ value: 'profile' }, { value: 'security' }, { value: 'notifications' }] as const
type Tab = (typeof TABS)[number]['value']

/** The old tabs, still in links (an email confirmation goes to ?tab=email), now live under security. */
const MOVED: Record<string, Tab> = { email: 'security', password: 'security', sessions: 'security' }

/** The open tab lives in the URL (?tab=security) so it survives a reload and can be linked to. */
const tab = computed<Tab>({
  get: () => {
    const q = String(route.query.tab ?? '')
    return TABS.find((t) => t.value === q)?.value ?? MOVED[q] ?? 'profile'
  },
  set: (value) => void router.replace({ query: { ...route.query, tab: value === 'profile' ? undefined : value } }),
})

// --- who you are -------------------------------------------------------------

/** The account's role, and for a team member the company. */
const roleText = computed(() => {
  const u = auth.user
  if (!u) return ''
  if (auth.isFreelancer) return t('project.roles.freelancer')
  if (u.member_of) return `${t(`project.roles.${u.member_of.role}`)} · ${u.member_of.name}`
  return t('project.roles.owner')
})

// --- name -------------------------------------------------------------------

const nameForm = useForm(z.object({ first_name: requiredText('firstName', LIMITS.name), last_name: optionalText('lastName', LIMITS.name) }), {
  first_name: auth.user?.first_name ?? '',
  last_name: auth.user?.last_name ?? '',
})

/** The name has edits to save: only then is there a Save button. */
const nameDirty = computed(
  () => nameForm.values.first_name.trim() !== (auth.user?.first_name ?? '') || nameForm.values.last_name.trim() !== (auth.user?.last_name ?? ''),
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

// --- theme --------------------------------------------------------------------

const { theme, isTheme } = useTheme()
const themeOptions = computed(() => THEMES.map((value) => ({ value, label: t(`settings.groups.themes.${value}`) })))

/** Kept on this device only, so it switches without a request. */
function saveTheme(value: string) {
  if (isTheme(value)) theme.value = value
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
    const field = error instanceof ApiRequestError ? error.fields?.currency : undefined
    toast.error(field ?? (error instanceof ApiRequestError ? error.message : t('settings.profile.currencyFailed')))
  } finally {
    savingCurrency.value = false
  }
}

// --- email ------------------------------------------------------------------

// Both changes ask for the current password in a modal once their own fields
// are fine; the modal sends them. Each opens from its row, one at a time.

const editing = ref<'email' | 'password' | null>(null)

function edit(what: 'email' | 'password') {
  emailForm.reset({ email: auth.user?.email ?? '' })
  passwordForm.reset()
  passwordKey.value++
  editing.value = what
}

const emailForm = useForm(z.object({ email: email() }), { email: auth.user?.email ?? '' })

/** Where the last confirmation link went: the email changes once it's opened. */
const pendingEmail = ref('')
/** The new email, checked and waiting for the current password. */
const emailToConfirm = ref('')

function saveEmail() {
  void emailForm.submit(async (data) => {
    emailToConfirm.value = data.email
  })
}

async function changeEmail(password: string) {
  pendingEmail.value = await auth.changeEmail({ email: emailToConfirm.value, current_password: password })
}

function emailChanged() {
  emailToConfirm.value = ''
  editing.value = null
  emailForm.reset({ email: auth.user?.email ?? '' })
}

function emailRefused(error: ApiRequestError) {
  emailToConfirm.value = ''
  emailForm.fail(error)
}

// --- password ---------------------------------------------------------------

const passwordForm = useForm(
  z
    .object({
      password: newPassword(),
      password_confirmation: currentPassword(() => t('validation.confirmNewPassword')),
    })
    .refine(...passwordsMatch()),
  { password: '', password_confirmation: '' },
)
/** Bumped to remount the form after a change, hiding any shown passwords. */
const passwordKey = ref(0)
/** The new password is checked and waits for the current one. */
const confirmingPassword = ref(false)

function savePassword() {
  void passwordForm.submit(async () => {
    confirmingPassword.value = true
  })
}

async function changePassword(password: string) {
  await auth.changePassword({ current_password: password, ...passwordForm.values })
}

function passwordChanged() {
  confirmingPassword.value = false
  editing.value = null
  toast.success(t('settings.password.changed'))
  passwordForm.reset()
  passwordKey.value++
}

function passwordRefused(error: ApiRequestError) {
  confirmingPassword.value = false
  passwordForm.fail(error)
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
    if (value === 'security') void loadSessions()
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

    <nav class="mt-5 flex gap-6 overflow-x-auto border-b border-neutral-200" :aria-label="$t('settings.sections')">
      <button
        v-for="item in TABS"
        :key="item.value"
        type="button"
        class="-mb-px shrink-0 border-b-2 pb-2.5 text-sm font-medium whitespace-nowrap transition-colors"
        :class="tab === item.value ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'"
        :aria-current="tab === item.value ? 'page' : undefined"
        @click="tab = item.value"
      >
        {{ $t(`settings.tabs.${item.value}`) }}
      </button>
    </nav>

    <div class="mt-6">
      <div class="min-w-0 space-y-8">
        <template v-if="tab === 'profile'">
          <SettingsGroup :title="$t('settings.groups.profile')" :description="$t('settings.groups.profileText')">
            <SettingsRow :label="$t('settings.groups.name')" :hint="auth.isClient ? $t('settings.groups.nameTextClient') : $t('settings.groups.nameText')">
              <template #below>
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
                  <div v-if="nameDirty || nameForm.submitting" class="flex justify-end gap-2">
                    <BaseButton
                      variant="ghost"
                      size="sm"
                      :block="false"
                      :disabled="nameForm.submitting"
                      @click="nameForm.reset({ first_name: auth.user?.first_name ?? '', last_name: auth.user?.last_name ?? '' })"
                    >
                      {{ $t('common.cancel') }}
                    </BaseButton>
                    <BaseButton type="submit" size="sm" :block="false" :loading="nameForm.submitting" :disabled="nameForm.submitting">{{
                      $t('common.save')
                    }}</BaseButton>
                  </div>
                </form>
              </template>
            </SettingsRow>

            <SettingsRow :label="$t('settings.groups.account')" :hint="$t('settings.groups.accountText')">
              <span class="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">{{ roleText }}</span>
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup :title="$t('settings.groups.preferences')">
            <SettingsRow :label="$t('common.language')" :hint="$t('settings.groups.languageText')">
              <SelectInput
                class="w-44"
                :class="savingLocale ? 'pointer-events-none opacity-60' : ''"
                :model-value="locale"
                :options="localeOptions"
                :aria-label="$t('common.language')"
                @update:model-value="saveLocale"
              />
            </SettingsRow>
            <SettingsRow :label="$t('settings.groups.theme')" :hint="$t('settings.groups.themeText')">
              <SelectInput
                class="w-44"
                :model-value="theme"
                :options="themeOptions"
                :aria-label="$t('settings.groups.theme')"
                @update:model-value="saveTheme"
              />
            </SettingsRow>
            <SettingsRow v-if="auth.isFreelancer" :label="$t('settings.profile.currency')" :hint="$t('settings.groups.currencyText')">
              <SelectInput
                class="w-44"
                :class="savingCurrency ? 'pointer-events-none opacity-60' : ''"
                :model-value="auth.user?.currency ?? 'USD'"
                :options="currencyOptions"
                :aria-label="$t('settings.profile.currency')"
                @update:model-value="saveCurrency"
              />
            </SettingsRow>
          </SettingsGroup>
        </template>

        <template v-else-if="tab === 'security'">
          <SettingsGroup :title="$t('settings.groups.signIn')" :description="$t('settings.groups.signInText')">
            <!-- email -->
            <SettingsRow :label="$t('settings.email.email')" :hint="editing === 'email' ? $t('settings.email.text') : auth.user?.email">
              <BaseButton v-if="editing !== 'email'" variant="ghost" size="sm" :block="false" @click="edit('email')">{{
                $t('settings.groups.change')
              }}</BaseButton>
              <template v-if="pendingEmail || editing === 'email'" #below>
                <div
                  v-if="pendingEmail"
                  class="flex items-start gap-3 rounded-lg bg-sky-50 px-3.5 py-3 text-sm text-sky-900 ring-1 ring-sky-600/15 ring-inset"
                  :class="editing === 'email' ? 'mb-4' : ''"
                  role="status"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="mt-0.5 h-4 w-4 shrink-0 text-sky-600"
                    aria-hidden="true"
                  >
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                  <i18n-t keypath="settings.email.pending" tag="p" scope="global">
                    <template #email>
                      <span class="font-medium">{{ pendingEmail }}</span>
                    </template>
                    <template #current>{{ auth.user?.email }}</template>
                  </i18n-t>
                </div>
                <form v-if="editing === 'email'" class="space-y-4" novalidate @submit.prevent="saveEmail">
                  <FormError :message="emailForm.formError" />
                  <BaseInput v-bind="emailForm.field('email')" :label="$t('settings.groups.newEmail')" type="email" autocomplete="email" />
                  <div class="flex justify-end gap-2">
                    <BaseButton variant="ghost" size="sm" :block="false" :disabled="emailForm.submitting" @click="editing = null">{{
                      $t('common.cancel')
                    }}</BaseButton>
                    <BaseButton type="submit" size="sm" :block="false" :loading="emailForm.submitting" :disabled="emailForm.submitting">
                      {{ $t('settings.email.change') }}
                    </BaseButton>
                  </div>
                </form>
              </template>
            </SettingsRow>

            <!-- password -->
            <SettingsRow
              :label="$t('settings.password.title')"
              :hint="editing === 'password' ? $t('settings.password.text') : $t('settings.groups.passwordHint')"
            >
              <BaseButton v-if="editing !== 'password'" variant="ghost" size="sm" :block="false" @click="edit('password')">{{
                $t('settings.groups.change')
              }}</BaseButton>
              <template v-if="editing === 'password'" #below>
                <form :key="passwordKey" class="space-y-4" novalidate @submit.prevent="savePassword">
                  <FormError :message="passwordForm.formError" />
                  <div class="grid gap-4 sm:grid-cols-2">
                    <PasswordInput
                      v-bind="passwordForm.field('password')"
                      :label="$t('settings.password.new')"
                      autocomplete="new-password"
                      :hint="$t('validation.passwordHint', { n: LIMITS.password })"
                    />
                    <PasswordInput v-bind="passwordForm.field('password_confirmation')" :label="$t('settings.password.confirm')" autocomplete="new-password" />
                  </div>
                  <div class="flex justify-end gap-2">
                    <BaseButton variant="ghost" size="sm" :block="false" :disabled="passwordForm.submitting" @click="editing = null">{{
                      $t('common.cancel')
                    }}</BaseButton>
                    <BaseButton type="submit" size="sm" :block="false" :loading="passwordForm.submitting" :disabled="passwordForm.submitting">
                      {{ $t('settings.password.change') }}
                    </BaseButton>
                  </div>
                </form>
              </template>
            </SettingsRow>
          </SettingsGroup>

          <ConfirmPasswordModal
            v-if="emailToConfirm"
            :title="$t('settings.confirmPassword.title')"
            :description="$t('settings.confirmPassword.email', { email: emailToConfirm })"
            :confirm-label="$t('settings.email.change')"
            :action="changeEmail"
            @close="emailToConfirm = ''"
            @done="emailChanged"
            @failed="emailRefused"
          />
          <ConfirmPasswordModal
            v-if="confirmingPassword"
            :title="$t('settings.confirmPassword.title')"
            :description="$t('settings.confirmPassword.password')"
            :confirm-label="$t('settings.password.change')"
            :action="changePassword"
            @close="confirmingPassword = false"
            @done="passwordChanged"
            @failed="passwordRefused"
          />

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

        <section v-else>
          <h2 class="text-base font-semibold text-neutral-900">{{ $t('settings.groups.channels') }}</h2>
          <p class="mt-0.5 text-sm text-neutral-500">{{ $t('settings.groups.channelsText') }}</p>
          <div class="mt-3 space-y-3">
            <EmailNotificationsSettings />
            <TelegramSettings />
          </div>
        </section>
      </div>
    </div>
  </DashboardLayout>
</template>
