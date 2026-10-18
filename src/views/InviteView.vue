<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { z } from 'zod'
import { useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import InviteUnavailable from '@/components/auth/InviteUnavailable.vue'
import FormError from '@/components/auth/FormError.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import { useAuthStore } from '@/stores/auth'
import { usePeopleStore } from '@/stores/people'
import { ApiRequestError } from '@/services/api'
import { toast } from '@/composables/useToasts'
import { useForm } from '@/composables/useForm'
import { currentPassword, LIMITS, newPassword, passwordsMatch, requiredText } from '@/utils/validation'
import { t } from '@/i18n'
import { linkToken } from '@/utils/linkToken'
import type { InvitationLookup } from '@/types/people'

const auth = useAuthStore()
const people = usePeopleStore()
const route = useRoute()
const router = useRouter()
const token = linkToken(route)

const invitation = ref<InvitationLookup | null>(null)
const invalid = ref('')
/** A 404 means the link itself is dead; anything else is a failed lookup. */
const linkGone = ref(false)
/** An existing account only signs in; a new one needs a name and a confirmed password. */
const schema = computed(() =>
  invitation.value?.account_exists
    ? z.object({ name: z.string(), password: currentPassword(), password_confirmation: z.string() })
    : z
        .object({
          name: requiredText('name', LIMITS.name),
          password: newPassword(),
          password_confirmation: currentPassword(() => t('validation.confirmPassword')),
        })
        .refine(...passwordsMatch()),
)
const form = useForm(schema, { name: '', password: '', password_confirmation: '' })

onMounted(async () => {
  try {
    invitation.value = await people.lookupInvitation(token)
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
    const user = await people.acceptInvitation(
      token,
      invitation.value?.account_exists
        ? { password: data.password }
        : { name: data.name, password: data.password, password_confirmation: data.password_confirmation },
    )
    people.$reset()
    auth.setUser(user)
    toast.success(t('invite.accepted', { name: invitation.value?.freelancer.name || t('invite.yourFreelancer') }))
    await router.replace('/dashboard')
  })
}
</script>

<template>
  <AuthLayout>
    <InviteUnavailable v-if="invalid" :message="invalid" :gone="linkGone" />

    <AuthCard
      v-else-if="invitation"
      :title="$t('invite.title', { name: invitation.freelancer.name || invitation.freelancer.email })"
      :subtitle="invitation.account_exists ? $t('invite.subtitleExisting') : $t('invite.subtitleNew')"
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
          :label="$t('invite.nameOrCompany')"
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

        <div class="pt-1">
          <BaseButton type="submit" class="h-10" :loading="form.submitting" :disabled="form.submitting">
            {{ invitation.account_exists ? $t('invite.acceptExisting') : $t('invite.acceptNew') }}
          </BaseButton>
        </div>
      </form>
    </AuthCard>
  </AuthLayout>
</template>
