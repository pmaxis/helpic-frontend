<script setup lang="ts">
/** Asks for a reset link. The answer doesn't say whether the email has an account. */
import { computed, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { z } from 'zod'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import AuthOutcome from '@/components/auth/AuthOutcome.vue'
import FormError from '@/components/auth/FormError.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { forgotPassword } from '@/services/account'
import { useForm } from '@/composables/useForm'
import { email } from '@/utils/validation'

const route = useRoute()
const { t } = useI18n()
const form = useForm(z.object({ email: email() }), { email: typeof route.query.email === 'string' ? route.query.email : '' })
/** The address the link went to, once sent. */
const sentTo = ref('')
const sentSteps = computed(() => [
  { icon: 'mail' as const, title: t('forgot.next.inbox.title'), text: t('forgot.next.inbox.text') },
  { icon: 'enter' as const, title: t('forgot.next.other.title'), text: t('forgot.next.other.text') },
])

function onSubmit() {
  void form.submit(async (data) => {
    await forgotPassword(data.email)
    sentTo.value = data.email
  })
}
</script>

<template>
  <AuthLayout>
    <AuthOutcome
      v-if="sentTo"
      :title="t('forgot.sentTitle')"
      :subtitle="t('forgot.sentSubtitle', { email: sentTo })"
      :steps="sentSteps"
      action-to="/login"
      :action-label="t('forgot.back')"
    >
      <button type="button" class="mt-3 w-full text-center text-sm font-medium text-neutral-900 underline-offset-4 hover:underline" @click="sentTo = ''">
        {{ t('forgot.tryAnother') }}
      </button>
    </AuthOutcome>

    <AuthCard v-else :title="$t('forgot.title')" :subtitle="$t('forgot.subtitle')">
      <form class="space-y-5" novalidate @submit.prevent="onSubmit">
        <FormError :message="form.formError" />
        <BaseInput v-bind="form.field('email')" :label="$t('login.email')" type="email" autocomplete="email" :placeholder="$t('login.emailPlaceholder')" size="lg" />
        <div class="pt-1">
          <BaseButton type="submit" class="h-10" :loading="form.submitting" :disabled="form.submitting">{{ $t('forgot.submit') }}</BaseButton>
        </div>
      </form>
      <template #footer>
        {{ $t('forgot.remembered') }}
        <RouterLink to="/login" class="font-medium text-neutral-900 underline-offset-4 hover:underline">{{ $t('login.submit') }}</RouterLink>
      </template>
    </AuthCard>
  </AuthLayout>
</template>
