<script setup lang="ts">
/** Opened from the link sent to a new email: confirms it right away. */
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import { confirmEmail } from '@/services/account'
import { ApiRequestError } from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()

const confirmed = ref('')
const failed = ref('')

onMounted(async () => {
  try {
    const user = await confirmEmail(String(route.params.token))
    confirmed.value = user.email
    // Signed in as this account here: show the new email at once.
    if (auth.user?.id === user.id) auth.setUser(user)
  } catch (error) {
    failed.value =
      error instanceof ApiRequestError
        ? (Object.values(error.fields ?? {})[0] ?? error.message)
        : 'Could not confirm the email. Please try again.'
  }
})
</script>

<template>
  <AuthLayout>
    <AuthCard v-if="confirmed" title="Email confirmed" :subtitle="`You now sign in to Helpic with ${confirmed}.`">
      <template #footer>
        <RouterLink :to="auth.isAuthenticated ? '/settings?tab=email' : '/login'" class="font-medium text-neutral-900 underline-offset-4 hover:underline">
          {{ auth.isAuthenticated ? 'Back to settings' : 'Sign in' }}
        </RouterLink>
      </template>
    </AuthCard>
    <AuthCard v-else-if="failed" title="Couldn't confirm the email" :subtitle="failed">
      <template #footer>
        <RouterLink :to="auth.isAuthenticated ? '/settings?tab=email' : '/login'" class="font-medium text-neutral-900 underline-offset-4 hover:underline">
          {{ auth.isAuthenticated ? 'Back to settings' : 'Sign in' }}
        </RouterLink>
      </template>
    </AuthCard>
    <AuthCard v-else title="Confirming your email…" />
  </AuthLayout>
</template>
