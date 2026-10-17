<script setup lang="ts">
import { z } from 'zod'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useForm } from '@/composables/useForm'
import { currentPassword, email } from '@/utils/validation'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import FormError from '@/components/auth/FormError.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = useForm(z.object({ email: email(), password: currentPassword() }), { email: '', password: '' })

function onSubmit() {
  void form.submit(async (data) => {
    await auth.login(data)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await router.replace(redirect)
  })
}
</script>

<template>
  <AuthLayout>
    <AuthCard title="Welcome back" subtitle="Sign in to see your tasks and projects.">
      <form class="space-y-5" novalidate @submit.prevent="onSubmit">
        <FormError :message="form.formError" />

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
        <div>
          <PasswordInput v-bind="form.field('password')" label="Password" autocomplete="current-password" />
          <div class="mt-2 text-right">
            <RouterLink
              :to="{ name: 'forgot-password', query: form.values.email.trim() ? { email: form.values.email.trim() } : {} }"
              class="text-sm text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
            >
              Forgot password?
            </RouterLink>
          </div>
        </div>

        <div class="pt-1">
          <BaseButton type="submit" class="h-10" :loading="form.submitting" :disabled="form.submitting">
            Sign in
          </BaseButton>
        </div>
      </form>

      <template #footer>
        New to Helpic?
        <RouterLink to="/register" class="font-medium text-neutral-900 underline-offset-4 hover:underline">
          Create an account
        </RouterLink>
      </template>
    </AuthCard>
  </AuthLayout>
</template>
