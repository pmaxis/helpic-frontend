<script setup lang="ts">
/**
 * Settings › Security › Sign-in: the email and the password. Both changes
 * ask for the current password in a modal once their own fields are fine;
 * the modal sends them. Each opens from its row, one at a time.
 */
import { ref } from 'vue'
import { z } from 'zod'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import FormError from '@/components/auth/FormError.vue'
import ConfirmPasswordModal from '@/components/account/ConfirmPasswordModal.vue'
import SettingsGroup from '@/components/account/SettingsGroup.vue'
import SettingsRow from '@/components/account/SettingsRow.vue'
import { useAuthStore } from '@/stores/auth'
import type { ApiRequestError } from '@/services/api'
import { toast } from '@/composables/useToasts'
import { useForm } from '@/composables/useForm'
import { currentPassword, email, LIMITS, newPassword, passwordsMatch } from '@/utils/validation'
import { t } from '@/i18n'

const auth = useAuthStore()

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
</script>

<template>
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
</template>
