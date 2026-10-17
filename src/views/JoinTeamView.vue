<script setup lang="ts">
/** The page an invited member opens: they set their name and password and join the company with a new account. */
import { onMounted, ref } from 'vue'
import { z } from 'zod'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AuthLayout from '@/layouts/AuthLayout.vue'
import AuthCard from '@/components/auth/AuthCard.vue'
import FormError from '@/components/auth/FormError.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import { useAuthStore } from '@/stores/auth'
import { usePeopleStore } from '@/stores/people'
import { ApiRequestError } from '@/services/api'
import { joinTeam, lookupTeamInvite } from '@/services/team'
import { toast } from '@/composables/useToasts'
import { useForm } from '@/composables/useForm'
import { currentPassword, LIMITS, newPassword, passwordsMatch, requiredText } from '@/utils/validation'
import { t } from '@/i18n'
import type { TeamInviteLookup } from '@/types/team'

const auth = useAuthStore()
const people = usePeopleStore()
const route = useRoute()
const router = useRouter()
const token = String(route.params.token)

const invite = ref<TeamInviteLookup | null>(null)
const invalid = ref('')
const schema = z
  .object({
    name: requiredText('name', LIMITS.name),
    password: newPassword(),
    password_confirmation: currentPassword(() => t('validation.confirmPassword')),
  })
  .refine(...passwordsMatch())
const form = useForm(schema, { name: '', password: '', password_confirmation: '' })

onMounted(async () => {
  try {
    invite.value = await lookupTeamInvite(token)
    form.values.name = invite.value.name
  } catch (error) {
    invalid.value =
      error instanceof ApiRequestError && error.status === 404 ? error.message : t('invite.loadFailed')
  }
})

function company(): string {
  const i = invite.value
  if (!i) return ''
  return i.company || t('joinTeam.teamOf', { name: i.owner.name || i.owner.email })
}

function onSubmit() {
  void form.submit(async (data) => {
    const user = await joinTeam(token, data)
    people.$reset()
    auth.setUser(user)
    toast.success(t('joinTeam.joined', { company: company() }))
    await router.replace('/dashboard')
  })
}
</script>

<template>
  <AuthLayout>
    <AuthCard v-if="invalid" :title="$t('invite.unavailable')" :subtitle="invalid">
      <template #footer>
        <RouterLink to="/login" class="font-medium text-neutral-900 underline-offset-4 hover:underline">{{ $t('invite.goToSignIn') }}</RouterLink>
      </template>
    </AuthCard>

    <AuthCard
      v-else-if="invite"
      :title="$t('joinTeam.title', { company: company() })"
      :subtitle="$t('joinTeam.subtitle', { owner: invite.owner.name || invite.owner.email })"
    >
      <form class="space-y-5" novalidate @submit.prevent="onSubmit">
        <p
          v-if="auth.user"
          class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-600/20 ring-inset"
        >
          {{ $t('joinTeam.signedInAs', { current: auth.user.email, email: invite.email }) }}
        </p>
        <FormError :message="form.formError" />

        <BaseInput :model-value="invite.email" :label="$t('login.email')" type="email" size="lg" disabled />
        <BaseInput v-bind="form.field('name')" :label="$t('register.name')" autocomplete="name" size="lg" />
        <PasswordInput
          v-bind="form.field('password')"
          :label="$t('login.password')"
          autocomplete="new-password"
          :hint="$t('validation.passwordHint', { n: LIMITS.password })"
        />
        <PasswordInput v-bind="form.field('password_confirmation')" :label="$t('register.confirmPassword')" autocomplete="new-password" />

        <div class="pt-1">
          <BaseButton type="submit" class="h-10" :loading="form.submitting" :disabled="form.submitting">{{ $t('joinTeam.submit') }}</BaseButton>
        </div>
      </form>
    </AuthCard>
  </AuthLayout>
</template>
