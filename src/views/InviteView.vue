<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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
import { toast } from '@/composables/useToasts'
import { useForm } from '@/composables/useForm'
import { across, currentPassword, LIMITS, newPassword, requiredText } from '@/utils/validation'
import type { InvitationLookup } from '@/types/people'

const auth = useAuthStore()
const people = usePeopleStore()
const route = useRoute()
const router = useRouter()
const token = String(route.params.token)

const invitation = ref<InvitationLookup | null>(null)
const invalid = ref('')
/** An existing account only signs in; a new one needs a name and a confirmed password. */
const schema = computed(() =>
  invitation.value?.account_exists
    ? z.object({ name: z.string(), password: currentPassword(), password_confirmation: z.string() })
    : z
        .object({
          name: requiredText('Name', LIMITS.name),
          password: newPassword(),
          password_confirmation: currentPassword('Please confirm your password'),
        })
        .refine(...across('password_confirmation', (v) => v.password === v.password_confirmation, 'Passwords do not match')),
)
const form = useForm(schema, { name: '', password: '', password_confirmation: '' })

onMounted(async () => {
  try {
    invitation.value = await people.lookupInvitation(token)
    form.values.name = invitation.value.name
  } catch (error) {
    invalid.value =
      error instanceof ApiRequestError && error.status === 404
        ? error.message
        : 'Could not load the invitation. Please try again.'
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
    toast.success(`You're now working with ${invitation.value?.freelancer.name || 'your freelancer'}`)
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
      v-else-if="invitation"
      :title="`${invitation.freelancer.name || invitation.freelancer.email} invited you`"
      :subtitle="
        invitation.account_exists
          ? 'Enter your password to accept. You will be able to set tasks for this freelancer too.'
          : 'Set a password to create your client account and start setting tasks.'
      "
    >
      <form class="space-y-5" novalidate @submit.prevent="onSubmit">
        <p
          v-if="auth.user && auth.user.email !== invitation.email"
          class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-600/20 ring-inset"
        >
          You're signed in as {{ auth.user.email }}. Accepting signs you in as {{ invitation.email }}.
        </p>
        <FormError :message="form.formError" />

        <BaseInput :model-value="invitation.email" label="Email" type="email" size="lg" disabled />
        <BaseInput
          v-if="!invitation.account_exists"
          v-bind="form.field('name')"
          label="Your name or company"
          autocomplete="name"
          size="lg"
        />
        <PasswordInput
          v-bind="form.field('password')"
          label="Password"
          :autocomplete="invitation.account_exists ? 'current-password' : 'new-password'"
          :hint="invitation.account_exists ? undefined : `At least ${LIMITS.password} characters.`"
        />
        <PasswordInput
          v-if="!invitation.account_exists"
          v-bind="form.field('password_confirmation')"
          label="Confirm password"
          autocomplete="new-password"
        />

        <div class="pt-1">
          <BaseButton type="submit" class="h-10" :loading="form.submitting" :disabled="form.submitting">
            {{ invitation.account_exists ? 'Sign in and accept' : 'Create account' }}
          </BaseButton>
        </div>
      </form>
    </AuthCard>
  </AuthLayout>
</template>
