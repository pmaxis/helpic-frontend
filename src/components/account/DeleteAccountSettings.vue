<script setup lang="ts">
/**
 * Settings › Security › Delete account. Asks for the password, and with
 * two-factor on a code too, then signs out and goes to the sign-in page. The
 * work shared with others stays with them; the backend says what goes.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import BaseButton from '@/components/ui/BaseButton.vue'
import ConfirmPasswordModal from '@/components/account/ConfirmPasswordModal.vue'
import ConfirmTwoFactorModal from '@/components/account/ConfirmTwoFactorModal.vue'
import SettingsGroup from '@/components/account/SettingsGroup.vue'
import SettingsRow from '@/components/account/SettingsRow.vue'
import { useAuthStore } from '@/stores/auth'
import type { ApiRequestError } from '@/services/api'
import { toast } from '@/composables/useToasts'
import { forgetAccountData } from '@/composables/useSignOut'
import { t } from '@/i18n'

const auth = useAuthStore()
const router = useRouter()

const confirming = ref(false)

async function remove(input: { current_password: string; code?: string }) {
  await auth.deleteAccount(input)
}

async function deleted() {
  confirming.value = false
  forgetAccountData()
  toast.success(t('settings.deleteAccount.done'))
  await router.replace({ name: 'login' })
}

/** Without two-factor there is no other field to blame. */
function refused(error: ApiRequestError) {
  confirming.value = false
  toast.error(error.message)
}
</script>

<template>
  <SettingsGroup :title="$t('settings.deleteAccount.title')" :description="$t('settings.deleteAccount.text')">
    <SettingsRow
      :label="$t('settings.deleteAccount.label')"
      :hint="auth.isTeamOwner ? $t('settings.deleteAccount.hintOwner') : $t('settings.deleteAccount.hint')"
    >
      <BaseButton variant="danger" size="sm" :block="false" @click="confirming = true">{{ $t('settings.deleteAccount.action') }}</BaseButton>
    </SettingsRow>

    <ConfirmTwoFactorModal
      v-if="confirming && auth.user?.two_factor"
      danger
      :title="$t('settings.deleteAccount.confirmTitle')"
      :description="$t('settings.deleteAccount.confirmTwoFactor')"
      :confirm-label="$t('settings.deleteAccount.action')"
      :action="remove"
      @close="confirming = false"
      @done="deleted"
    />
    <ConfirmPasswordModal
      v-else-if="confirming"
      danger
      :title="$t('settings.deleteAccount.confirmTitle')"
      :description="$t('settings.deleteAccount.confirm')"
      :confirm-label="$t('settings.deleteAccount.action')"
      :action="(password: string) => remove({ current_password: password })"
      @close="confirming = false"
      @done="deleted"
      @failed="refused"
    />
  </SettingsGroup>
</template>
