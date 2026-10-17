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
import { across, currentPassword, LIMITS, newPassword } from '@/utils/validation'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const token = String(route.params.token)

const schema = z
  .object({ password: newPassword(), password_confirmation: currentPassword('Please confirm your password') })
  .refine(...across('password_confirmation', (v) => v.password === v.password_confirmation, 'Passwords do not match'))
const form = useForm(schema, { password: '', password_confirmation: '' })

function onSubmit() {
  void form.submit(async (data) => {
    await resetPassword({ token, ...data })
    // Every device of the account was signed out: this one too, unless it is
    // signed in to another account.
    await auth.fetchCurrentUser()
    if (auth.isAuthenticated) {
      toast.success('Password set')
      await router.replace('/dashboard')
    } else {
      toast.success('Password set. Sign in with it.')
      await router.replace({ name: 'login' })
    }
  })
}
</script>

<template>
  <AuthLayout>
    <AuthCard title="Set a new password" subtitle="You'll be signed out everywhere and can sign in with the new one.">
      <form class="space-y-5" novalidate @submit.prevent="onSubmit">
        <FormError :message="form.formError" />
        <PasswordInput v-bind="form.field('password')" label="New password" autocomplete="new-password" :hint="`At least ${LIMITS.password} characters.`" />
        <PasswordInput v-bind="form.field('password_confirmation')" label="Confirm new password" autocomplete="new-password" />
        <div class="pt-1">
          <BaseButton type="submit" class="h-10" :loading="form.submitting" :disabled="form.submitting">Set password</BaseButton>
        </div>
      </form>
      <template #footer>
        Link expired?
        <RouterLink to="/forgot-password" class="font-medium text-neutral-900 underline-offset-4 hover:underline">Get a new one</RouterLink>
      </template>
    </AuthCard>
  </AuthLayout>
</template>
