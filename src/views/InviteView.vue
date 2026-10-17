<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
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
import type { InvitationLookup } from '@/types/people'

const MIN_PASSWORD = 8

const auth = useAuthStore()
const people = usePeopleStore()
const route = useRoute()
const router = useRouter()
const token = String(route.params.token)

const invitation = ref<InvitationLookup | null>(null)
const invalid = ref('')
const form = reactive({ name: '', password: '', password_confirmation: '' })
const fieldErrors = reactive<Record<string, string>>({})
const formError = ref('')
const saving = ref(false)

onMounted(async () => {
  try {
    invitation.value = await people.lookupInvitation(token)
    form.name = invitation.value.name
  } catch (error) {
    invalid.value =
      error instanceof ApiRequestError && error.status === 404
        ? error.message
        : 'Could not load the invitation. Please try again.'
  }
})

function validate(): boolean {
  for (const k of Object.keys(fieldErrors)) fieldErrors[k] = ''
  if (!form.password) fieldErrors.password = 'Password is required'
  if (!invitation.value?.account_exists) {
    if (!form.name.trim()) fieldErrors.name = 'Name is required'
    if (form.password && form.password.length < MIN_PASSWORD)
      fieldErrors.password = `Password must be at least ${MIN_PASSWORD} characters`
    if (form.password !== form.password_confirmation) fieldErrors.password_confirmation = 'Passwords do not match'
  }
  return !Object.values(fieldErrors).some(Boolean)
}

async function onSubmit() {
  formError.value = ''
  if (!validate()) return
  saving.value = true
  try {
    const user = await people.acceptInvitation(
      token,
      invitation.value?.account_exists
        ? { password: form.password }
        : { name: form.name.trim(), password: form.password, password_confirmation: form.password_confirmation },
    )
    people.$reset()
    auth.setUser(user)
    toast.success(`You're now working with ${invitation.value?.freelancer.name || 'your freelancer'}`)
    await router.replace('/dashboard')
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (error.fields) Object.assign(fieldErrors, error.fields)
      formError.value = error.fields ? '' : error.message
    } else {
      formError.value = 'Something went wrong. Please try again.'
    }
  } finally {
    saving.value = false
  }
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
        <FormError :message="formError" />

        <BaseInput :model-value="invitation.email" label="Email" type="email" size="lg" disabled />
        <BaseInput
          v-if="!invitation.account_exists"
          v-model="form.name"
          label="Your name or company"
          autocomplete="name"
          size="lg"
          :error="fieldErrors.name"
          required
        />
        <PasswordInput
          v-model="form.password"
          label="Password"
          :autocomplete="invitation.account_exists ? 'current-password' : 'new-password'"
          :hint="invitation.account_exists ? undefined : `At least ${MIN_PASSWORD} characters.`"
          :error="fieldErrors.password"
        />
        <PasswordInput
          v-if="!invitation.account_exists"
          v-model="form.password_confirmation"
          label="Confirm password"
          autocomplete="new-password"
          :error="fieldErrors.password_confirmation"
        />

        <div class="pt-1">
          <BaseButton type="submit" class="h-10" :loading="saving" :disabled="saving">
            {{ invitation.account_exists ? 'Sign in and accept' : 'Create account' }}
          </BaseButton>
        </div>
      </form>
    </AuthCard>
  </AuthLayout>
</template>
