<script setup lang="ts">
/** Opened from the link sent to a new email: confirms it right away. */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import AuthOutcome from '@/components/auth/AuthOutcome.vue'
import { confirmEmail } from '@/services/account'
import { ApiRequestError } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { linkToken } from '@/utils/linkToken'

const route = useRoute()
const auth = useAuthStore()
const { t: tr } = useI18n()

const confirmed = ref('')
const failed = ref('')

const home = computed(() => (auth.isAuthenticated ? '/settings?tab=security' : '/login'))
const homeLabel = computed(() => (auth.isAuthenticated ? tr('confirmEmail.backToSettings') : tr('invite.goToSignIn')))

const failedSteps = computed(() =>
  auth.isAuthenticated
    ? [
        { icon: 'mail' as const, title: tr('confirmEmail.next.send.title'), text: tr('confirmEmail.next.send.textSignedIn') },
        { icon: 'enter' as const, title: tr('confirmEmail.next.keep.title'), text: tr('confirmEmail.next.keep.text') },
      ]
    : [
        { icon: 'mail' as const, title: tr('confirmEmail.next.send.title'), text: tr('confirmEmail.next.send.text') },
        { icon: 'enter' as const, title: tr('confirmEmail.next.already.title'), text: tr('confirmEmail.next.already.text') },
      ],
)

const doneSteps = computed(() =>
  auth.isAuthenticated
    ? [{ icon: 'enter' as const, title: tr('confirmEmail.done.signedInTitle'), text: tr('confirmEmail.done.signedInText') }]
    : [{ icon: 'enter' as const, title: tr('confirmEmail.done.title'), text: tr('confirmEmail.done.text') }],
)

onMounted(async () => {
  try {
    const user = await confirmEmail(linkToken(route))
    confirmed.value = user.email
    // Signed in as this account here: show the new email at once.
    if (auth.user?.id === user.id) auth.setUser(user)
  } catch (error) {
    failed.value =
      error instanceof ApiRequestError
        ? (Object.values(error.fields ?? {})[0] ?? error.message)
        : tr('confirmEmail.failedGeneric')
  }
})
</script>

<template>
  <AuthLayout>
    <AuthOutcome
      v-if="confirmed"
      :title="tr('confirmEmail.title')"
      :subtitle="tr('confirmEmail.subtitle', { email: confirmed })"
      :steps="doneSteps"
      :action-to="home"
      :action-label="homeLabel"
    />
    <AuthOutcome
      v-else-if="failed"
      :title="tr('confirmEmail.failed')"
      :subtitle="failed"
      :steps="failedSteps"
      :action-to="home"
      :action-label="homeLabel"
    />
    <AuthCard v-else :title="tr('confirmEmail.confirming')" />
  </AuthLayout>
</template>
