<script setup lang="ts">
/** Opened from the sign-up email: creates the account and signs this browser in. */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import AuthOutcome from '@/components/auth/AuthOutcome.vue'
import { ApiRequestError } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { linkToken } from '@/utils/linkToken'

const route = useRoute()
const auth = useAuthStore()
const { t: tr } = useI18n()

const confirmed = ref('')
const failed = ref('')

const failedSteps = computed(() => [
  { icon: 'mail' as const, title: tr('confirmSignup.next.again.title'), text: tr('confirmSignup.next.again.text') },
  { icon: 'enter' as const, title: tr('confirmSignup.next.signIn.title'), text: tr('confirmSignup.next.signIn.text') },
])
const doneSteps = computed(() => [
  { icon: 'enter' as const, title: tr('confirmSignup.done.title'), text: tr('confirmSignup.done.text') },
])

onMounted(async () => {
  const token = linkToken(route)
  if (!token) {
    failed.value = tr('confirmSignup.failedGeneric')
    return
  }
  try {
    const user = await auth.confirmSignup(token)
    confirmed.value = user.email
  } catch (error) {
    failed.value =
      error instanceof ApiRequestError
        ? (Object.values(error.fields ?? {})[0] ?? error.message)
        : tr('confirmSignup.failedGeneric')
  }
})
</script>

<template>
  <AuthLayout>
    <AuthOutcome
      v-if="confirmed"
      :title="tr('confirmSignup.title')"
      :subtitle="tr('confirmSignup.subtitle', { email: confirmed })"
      :steps="doneSteps"
      action-to="/dashboard"
      :action-label="tr('confirmSignup.goToDashboard')"
    />
    <AuthOutcome
      v-else-if="failed"
      :title="tr('confirmSignup.failed')"
      :subtitle="failed"
      :steps="failedSteps"
      action-to="/register"
      :action-label="tr('login.createAccount')"
    />
    <AuthCard v-else :title="tr('confirmSignup.confirming')" />
  </AuthLayout>
</template>
