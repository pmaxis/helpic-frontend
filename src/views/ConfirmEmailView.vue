<script setup lang="ts">
/** Opened from the link sent to a new email: confirms it right away. */
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import { confirmEmail } from '@/services/account'
import { ApiRequestError } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { t } from '@/i18n'

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
        : t('confirmEmail.failedGeneric')
  }
})
</script>

<template>
  <AuthLayout>
    <AuthCard v-if="confirmed" :title="$t('confirmEmail.title')" :subtitle="$t('confirmEmail.subtitle', { email: confirmed })">
      <template #footer>
        <RouterLink :to="auth.isAuthenticated ? '/settings?tab=email' : '/login'" class="font-medium text-neutral-900 underline-offset-4 hover:underline">
          {{ auth.isAuthenticated ? $t('confirmEmail.backToSettings') : $t('confirmEmail.signIn') }}
        </RouterLink>
      </template>
    </AuthCard>
    <AuthCard v-else-if="failed" :title="$t('confirmEmail.failed')" :subtitle="failed">
      <template #footer>
        <RouterLink :to="auth.isAuthenticated ? '/settings?tab=email' : '/login'" class="font-medium text-neutral-900 underline-offset-4 hover:underline">
          {{ auth.isAuthenticated ? $t('confirmEmail.backToSettings') : $t('confirmEmail.signIn') }}
        </RouterLink>
      </template>
    </AuthCard>
    <AuthCard v-else :title="$t('confirmEmail.confirming')" />
  </AuthLayout>
</template>
