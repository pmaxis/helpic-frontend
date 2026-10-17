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
import { useAuthStore } from '@/stores/auth'
import { ApiRequestError } from '@/services/api'
import { endOtherSessions, endSession, fetchSessions } from '@/services/sessions'
import { toast } from '@/composables/useToasts'
import { useForm } from '@/composables/useForm'
import { across, currentPassword, email, LIMITS, newPassword, optionalText, requiredText } from '@/utils/validation'
import { CURRENCIES } from '@/utils/money'
import { deviceName, formatDate, parseDevice, timeAgo } from '@/utils/format'
import type { Session } from '@/types/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const TABS = [
  { value: 'profile', label: 'Profile' },
  { value: 'email', label: 'Email' },
  { value: 'password', label: 'Password' },
  { value: 'notifications', label: 'Notifications' },
  { value: 'sessions', label: 'Sessions' },
] as const
type Tab = (typeof TABS)[number]['value']

/** The open tab lives in the URL (?tab=email) so it survives a reload and can be linked to. */
const tab = computed<Tab>({
  get: () => TABS.find((t) => t.value === route.query.tab)?.value ?? 'profile',
  set: (value) => void router.replace({ query: { ...route.query, tab: value === 'profile' ? undefined : value } }),
})

// --- name -------------------------------------------------------------------

const nameForm = useForm(
  z.object({ first_name: requiredText('First name', LIMITS.name), last_name: optionalText('Last name', LIMITS.name) }),
  { first_name: auth.user?.first_name ?? '', last_name: auth.user?.last_name ?? '' },
)

function saveName() {
  void nameForm.submit(async (data) => {
    await auth.updateName(data.first_name, data.last_name)
    toast.success('Name updated')
  })
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
    toast.success(`Prices are now in ${currency}`)
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : 'Could not change the currency')
  } finally {
    savingCurrency.value = false
  }
}

// --- email ------------------------------------------------------------------

const emailForm = useForm(z.object({ email: email(), current_password: currentPassword('Enter your current password') }), {
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
      current_password: currentPassword('Enter your current password'),
      password: newPassword(),
      password_confirmation: currentPassword('Please confirm your new password'),
    })
    .refine(...across('password_confirmation', (v) => v.password === v.password_confirmation, 'Passwords do not match')),
  { current_password: '', password: '', password_confirmation: '' },
)
/** Bumped to remount the form after a change, hiding any shown passwords. */
const passwordKey = ref(0)

function savePassword() {
  void passwordForm.submit(async (data) => {
    await auth.changePassword(data)
    toast.success('Password changed')
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
    toast.error('Could not load your sessions')
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
    toast.success(`${deviceName(session.user_agent)} signed out`)
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : 'Could not sign the device out')
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
    toast.success('Signed out of every other device')
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : 'Could not sign the other devices out')
  } finally {
    endingOthers.value = false
  }
}
</script>

