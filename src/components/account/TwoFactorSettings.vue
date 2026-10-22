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

/** Few enough recovery codes left to say so. */
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
        <span v-if="status.enabled" class="inline-flex items-center gap-3">
          <span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/15 ring-inset">{{
            $t('settings.twoFactor.onBadge')
          }}</span>
          <BaseButton variant="ghost" size="sm" :block="false" class="text-red-600 hover:text-red-700" @click="turningOff = true">
            {{ $t('settings.twoFactor.turnOff') }}
          </BaseButton>
        </span>
        <BaseButton v-else-if="!setup" size="sm" :block="false" @click="askingPassword = true">{{ $t('settings.twoFactor.turnOn') }}</BaseButton>

        <!-- adding the secret to the app, then its first code -->
        <template v-if="setup" #below>
          <form class="space-y-5" data-two-factor-setup novalidate @submit.prevent="enable">
            <div class="flex flex-col gap-5 sm:flex-row sm:items-start">
              <img :src="setup.qr" :alt="$t('settings.twoFactor.qrAlt')" class="h-44 w-44 shrink-0 rounded-lg bg-white p-1 ring-1 ring-neutral-200" />
              <div class="min-w-0 space-y-3 text-sm text-neutral-600">
                <p>{{ $t('settings.twoFactor.scan') }}</p>
                <p>{{ $t('settings.twoFactor.cantScan') }}</p>
                <div class="flex items-center gap-2">
                  <code class="rounded-md bg-neutral-100 px-2.5 py-1.5 font-mono text-xs tracking-wide break-all text-neutral-900 select-all">{{
                    groupedSecret
                  }}</code>
                  <BaseButton variant="ghost" size="sm" :block="false" @click="copy(setup.secret, $t('settings.twoFactor.keyCopied'))">
                    {{ $t('settings.twoFactor.copy') }}
                  </BaseButton>
                </div>
                <p>{{ $t('settings.twoFactor.enterCode') }}</p>
              </div>
            </div>
            <FormError :message="codeForm.formError" />
            <div class="max-w-xs">
              <TwoFactorCodeInput v-bind="codeForm.field('code')" :label="$t('settings.twoFactor.code')" />
            </div>
            <div class="flex justify-end gap-2">
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
        <BaseButton v-if="!recoveryCodes.length" variant="ghost" size="sm" :block="false" @click="renewing = true">
          {{ $t('settings.twoFactor.newCodes') }}
        </BaseButton>

        <!-- new codes, shown this once -->
        <template v-if="recoveryCodes.length" #below>
          <div class="rounded-lg bg-amber-50 px-4 py-3.5 ring-1 ring-amber-600/20 ring-inset" role="status">
            <p class="text-sm font-medium text-amber-900">{{ $t('settings.twoFactor.saveTitle') }}</p>
            <p class="mt-1 text-sm text-amber-800">{{ $t('settings.twoFactor.saveText') }}</p>
            <ul class="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 font-mono text-sm text-neutral-900 sm:grid-cols-5">
              <li v-for="code in recoveryCodes" :key="code" class="select-all">{{ code }}</li>
            </ul>
            <div class="mt-4 flex flex-wrap justify-end gap-2">
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
