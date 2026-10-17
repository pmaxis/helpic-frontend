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
import { across, currentPassword, LIMITS, newPassword, requiredText } from '@/utils/validation'
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
    name: requiredText('Name', LIMITS.name),
    password: newPassword(),
    password_confirmation: currentPassword('Please confirm your password'),
  })
  .refine(...across('password_confirmation', (v) => v.password === v.password_confirmation, 'Passwords do not match'))
const form = useForm(schema, { name: '', password: '', password_confirmation: '' })

onMounted(async () => {
  try {
    invite.value = await lookupTeamInvite(token)
    form.values.name = invite.value.name
  } catch (error) {
    invalid.value =
      error instanceof ApiRequestError && error.status === 404 ? error.message : 'Could not load the invitation. Please try again.'
  }
})

function company(): string {
  const i = invite.value
  if (!i) return ''
  return i.company || `${i.owner.name || i.owner.email}'s team`
}

function onSubmit() {
  void form.submit(async (data) => {
    const user = await joinTeam(token, data)
    people.$reset()
    auth.setUser(user)
    toast.success(`You've joined ${company()}`)
    await router.replace('/dashboard')
  })
}
</script>

<template>
  <AuthLayout>
    <AuthCard v-if="invalid" title="Invitation unavailable" :subtitle="invalid">
      <template #footer>
        <RouterLink to="/login" class="font-medium text-neutral-900 underline-offset-4 hover:underline">Go to sign in</RouterLink>
      </template>
    </AuthCard>

    <AuthCard
      v-else-if="invite"
      :title="`Join ${company()}`"
      :subtitle="`${invite.owner.name || invite.owner.email} invited you. You'll work with the company's freelancers and set tasks for them.`"
    >
      <form class="space-y-5" novalidate @submit.prevent="onSubmit">
        <p
          v-if="auth.user"
          class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-600/20 ring-inset"
        >
          You're signed in as {{ auth.user.email }}. Joining creates a new account for {{ invite.email }} and signs you in to it.
        </p>
        <FormError :message="form.formError" />

        <BaseInput :model-value="invite.email" label="Email" type="email" size="lg" disabled />
        <BaseInput v-bind="form.field('name')" label="Your name" autocomplete="name" size="lg" />
        <PasswordInput v-bind="form.field('password')" label="Password" autocomplete="new-password" :hint="`At least ${LIMITS.password} characters.`" />
        <PasswordInput v-bind="form.field('password_confirmation')" label="Confirm password" autocomplete="new-password" />

        <div class="pt-1">
          <BaseButton type="submit" class="h-10" :loading="form.submitting" :disabled="form.submitting">Join the team</BaseButton>
        </div>
      </form>
    </AuthCard>
  </AuthLayout>
</template>