<template>
  <DashboardLayout>
    <PageHeader title="Settings" />

    <nav class="mt-5 flex gap-6 border-b border-neutral-200" aria-label="Settings sections">
      <button
        v-for="t in TABS"
        :key="t.value"
        type="button"
        class="-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors"
        :class="tab === t.value ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'"
        :aria-current="tab === t.value ? 'page' : undefined"
        @click="tab = t.value"
      >
        {{ t.label }}
      </button>
    </nav>

    <div class="mt-6">
      <template v-if="tab === 'profile'">
        <section class="rounded-xl border border-neutral-200 p-5">
          <p class="text-sm text-neutral-500">
            {{ auth.isClient ? 'Your freelancers see this name.' : 'Your clients see this name.' }}
          </p>
          <form class="mt-4 space-y-4" novalidate @submit.prevent="saveName">
            <FormError :message="nameForm.formError" />
            <div class="grid gap-4 sm:grid-cols-2">
              <BaseInput
                v-bind="nameForm.field('first_name')"
                :label="auth.isClient ? 'First name or company' : 'First name'"
                autocomplete="given-name"
              />
              <BaseInput v-bind="nameForm.field('last_name')" label="Last name" autocomplete="family-name" />
            </div>
            <div class="flex justify-end">
              <BaseButton type="submit" size="sm" :block="false" :loading="nameForm.submitting" :disabled="nameForm.submitting">Save</BaseButton>
            </div>
          </form>
        </section>

        <section v-if="auth.isFreelancer" class="mt-4 rounded-xl border border-neutral-200 p-5">
          <p class="text-sm text-neutral-500">Task prices and report totals use this currency. Sent reports keep the one they were sent in.</p>
          <div class="mt-4 sm:w-56">
            <BaseSelect
              :model-value="auth.user?.currency ?? 'USD'"
              label="Currency"
              :options="currencyOptions"
              :class="savingCurrency ? 'pointer-events-none opacity-60' : ''"
              @update:model-value="saveCurrency"
            />
          </div>
        </section>
      </template>

      <section v-else-if="tab === 'email'" class="rounded-xl border border-neutral-200 p-5">
        <p class="text-sm text-neutral-500">You sign in with this email. A new one needs confirming from its own inbox.</p>
        <div
          v-if="pendingEmail"
          class="mt-4 flex items-start gap-3 rounded-lg bg-sky-50 px-3.5 py-3 text-sm text-sky-900 ring-1 ring-sky-600/15 ring-inset"
          role="status"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
          <p>
            We sent a link to <span class="font-medium">{{ pendingEmail }}</span>. Open it to start signing in with that email; until then
            it stays {{ auth.user?.email }}. The link works for 24 hours.
          </p>
        </div>
        <form class="mt-4 space-y-4" novalidate @submit.prevent="saveEmail">
          <FormError :message="emailForm.formError" />
          <BaseInput v-bind="emailForm.field('email')" label="Email" type="email" autocomplete="email" />
          <PasswordInput
            v-bind="emailForm.field('current_password')"
            label="Current password"
            autocomplete="current-password"
          />
          <div class="flex justify-end">
            <BaseButton type="submit" size="sm" :block="false" :loading="emailForm.submitting" :disabled="emailForm.submitting">Change email</BaseButton>
          </div>
        </form>
      </section>

      <TelegramSettings v-else-if="tab === 'notifications'" />

      <template v-else-if="tab === 'sessions'">
        <div v-if="!sessionsLoaded" class="space-y-4" aria-busy="true">
          <div class="h-[88px] animate-pulse rounded-xl bg-neutral-100" />
          <div class="h-44 animate-pulse rounded-xl bg-neutral-100" />
        </div>

        <template v-else>
          <!-- the device looking at the page -->
          <section v-if="currentSession" class="rounded-xl border border-neutral-200 p-5">
            <p class="text-xs font-medium tracking-wide text-neutral-400 uppercase">This device</p>
            <div class="mt-3 flex items-center gap-4">
              <span class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white">
                <DeviceIcon :kind="parseDevice(currentSession.user_agent).kind" class="h-[18px] w-[18px]" />
                <span class="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-neutral-900">{{ deviceName(currentSession.user_agent) }}</p>
                <p class="truncate text-xs text-neutral-500">
                  <span class="font-medium text-emerald-600">Active now</span>
                  <template v-if="currentSession.ip"> · {{ currentSession.ip }}</template>
                  · Signed in {{ formatDate(currentSession.created_at) }}
                </p>
              </div>
            </div>
          </section>

          <!-- everywhere else -->
          <section class="mt-4 rounded-xl border border-neutral-200">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3.5">
              <div>
                <h2 class="text-sm font-semibold text-neutral-900">
                  Other devices
                  <span v-if="otherSessions.length" class="ml-1 font-normal text-neutral-400">{{ otherSessions.length }}</span>
                </h2>
                <p class="mt-0.5 text-xs text-neutral-500">Changing your password signs them all out.</p>
              </div>
              <BaseButton v-if="otherSessions.length > 1" variant="danger" size="sm" :block="false" @click="confirmEndOthers = true">
                Sign out all
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
                    <span v-if="isRecent(s)" class="text-emerald-600">Active recently</span>
                    <template v-else>Active {{ timeAgo(s.last_used_at) }}</template>
                    <template v-if="s.ip"> · {{ s.ip }}</template>
                    <span class="hidden sm:inline"> · Signed in {{ formatDate(s.created_at) }}</span>
                  </p>
                </div>
                <button
                  type="button"
                  class="shrink-0 rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-50"
                  :disabled="endingId === s.id"
                  @click="signOut(s)"
                >
                  {{ endingId === s.id ? 'Signing out…' : 'Sign out' }}
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
                <p class="text-sm text-neutral-900">You're signed in only on this device.</p>
                <p class="text-xs text-neutral-500">Sign in anywhere else and it shows up here.</p>
              </div>
            </div>
          </section>
        </template>

        <ConfirmDialog
          v-model:open="confirmEndOthers"
          title="Sign out other devices?"
          :description="`${otherSessions.length} other ${otherSessions.length === 1 ? 'device' : 'devices'} will need to sign in again. They stay in for a few minutes at most.`"
          confirm-label="Sign out"
          :loading="endingOthers"
          @confirm="signOutOthers"
        />
      </template>

      <section v-else class="rounded-xl border border-neutral-200 p-5">
        <p class="text-sm text-neutral-500">Confirm the change with your current password. Your other devices will be signed out.</p>
        <form :key="passwordKey" class="mt-4 space-y-4" novalidate @submit.prevent="savePassword">
          <FormError :message="passwordForm.formError" />
          <PasswordInput
            v-bind="passwordForm.field('current_password')"
            label="Current password"
            autocomplete="current-password"
          />
          <PasswordInput
            v-bind="passwordForm.field('password')"
            label="New password"
            autocomplete="new-password"
            :hint="`At least ${LIMITS.password} characters.`"
          />
          <PasswordInput
            v-bind="passwordForm.field('password_confirmation')"
            label="Confirm new password"
            autocomplete="new-password"
          />
          <div class="flex justify-end">
            <BaseButton type="submit" size="sm" :block="false" :loading="passwordForm.submitting" :disabled="passwordForm.submitting">
              Change password
            </BaseButton>
          </div>
        </form>
      </section>
    </div>
  </DashboardLayout>
</template>
