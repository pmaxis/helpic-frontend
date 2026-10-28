<script setup lang="ts">
import { computed, ref } from 'vue'
import { z } from 'zod'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useForm } from '@/composables/useForm'
import { currentPassword, email, LIMITS, newPassword, passwordsMatch, requiredText } from '@/utils/validation'
import { t } from '@/i18n'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import AuthOutcome from '@/components/auth/AuthOutcome.vue'
import FormError from '@/components/auth/FormError.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'

const auth = useAuthStore()
const route = useRoute()
const { t: tr } = useI18n()

type SignupRole = 'freelancer' | 'client'
const ROLES: SignupRole[] = ['freelancer', 'client']
/** Who signs up; a link can pick it (/register?role=client), a freelancer otherwise. */
const role = ref<SignupRole>(route.query.role === 'client' ? 'client' : 'freelancer')

const schema = z
  .object({
    name: requiredText('name', LIMITS.name),
    email: email(),
    password: newPassword(),
    password_confirmation: currentPassword(() => t('validation.confirmPassword')),
  })
  .refine(...passwordsMatch())

const form = useForm(schema, { name: '', email: '', password: '', password_confirmation: '' })
/** The address the confirmation link went to, once sent. */
const sentTo = ref('')
const sentSteps = computed(() => [
  { icon: 'mail' as const, title: tr('register.next.inbox.title'), text: tr('register.next.inbox.text') },
  { icon: 'enter' as const, title: tr('register.next.open.title'), text: tr('register.next.open.text') },
])

function onSubmit() {
  void form.submit(async (data) => {
    await auth.register({ ...data, role: role.value })
    sentTo.value = data.email
  })
}
</script>

<template>
  <AuthLayout>
    <AuthOutcome
      v-if="sentTo"
      :title="tr('register.sentTitle')"
      :subtitle="tr('register.sentSubtitle', { email: sentTo })"
      :steps="sentSteps"
      action-to="/login"
      :action-label="tr('forgot.back')"
    />

    <AuthCard v-else :title="$t('register.title')" :subtitle="role === 'client' ? $t('register.subtitleClient') : $t('register.subtitle')">
      <form class="space-y-5" novalidate @submit.prevent="onSubmit">
        <FormError :message="form.formError" />

        <div class="grid grid-cols-2 rounded-lg border border-neutral-200 bg-neutral-100 p-[3px] text-sm" role="group" :aria-label="$t('register.as')">
          <button
            v-for="r in ROLES"
            :key="r"
            type="button"
            class="h-8 rounded-md font-medium transition-colors"
            :class="role === r ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-500 hover:text-neutral-900'"
            :aria-pressed="role === r"
            @click="role = r"
          >
            {{ $t(`register.roles.${r}`) }}
          </button>
        </div>

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
          <i18n-t keypath="policies.agree" tag="p" scope="global" class="mt-3 text-center text-xs leading-relaxed text-neutral-500">
            <template #terms>
              <RouterLink to="/terms" class="text-neutral-700 underline underline-offset-2 hover:text-neutral-900">{{ $t('policies.agreeTerms') }}</RouterLink>
            </template>
            <template #privacy>
              <RouterLink to="/privacy" class="text-neutral-700 underline underline-offset-2 hover:text-neutral-900">{{ $t('policies.agreePrivacy') }}</RouterLink>
            </template>
          </i18n-t>
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
