<script setup lang="ts">
/**
 * Two-factor sign-in: a code from an authenticator app on top of the
 * password. Turning it on takes the password, then the app gets the secret
 * (a QR code, or the key typed in) and confirms it with its first code; the
 * recovery codes are shown then, once. Turning it off and making new
 * recovery codes take the password and a code.
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import { z } from 'zod'
import BaseButton from '@/components/ui/BaseButton.vue'
import FormError from '@/components/auth/FormError.vue'
import TwoFactorCodeInput from '@/components/auth/TwoFactorCodeInput.vue'
import ConfirmPasswordModal from '@/components/account/ConfirmPasswordModal.vue'
import ConfirmTwoFactorModal from '@/components/account/ConfirmTwoFactorModal.vue'
import SettingsGroup from '@/components/account/SettingsGroup.vue'
import SettingsRow from '@/components/account/SettingsRow.vue'
import { useAuthStore } from '@/stores/auth'
import { ApiRequestError } from '@/services/api'
import { beginTwoFactor, disableTwoFactor, enableTwoFactor, fetchTwoFactor, renewRecoveryCodes } from '@/services/twoFactor'
import { toast } from '@/composables/useToasts'
import { useForm } from '@/composables/useForm'
import { twoFactorCode } from '@/utils/validation'
import { t } from '@/i18n'
import type { TwoFactorSetup, TwoFactorStatus } from '@/types/auth'

const emit = defineEmits<{
  /** Turning it on signed the other devices out. */
  enabled: []
}>()

const auth = useAuthStore()

const status = ref<TwoFactorStatus | null>(null)
const loadFailed = ref(false)

async function load() {
  try {
    status.value = await fetchTwoFactor()
  } catch {
    loadFailed.value = true
  }
}
onMounted(load)

/** How many recovery codes a set has, and few enough left to say so. */
const SET = 10
const LOW = 3
const lowOnCodes = computed(() => !!status.value?.enabled && status.value.recovery_codes_left <= LOW)

// --- turning on ---------------------------------------------------------------------

/** The password modal before setup starts. */
const askingPassword = ref(false)
/** The secret waiting for the app's first code. */
const setup = ref<TwoFactorSetup | null>(null)
const codeForm = useForm(z.object({ code: twoFactorCode() }), { code: '' })

async function begin(password: string) {
  setup.value = await beginTwoFactor(password)
  codeForm.reset()
}

/** Anything but a wrong password (it's on already, say) closes the modal and says why. */
function setupRefused(error: ApiRequestError) {
  askingPassword.value = false
  toast.error(error.message)
}

function setupStarted() {
  askingPassword.value = false
  void nextTick(() => document.querySelector<HTMLInputElement>('[data-two-factor-setup] [data-two-factor-code] input')?.focus())
}

function enable() {
  void codeForm.submit(async ({ code }) => {
    const { user, recovery_codes } = await enableTwoFactor(code)
    auth.setUser(user)
    setup.value = null
    recoveryCodes.value = recovery_codes
    status.value = { enabled: true, recovery_codes_left: recovery_codes.length }
    toast.success(t('settings.twoFactor.enabled'))
    emit('enabled')
  })
}

/** The secret in groups of four, easier to type into an app. */
const groupedSecret = computed(() => setup.value?.secret.match(/.{1,4}/g)?.join(' ') ?? '')

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(done)
  } catch {
    toast.error(t('settings.twoFactor.copyFailed'))
  }
}

// --- recovery codes -----------------------------------------------------------------

/** New recovery codes, shown until they're said to be saved. */
const recoveryCodes = ref<string[]>([])
const renewing = ref(false)

async function renew(input: { current_password: string; code: string }) {
  recoveryCodes.value = await renewRecoveryCodes(input)
}

function renewed() {
  renewing.value = false
  status.value = { enabled: true, recovery_codes_left: recoveryCodes.value.length }
}

/** A text file of the codes, to keep with the account's other secrets. */
function download() {
  const text = [t('settings.twoFactor.fileHeader', { email: auth.user?.email ?? '' }), '', ...recoveryCodes.value, ''].join('\n')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'helpic-recovery-codes.txt'
  a.click()
  URL.revokeObjectURL(url)
}

// --- turning off --------------------------------------------------------------------

const turningOff = ref(false)

async function disable(input: { current_password: string; code: string }) {
  auth.setUser(await disableTwoFactor(input))
}

