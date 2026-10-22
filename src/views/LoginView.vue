<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { z } from 'zod'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ApiRequestError } from '@/services/api'
import { useForm } from '@/composables/useForm'
import { currentPassword, email, twoFactorCode } from '@/utils/validation'
import { TWO_FACTOR_REQUIRED } from '@/types/auth'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import FormError from '@/components/auth/FormError.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import TwoFactorCodeInput from '@/components/auth/TwoFactorCodeInput.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

/** The password was right and the account has two-factor on: the second step asks for a code. */
const needsCode = ref(false)

const schema = computed(() =>
  z.object({ email: email(), password: currentPassword(), code: needsCode.value ? twoFactorCode() : z.string() }),
)
const form = useForm(schema, { email: '', password: '', code: '' })

function focusCode() {
  void nextTick(() => document.querySelector<HTMLInputElement>('[data-two-factor-code] input')?.focus())
}

function onSubmit() {
  void form.submit(async (data) => {
    try {
      await auth.login({ email: data.email, password: data.password, ...(needsCode.value ? { code: data.code } : {}) })
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === TWO_FACTOR_REQUIRED) {
        needsCode.value = true
        focusCode()
        return
      }
      throw error
    }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    await router.replace(redirect)
  })
}

/** Back to the email and password, say to sign in with another account. */
function back() {
  needsCode.value = false
  form.reset({ email: form.values.email, password: '', code: '' })
}
</script>

<template>
  <AuthLayout>
    <AuthCard v-if="needsCode" :title="$t('login.codeTitle')" :subtitle="$t('login.codeSubtitle', { email: form.values.email.trim() })">
      <form class="space-y-5" novalidate @submit.prevent="onSubmit">
        <FormError :message="form.formError" />
        <TwoFactorCodeInput v-bind="form.field('code')" :label="$t('login.code')" :hint="$t('login.codeHint')" size="lg" />
        <div class="pt-1">
          <BaseButton type="submit" class="h-10" :loading="form.submitting" :disabled="form.submitting">
            {{ $t('login.verify') }}
          </BaseButton>
        </div>
      </form>

      <template #footer>
        <button type="button" class="font-medium text-neutral-900 underline-offset-4 hover:underline" @click="back">
          {{ $t('login.back') }}
        </button>
      </template>
    </AuthCard>

    <AuthCard v-else :title="$t('login.title')" :subtitle="$t('login.subtitle')">
      <form class="space-y-5" novalidate @submit.prevent="onSubmit">
        <FormError :message="form.formError" />

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
        <div>
          <PasswordInput v-bind="form.field('password')" :label="$t('login.password')" autocomplete="current-password" />
          <div class="mt-2 text-right">
            <RouterLink
              :to="{ name: 'forgot-password', query: form.values.email.trim() ? { email: form.values.email.trim() } : {} }"
              class="text-sm text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
            >
              {{ $t('login.forgot') }}
            </RouterLink>
          </div>
        </div>

        <div class="pt-1">
          <BaseButton type="submit" class="h-10" :loading="form.submitting" :disabled="form.submitting">
            {{ $t('login.submit') }}
          </BaseButton>
        </div>
      </form>

      <template #footer>
        {{ $t('login.newHere') }}
        <RouterLink to="/register" class="font-medium text-neutral-900 underline-offset-4 hover:underline">
          {{ $t('login.createAccount') }}
        </RouterLink>
      </template>
    </AuthCard>
  </AuthLayout>
</template>
