<script setup lang="ts">
/** Asks for a reset link. The answer doesn't say whether the email has an account. */
import { ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { z } from 'zod'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import FormError from '@/components/auth/FormError.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { forgotPassword } from '@/services/account'
import { useForm } from '@/composables/useForm'
import { email } from '@/utils/validation'

const route = useRoute()
const form = useForm(z.object({ email: email() }), { email: typeof route.query.email === 'string' ? route.query.email : '' })
/** The address the link went to, once sent. */
const sentTo = ref('')

function onSubmit() {
  void form.submit(async (data) => {
    await forgotPassword(data.email)
    sentTo.value = data.email
  })
}
</script>

<template>
  <AuthLayout>
    <AuthCard
      v-if="sentTo"
      title="Check your email"
      :subtitle="`If ${sentTo} has a Helpic account, we sent it a link to set a new password. It works for an hour.`"
    >
      <p class="text-sm text-neutral-500">
        Nothing there? Check the spam folder, or
        <button type="button" class="font-medium text-neutral-900 underline-offset-4 hover:underline" @click="sentTo = ''">try another email</button>.
      </p>
      <template #footer>
        <RouterLink to="/login" class="font-medium text-neutral-900 underline-offset-4 hover:underline">Back to sign in</RouterLink>
      </template>
    </AuthCard>

    <AuthCard v-else title="Forgot your password?" subtitle="Enter your email and we'll send you a link to set a new one.">
      <form class="space-y-5" novalidate @submit.prevent="onSubmit">
        <FormError :message="form.formError" />
        <BaseInput v-bind="form.field('email')" label="Email" type="email" autocomplete="email" placeholder="you@example.com" size="lg" />
        <div class="pt-1">
          <BaseButton type="submit" class="h-10" :loading="form.submitting" :disabled="form.submitting">Send the link</BaseButton>
        </div>
      </form>
      <template #footer>
        Remembered it?
        <RouterLink to="/login" class="font-medium text-neutral-900 underline-offset-4 hover:underline">Sign in</RouterLink>
      </template>
    </AuthCard>
  </AuthLayout>
</template>
