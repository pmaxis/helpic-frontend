<script setup lang="ts">
import { z } from 'zod'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useForm } from '@/composables/useForm'
import { across, currentPassword, email, LIMITS, newPassword, requiredText } from '@/utils/validation'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import FormError from '@/components/auth/FormError.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'

const auth = useAuthStore()
const router = useRouter()

const schema = z
  .object({
    name: requiredText('Name', LIMITS.name),
    email: email(),
    password: newPassword(),
    password_confirmation: currentPassword('Please confirm your password'),
  })
  .refine(...across('password_confirmation', (v) => v.password === v.password_confirmation, 'Passwords do not match'))

const form = useForm(schema, { name: '', email: '', password: '', password_confirmation: '' })

function onSubmit() {
  void form.submit(async (data) => {
    await auth.register(data)
    // Auto sign-in after successful registration.
    await auth.login({ email: data.email, password: data.password })
    await router.replace('/dashboard')
  })
}
</script>

<template>
  <AuthLayout>
    <AuthCard title="Create your account" subtitle="For freelancers. Invite your clients and get their tasks in one place.">
      <form class="space-y-5" novalidate @submit.prevent="onSubmit">
        <FormError :message="form.formError" />

        <BaseInput v-bind="form.field('name')" label="Your name" autocomplete="name" placeholder="Jane Doe" size="lg" />
        <BaseInput
          v-bind="form.field('email')"
          label="Email"
          type="email"
          autocomplete="email"
          placeholder="you@example.com"
          size="lg"
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </template>
        </BaseInput>
        <PasswordInput
          v-bind="form.field('password')"
          label="Password"
          autocomplete="new-password"
          :hint="`At least ${LIMITS.password} characters.`"
        />
        <PasswordInput v-bind="form.field('password_confirmation')" label="Confirm password" autocomplete="new-password" />

        <div class="pt-1">
          <BaseButton type="submit" class="h-10" :loading="form.submitting" :disabled="form.submitting">
            Create account
          </BaseButton>
        </div>
      </form>

      <template #footer>
        Already have an account?
        <RouterLink to="/login" class="font-medium text-neutral-900 underline-offset-4 hover:underline">
          Sign in
        </RouterLink>
      </template>
    </AuthCard>
  </AuthLayout>
</template>
