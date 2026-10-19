<script setup lang="ts">
/** Shown when an invite link is dead, or the lookup itself failed. */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AuthCard from '@/components/auth/AuthCard.vue'
import AuthOutcome from '@/components/auth/AuthOutcome.vue'
import BaseButton from '@/components/ui/BaseButton.vue'

defineProps<{
  /** The server's reason, or a generic load failure. */
  message: string
  /** The link is invalid, already used, or expired. */
  gone?: boolean
}>()

const { t } = useI18n()

const steps = computed(() => [
  { icon: 'mail' as const, title: t('invite.next.ask.title'), text: t('invite.next.ask.text') },
  { icon: 'enter' as const, title: t('invite.next.account.title'), text: t('invite.next.account.text') },
])

function retry() {
  window.location.reload()
}
</script>

<template>
  <AuthOutcome
    v-if="gone"
    :title="t('invite.unavailable')"
    :subtitle="message"
    :steps="steps"
    action-to="/login"
    :action-label="t('invite.goToSignIn')"
  />

  <AuthCard v-else :title="t('invite.unavailable')" :subtitle="message">
    <div class="pt-1">
      <BaseButton type="button" class="h-10" @click="retry">{{ t('invite.tryAgain') }}</BaseButton>
    </div>
    <template #footer>
      <RouterLink to="/login" class="font-medium text-neutral-900 underline-offset-4 hover:underline">{{ t('invite.goToSignIn') }}</RouterLink>
    </template>
  </AuthCard>
</template>
