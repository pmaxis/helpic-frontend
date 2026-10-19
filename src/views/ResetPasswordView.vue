<script setup lang="ts">
/** Opened from a reset email: sets a new password, then off to sign in. */
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { z } from 'zod'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import FormError from '@/components/auth/FormError.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import { resetPassword } from '@/services/account'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/composables/useToasts'
import { useForm } from '@/composables/useForm'
import { currentPassword, LIMITS, newPassword, passwordsMatch } from '@/utils/validation'
import { t } from '@/i18n'
import { linkToken } from '@/utils/linkToken'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const token = linkToken(route)

const schema = z
  .object({ password: newPassword(), password_confirmation: currentPassword(() => t('validation.confirmPassword')) })
  .refine(...passwordsMatch())
const form = useForm(schema, { password: '', password_confirmation: '' })

function onSubmit() {
  void form.submit(async (data) => {
    await resetPassword({ token, ...data })
    // Every device of the account was signed out: this one too, unless it is
    // signed in to another account.
    await auth.fetchCurrentUser()
    if (auth.isAuthenticated) {
      toast.success(t('reset.done'))
      await router.replace('/dashboard')
    } else {
      toast.success(t('reset.doneSignIn'))
      await router.replace({ name: 'login' })
    }
  })
}
</script>

<template>
  <AuthLayout>
    <AuthCard :title="$t('reset.title')" :subtitle="$t('reset.subtitle')">
      <form class="space-y-5" novalidate @submit.prevent="onSubmit">
        <FormError :message="form.formError" />
        <PasswordInput v-bind="form.field('password')" :label="$t('reset.password')" autocomplete="new-password" :hint="$t('validation.passwordHint', { n: LIMITS.password })" />
        <PasswordInput v-bind="form.field('password_confirmation')" :label="$t('reset.confirm')" autocomplete="new-password" />
        <div class="pt-1">
          <BaseButton type="submit" class="h-10" :loading="form.submitting" :disabled="form.submitting">{{ $t('reset.submit') }}</BaseButton>
        </div>
      </form>
      <template #footer>
        {{ $t('reset.expired') }}
        <RouterLink to="/forgot-password" class="font-medium text-neutral-900 underline-offset-4 hover:underline">{{ $t('reset.getNew') }}</RouterLink>
      </template>
    </AuthCard>
  </AuthLayout>
</template>
