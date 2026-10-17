<script setup lang="ts">
import { z } from 'zod'
import { useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useForm } from '@/composables/useForm'
import { currentPassword, email, LIMITS, newPassword, passwordsMatch, requiredText } from '@/utils/validation'
import { t } from '@/i18n'
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
    name: requiredText('name', LIMITS.name),
    email: email(),
    password: newPassword(),
    password_confirmation: currentPassword(() => t('validation.confirmPassword')),
  })
  .refine(...passwordsMatch())

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
    <AuthCard :title="$t('register.title')" :subtitle="$t('register.subtitle')">
      <form class="space-y-5" novalidate @submit.prevent="onSubmit">
        <FormError :message="form.formError" />

        <BaseInput v-bind="form.field('name')" :label="$t('register.name')" autocomplete="name" :placeholder="$t('register.namePlaceholder')" size="lg" />
        <BaseInput
          v-bind="form.field('email')"
          :label="$t('login.email')"
          type="email"
          autocomplete="email"
          :placeholder="$t('login.emailPlaceholder')"
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
          :label="$t('login.password')"
          autocomplete="new-password"
          :hint="$t('validation.passwordHint', { n: LIMITS.password })"
        />
        <PasswordInput v-bind="form.field('password_confirmation')" :label="$t('register.confirmPassword')" autocomplete="new-password" />

        <div class="pt-1">
          <BaseButton type="submit" class="h-10" :loading="form.submitting" :disabled="form.submitting">
            {{ $t('register.submit') }}
          </BaseButton>
        </div>
      </form>

      <template #footer>
        {{ $t('register.haveAccount') }}
        <RouterLink to="/login" class="font-medium text-neutral-900 underline-offset-4 hover:underline">
          {{ $t('register.signIn') }}
        </RouterLink>
      </template>
    </AuthCard>
  </AuthLayout>
</template>
