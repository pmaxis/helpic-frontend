<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { z } from 'zod'
import { useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import InviteUnavailable from '@/components/auth/InviteUnavailable.vue'
import FormError from '@/components/auth/FormError.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import TwoFactorCodeInput from '@/components/auth/TwoFactorCodeInput.vue'
import { useAuthStore } from '@/stores/auth'
import { usePeopleStore } from '@/stores/people'
import { ApiRequestError } from '@/services/api'
import { toast } from '@/composables/useToasts'
import { useForm } from '@/composables/useForm'
import { currentPassword, LIMITS, newPassword, passwordsMatch, requiredText, twoFactorCode } from '@/utils/validation'
import { t } from '@/i18n'
import { linkToken } from '@/utils/linkToken'
import { TWO_FACTOR_REQUIRED } from '@/types/auth'
import type { FreelancerInvitationLookup, InvitationLookup } from '@/types/people'

const auth = useAuthStore()
const people = usePeopleStore()
const route = useRoute()
const router = useRouter()
const token = linkToken(route)
/** A client's invitation, opened by the freelancer; otherwise a freelancer's, opened by the client. */
const forFreelancer = route.name === 'freelancer-invite'

const invitation = ref<InvitationLookup | FreelancerInvitationLookup | null>(null)
/** Who sent it, as the page names them: a client with their company. */
const inviter = computed(() => {
  const inv = invitation.value
  if (!inv) return ''
  if ('freelancer' in inv) return inv.freelancer.name || inv.freelancer.email
  const name = inv.client.name || inv.client.email
  return inv.company ? t('invite.fromCompany', { name, company: inv.company }) : name
})
const subtitle = computed(() => {
  const existing = invitation.value?.account_exists
  if (forFreelancer) return existing ? t('invite.freelancerSubtitleExisting') : t('invite.freelancerSubtitleNew')
  return existing ? t('invite.subtitleExisting') : t('invite.subtitleNew')
})
const invalid = ref('')
/** A 404 means the link itself is dead; anything else is a failed lookup. */
const linkGone = ref(false)
/** The existing account has two-factor on: signing in takes a code too. */
const needsCode = ref(false)
/** An existing account only signs in; a new one needs a name and a confirmed password. */
const schema = computed(() =>
  invitation.value?.account_exists
    ? z.object({
        name: z.string(),
        password: currentPassword(),
        password_confirmation: z.string(),
        code: needsCode.value ? twoFactorCode() : z.string(),
      })
    : z
        .object({
          name: requiredText('name', LIMITS.name),
          password: newPassword(),
          password_confirmation: currentPassword(() => t('validation.confirmPassword')),
          code: z.string(),
        })
        .refine(...passwordsMatch()),
)
const form = useForm(schema, { name: '', password: '', password_confirmation: '', code: '' })

onMounted(async () => {
  try {
    invitation.value = await (forFreelancer ? people.lookupFreelancerInvitation(token) : people.lookupInvitation(token))
    form.values.name = invitation.value.name
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      linkGone.value = true
      invalid.value = error.message
    } else {
      invalid.value = t('invite.loadFailed')
    }
  }
})

function onSubmit() {
  void form.submit(async (data) => {
    let user
    try {
      const payload = invitation.value?.account_exists
        ? { password: data.password, ...(needsCode.value ? { code: data.code } : {}) }
        : { name: data.name, password: data.password, password_confirmation: data.password_confirmation }
      user = await (forFreelancer ? people.acceptFreelancerInvitation(token, payload) : people.acceptInvitation(token, payload))
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === TWO_FACTOR_REQUIRED) {
        needsCode.value = true
        void nextTick(() => document.querySelector<HTMLInputElement>('[data-two-factor-code] input')?.focus())
        return
      }
      throw error
    }
    people.$reset()
    auth.setUser(user)
    toast.success(t('invite.accepted', { name: inviter.value || t(forFreelancer ? 'invite.yourClient' : 'invite.yourFreelancer') }))
    await router.replace('/dashboard')
  })
}
</script>

<template>
  <AuthLayout>
    <InviteUnavailable v-if="invalid" :message="invalid" :gone="linkGone" />

    <AuthCard
      v-else-if="invitation"
      :title="$t('invite.title', { name: inviter })"
      :subtitle="subtitle"
    >
      <form class="space-y-5" novalidate @submit.prevent="onSubmit">
        <p
          v-if="auth.user && auth.user.email !== invitation.email"
          class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-600/20 ring-inset"
        >
          {{ $t('invite.signedInAs', { current: auth.user.email, email: invitation.email }) }}
        </p>
        <FormError :message="form.formError" />

        <BaseInput :model-value="invitation.email" :label="$t('login.email')" type="email" size="lg" disabled />
        <BaseInput
          v-if="!invitation.account_exists"
          v-bind="form.field('name')"
          :label="forFreelancer ? $t('register.name') : $t('invite.nameOrCompany')"
          autocomplete="name"
          size="lg"
        />
        <PasswordInput
          v-bind="form.field('password')"
          :label="$t('login.password')"
          :autocomplete="invitation.account_exists ? 'current-password' : 'new-password'"
          :hint="invitation.account_exists ? undefined : $t('validation.passwordHint', { n: LIMITS.password })"
        />
        <PasswordInput
          v-if="!invitation.account_exists"
          v-bind="form.field('password_confirmation')"
          :label="$t('register.confirmPassword')"
          autocomplete="new-password"
        />
        <TwoFactorCodeInput v-if="needsCode" v-bind="form.field('code')" :label="$t('login.code')" :hint="$t('login.codeHint')" size="lg" />

        <div class="pt-1">
          <BaseButton type="submit" class="h-10" :loading="form.submitting" :disabled="form.submitting">
            {{ invitation.account_exists ? $t('invite.acceptExisting') : $t('invite.acceptNew') }}
          </BaseButton>
        </div>
      </form>
    </AuthCard>
  </AuthLayout>
</template>
