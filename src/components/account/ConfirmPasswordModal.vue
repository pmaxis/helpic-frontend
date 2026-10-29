<script setup lang="ts">
/**
 * Asks for the current password before an account change goes through (a new
 * email, a new password). The change itself is the action: it runs with the
 * password typed here.
 *
 * A wrong password is shown here, to try again. Anything the API says about
 * the change itself (the email is taken, the new password won't do) belongs to
 * the form the change came from: the modal hands it back through "failed" and
 * the page closes it.
 */
import { nextTick, onMounted } from 'vue'
import { z } from 'zod'
import Modal from '@/components/ui/Modal.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import FormError from '@/components/auth/FormError.vue'
import { ApiRequestError } from '@/services/api'
import { useForm } from '@/composables/useForm'
import { currentPassword } from '@/utils/validation'
import { t } from '@/i18n'

const props = defineProps<{
  title: string
  description: string
  confirmLabel: string
  /** A change that can't be undone is red. */
  danger?: boolean
  /** The change, sent with the current password. */
  action: (password: string) => Promise<unknown>
}>()

const emit = defineEmits<{
  close: []
  /** The change went through. */
  done: []
  /** The API refused the change itself, not the password. */
  failed: [error: ApiRequestError]
}>()

const form = useForm(z.object({ current_password: currentPassword(() => t('validation.currentPassword')) }), { current_password: '' })

onMounted(() => {
  void nextTick(() => {
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]')
    dialogs[dialogs.length - 1]?.querySelector<HTMLInputElement>('input[type="password"]')?.focus()
  })
})

function confirm() {
  void form.submit(async ({ current_password }) => {
    try {
      await props.action(current_password)
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields && !error.fields.current_password) {
        emit('failed', error)
        return
      }
      throw error
    }
    emit('done')
  })
}
</script>

<template>
  <Modal :title="title" @close="emit('close')">
    <form id="confirm-password-form" class="space-y-4" novalidate @submit.prevent="confirm">
      <p class="text-sm text-neutral-600">{{ description }}</p>
      <FormError :message="form.formError" />
      <PasswordInput v-bind="form.field('current_password')" :label="$t('settings.confirmPassword.label')" autocomplete="current-password" />
    </form>
    <template #footer>
      <BaseButton variant="ghost" size="sm" :block="false" :disabled="form.submitting" @click="emit('close')">{{ $t('common.cancel') }}</BaseButton>
      <BaseButton
        type="submit"
        form="confirm-password-form"
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
