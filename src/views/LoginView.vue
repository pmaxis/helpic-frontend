<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ApiRequestError } from '@/services/api'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import FormError from '@/components/auth/FormError.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive({ email: '', password: '' })
const fieldErrors = reactive<Record<string, string>>({})
const formError = ref('')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(): boolean {
  fieldErrors.email = ''
  fieldErrors.password = ''

  if (!form.email.trim()) fieldErrors.email = 'Email is required'
  else if (!EMAIL_RE.test(form.email.trim())) fieldErrors.email = 'Enter a valid email address'

  if (!form.password) fieldErrors.password = 'Password is required'

  return !fieldErrors.email && !fieldErrors.password
}

async function onSubmit() {
  formError.value = ''
  if (!validate()) return

  try {
    await auth.login({ email: form.email.trim(), password: form.password })
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await router.replace(redirect)
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (error.fields) Object.assign(fieldErrors, error.fields)
      formError.value = error.fields ? '' : error.message
    } else {
      formError.value = 'Something went wrong. Please try again.'
    }
  }
}
</script>

<template>
  <AuthLayout>
    <AuthCard title="Welcome back" subtitle="Sign in to see your tasks and projects.">
      <form class="space-y-5" novalidate @submit.prevent="onSubmit">
        <FormError :message="formError" />

        <BaseInput
          v-model="form.email"
          label="Email"
          type="email"
          autocomplete="email"
          placeholder="you@example.com"
          size="lg"
          :error="fieldErrors.email"
          required
        >
          <template #icon>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
          </template>
        </BaseInput>
        <PasswordInput v-model="form.password" label="Password" autocomplete="current-password" :error="fieldErrors.password" />

        <div class="pt-1">
          <BaseButton type="submit" class="h-10" :loading="auth.isLoading" :disabled="auth.isLoading">
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
