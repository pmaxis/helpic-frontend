<script setup lang="ts">
/**
 * Asks for the current password and a second factor before a change to
 * two-factor sign-in goes through (turning it off, new recovery codes): a
 * stolen session, or a password alone, can't make it. The change is the
 * action; whatever the API says about either field is shown on it.
 */
import { nextTick, onMounted } from 'vue'
import { z } from 'zod'
import Modal from '@/components/ui/Modal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import TwoFactorCodeInput from '@/components/auth/TwoFactorCodeInput.vue'
import FormError from '@/components/auth/FormError.vue'
import { useForm } from '@/composables/useForm'
import { currentPassword, twoFactorCode } from '@/utils/validation'
import { t } from '@/i18n'

const props = defineProps<{
  title: string
  description: string
  confirmLabel: string
  /** Turning off is red; new codes aren't. */
  danger?: boolean
  /** The change, sent with the password and the code. */
  action: (input: { current_password: string; code: string }) => Promise<unknown>
}>()

const emit = defineEmits<{
  close: []
  /** The change went through. */
  done: []
}>()

const form = useForm(z.object({ current_password: currentPassword(() => t('validation.currentPassword')), code: twoFactorCode() }), {
  current_password: '',
  code: '',
})

onMounted(() => {
  void nextTick(() => {
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]')
    dialogs[dialogs.length - 1]?.querySelector<HTMLInputElement>('input[type="password"]')?.focus()
  })
})

function confirm() {
  void form.submit(async (data) => {
    await props.action(data)
    emit('done')
  })
}
</script>

<template>
  <Modal :title="title" @close="emit('close')">
    <form id="confirm-two-factor-form" class="space-y-4" novalidate @submit.prevent="confirm">
      <p class="text-sm text-neutral-600">{{ description }}</p>
      <FormError :message="form.formError" />
      <PasswordInput v-bind="form.field('current_password')" :label="$t('settings.confirmPassword.label')" autocomplete="current-password" />
      <TwoFactorCodeInput v-bind="form.field('code')" :label="$t('settings.twoFactor.codeOrRecovery')" />
    </form>
    <template #footer>
      <BaseButton variant="ghost" size="sm" :block="false" :disabled="form.submitting" @click="emit('close')">{{ $t('common.cancel') }}</BaseButton>
      <BaseButton
        type="submit"
        form="confirm-two-factor-form"
        size="sm"
        :block="false"
        :variant="danger ? 'danger' : 'primary'"
        :loading="form.submitting"
        :disabled="form.submitting"
      >
        {{ confirmLabel }}
      </BaseButton>
    </template>
  </Modal>
</template>