function disabled() {
  turningOff.value = false
  recoveryCodes.value = []
  status.value = { enabled: false, recovery_codes_left: 0 }
  toast.success(t('settings.twoFactor.disabled'))
}
</script>

<template>
  <SettingsGroup :title="$t('settings.twoFactor.title')" :description="$t('settings.twoFactor.text')">
    <div v-if="!status && !loadFailed" class="h-[72px] animate-pulse rounded-xl bg-neutral-100" aria-busy="true" />
    <SettingsRow v-else-if="loadFailed" :label="$t('settings.twoFactor.app')" :hint="$t('settings.twoFactor.loadFailed')" />

    <template v-else-if="status">
      <SettingsRow
        :label="$t('settings.twoFactor.app')"
        :hint="status.enabled ? $t('settings.twoFactor.on') : setup ? $t('settings.twoFactor.setupHint') : $t('settings.twoFactor.off')"
      >
        <!-- a shield: green and checked when on, amber while the password alone lets anyone in -->
        <template #icon>
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            :class="status.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path v-if="status.enabled" d="m9 12 2 2 4-4" />
              <path v-else d="M12 8v4M12 16h.01" />
            </svg>
          </span>
        </template>
        <template #badge>
          <span
            class="rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset"
            :class="status.enabled ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/15' : 'bg-neutral-100 text-neutral-600 ring-neutral-500/10'"
          >
            {{ status.enabled ? $t('settings.twoFactor.onBadge') : $t('settings.twoFactor.offBadge') }}
          </span>
        </template>

        <BaseButton v-if="status.enabled" variant="ghost" size="sm" :block="false" class="text-red-600 hover:text-red-700" @click="turningOff = true">
          {{ $t('settings.twoFactor.turnOff') }}
        </BaseButton>
        <BaseButton v-else-if="!setup" size="sm" :block="false" @click="askingPassword = true">{{ $t('settings.twoFactor.turnOn') }}</BaseButton>

        <!-- two steps: the secret into the app, then the app's first code -->
        <template v-if="setup" #below>
          <form class="rounded-xl bg-neutral-50 p-4 ring-1 ring-neutral-200 ring-inset sm:p-5" data-two-factor-setup novalidate @submit.prevent="enable">
            <ol class="space-y-6">
              <li class="flex gap-3">
                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">1</span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-neutral-900">{{ $t('settings.twoFactor.stepScan') }}</p>
                  <p class="mt-0.5 text-sm text-neutral-500">{{ $t('settings.twoFactor.scan') }}</p>
                  <div class="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <img :src="setup.qr" :alt="$t('settings.twoFactor.qrAlt')" class="h-40 w-40 shrink-0 rounded-lg bg-white p-1.5 ring-1 ring-neutral-200" />
                    <div class="min-w-0 space-y-2">
                      <p class="text-xs text-neutral-500">{{ $t('settings.twoFactor.cantScan') }}</p>
                      <div class="flex flex-wrap items-center gap-2">
                        <code
                          class="rounded-md bg-white px-2.5 py-1.5 font-mono text-xs tracking-wider break-all text-neutral-900 ring-1 ring-neutral-200 select-all"
                          >{{ groupedSecret }}</code
                        >
                        <BaseButton variant="ghost" size="sm" :block="false" @click="copy(setup.secret, $t('settings.twoFactor.keyCopied'))">
                          {{ $t('settings.twoFactor.copy') }}
                        </BaseButton>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
              <li class="flex gap-3">
                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">2</span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-neutral-900">{{ $t('settings.twoFactor.stepCode') }}</p>
                  <p class="mt-0.5 text-sm text-neutral-500">{{ $t('settings.twoFactor.enterCode') }}</p>
                  <FormError class="mt-3" :message="codeForm.formError" />
                  <div class="mt-3 max-w-xs">
                    <TwoFactorCodeInput v-bind="codeForm.field('code')" :label="$t('settings.twoFactor.code')" />
                  </div>
                </div>
              </li>
            </ol>
            <div class="mt-5 flex justify-end gap-2 border-t border-neutral-200 pt-4">
              <BaseButton variant="ghost" size="sm" :block="false" :disabled="codeForm.submitting" @click="setup = null">{{
                $t('common.cancel')
              }}</BaseButton>
              <BaseButton type="submit" size="sm" :block="false" :loading="codeForm.submitting" :disabled="codeForm.submitting">
                {{ $t('settings.twoFactor.turnOn') }}
              </BaseButton>
            </div>
          </form>
        </template>
      </SettingsRow>

      <SettingsRow
        v-if="status.enabled"
        :label="$t('settings.twoFactor.recovery')"
        :hint="lowOnCodes ? $t('settings.twoFactor.recoveryLow', { n: status.recovery_codes_left }) : $t('settings.twoFactor.recoveryLeft', { n: status.recovery_codes_left })"
      >
        <template #icon>
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            :class="lowOnCodes ? 'bg-amber-50 text-amber-600' : 'bg-neutral-100 text-neutral-600'"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
              <circle cx="7.5" cy="15.5" r="4.5" />
              <path d="m10.7 12.3 9.3-9.3M16 7l3 3M18 5l2 2" />
            </svg>
          </span>
        </template>
        <!-- one segment a code, the unused ones filled -->
        <template #extra>
          <div class="mt-2 flex gap-1" aria-hidden="true">
            <span
              v-for="i in SET"
              :key="i"
              class="h-1.5 w-4 rounded-full"
              :class="i <= status.recovery_codes_left ? (lowOnCodes ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-neutral-200'"
            />
          </div>
        </template>

        <BaseButton v-if="!recoveryCodes.length" variant="ghost" size="sm" :block="false" @click="renewing = true">
          {{ $t('settings.twoFactor.newCodes') }}
        </BaseButton>

        <!-- new codes, shown this once -->
        <template v-if="recoveryCodes.length" #below>
          <div class="overflow-hidden rounded-xl ring-1 ring-amber-600/20 ring-inset" role="status">
            <div class="flex gap-3 bg-amber-50 px-4 py-3.5">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                aria-hidden="true"
              >
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />
              </svg>
              <div>
                <p class="text-sm font-medium text-amber-900">{{ $t('settings.twoFactor.saveTitle') }}</p>
                <p class="mt-0.5 text-sm text-amber-800">{{ $t('settings.twoFactor.saveText') }}</p>
              </div>
            </div>
            <ol class="grid grid-cols-2 gap-x-6 gap-y-2 bg-white px-4 py-4 font-mono text-sm text-neutral-900 sm:grid-cols-5">
              <li v-for="(code, i) in recoveryCodes" :key="code" class="flex items-baseline gap-2">
                <span class="w-4 text-right text-xs text-neutral-400 tabular-nums select-none">{{ i + 1 }}</span>
                <span class="select-all">{{ code }}</span>
              </li>
            </ol>
            <div class="flex flex-wrap justify-end gap-2 border-t border-neutral-100 bg-white px-4 py-3">
              <BaseButton variant="ghost" size="sm" :block="false" @click="copy(recoveryCodes.join('\n'), $t('settings.twoFactor.codesCopied'))">
                {{ $t('settings.twoFactor.copy') }}
              </BaseButton>
              <BaseButton variant="ghost" size="sm" :block="false" @click="download">{{ $t('settings.twoFactor.download') }}</BaseButton>
              <BaseButton size="sm" :block="false" @click="recoveryCodes = []">{{ $t('settings.twoFactor.saved') }}</BaseButton>
            </div>
          </div>
        </template>
      </SettingsRow>
    </template>

    <ConfirmPasswordModal
      v-if="askingPassword"
      :title="$t('settings.confirmPassword.title')"
      :description="$t('settings.twoFactor.confirmOn')"
      :confirm-label="$t('settings.twoFactor.continue')"
      :action="begin"
      @close="askingPassword = false"
      @done="setupStarted"
      @failed="setupRefused"
    />
    <ConfirmTwoFactorModal
      v-if="turningOff"
      danger
      :title="$t('settings.twoFactor.confirmOffTitle')"
      :description="$t('settings.twoFactor.confirmOff')"
      :confirm-label="$t('settings.twoFactor.turnOff')"
      :action="disable"
      @close="turningOff = false"
      @done="disabled"
    />
    <ConfirmTwoFactorModal
      v-if="renewing"
      :title="$t('settings.twoFactor.confirmNewTitle')"
      :description="$t('settings.twoFactor.confirmNew')"
      :confirm-label="$t('settings.twoFactor.newCodes')"
      :action="renew"
      @close="renewing = false"
      @done="renewed"
    />
  </SettingsGroup>
</template>
