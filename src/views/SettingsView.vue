<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DashboardLayout from '@/layouts/DashboardLayout.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import PasswordInput from '@/components/auth/PasswordInput.vue'
import FormError from '@/components/auth/FormError.vue'
import { useAuthStore } from '@/stores/auth'
import { ApiRequestError } from '@/services/api'
import { toast } from '@/composables/useToasts'
import { CURRENCIES } from '@/utils/money'

const MIN_PASSWORD = 8

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const TABS = [
  { value: 'profile', label: 'Profile' },
  { value: 'email', label: 'Email' },
  { value: 'password', label: 'Password' },
] as const
type Tab = (typeof TABS)[number]['value']

/** The open tab lives in the URL (?tab=email) so it survives a reload and can be linked to. */
const tab = computed<Tab>({
  get: () => TABS.find((t) => t.value === route.query.tab)?.value ?? 'profile',
  set: (value) => void router.replace({ query: { ...route.query, tab: value === 'profile' ? undefined : value } }),
})

/** One form's state: values, per-field errors, a form-level error and a busy flag. */
function useForm<T extends Record<string, string>>(initial: T) {
  return reactive({
    values: { ...initial },
    errors: {} as Record<string, string>,
    error: '',
    saving: false,
  })
}

async function submit(form: ReturnType<typeof useForm>, action: () => Promise<void>, done: string): Promise<boolean> {
  form.error = ''
  if (Object.values(form.errors).some(Boolean)) return false
  form.saving = true
  try {
    await action()
    toast.success(done)
    return true
  } catch (error) {
    if (error instanceof ApiRequestError) {
      if (error.fields) Object.assign(form.errors, error.fields)
      form.error = error.fields ? '' : error.message
    } else {
      form.error = 'Something went wrong. Please try again.'
    }
    return false
  } finally {
    form.saving = false
  }
}

// --- name -------------------------------------------------------------------

const nameForm = useForm({ first_name: auth.user?.first_name ?? '', last_name: auth.user?.last_name ?? '' })

async function saveName() {
  const v = nameForm.values
  nameForm.errors = { first_name: v.first_name.trim() ? '' : 'First name is required' }
  await submit(nameForm, () => auth.updateName(v.first_name.trim(), v.last_name.trim()), 'Name updated')
}

// --- currency (freelancers) ---------------------------------------------------

const currencyOptions = CURRENCIES.map((c) => ({ value: c, label: c }))
const savingCurrency = ref(false)

/** Saved as soon as it's picked. */
async function saveCurrency(currency: string) {
  if (currency === auth.user?.currency) return
  savingCurrency.value = true
  try {
    await auth.setCurrency(currency)
    toast.success(`Prices are now in ${currency}`)
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : 'Could not change the currency')
  } finally {
    savingCurrency.value = false
  }
}

// --- email ------------------------------------------------------------------

const emailForm = useForm({ email: auth.user?.email ?? '', current_password: '' })

async function saveEmail() {
  emailForm.errors = {
    email: emailForm.values.email.trim() ? '' : 'Email is required',
    current_password: emailForm.values.current_password ? '' : 'Enter your current password',
  }
  const ok = await submit(
    emailForm,
    () => auth.changeEmail({ email: emailForm.values.email.trim(), current_password: emailForm.values.current_password }),
    'Email updated',
  )
  if (ok) {
    emailForm.values.email = auth.user?.email ?? ''
    emailForm.values.current_password = ''
  }
}

// --- password ---------------------------------------------------------------

const passwordForm = useForm({ current_password: '', password: '', password_confirmation: '' })
const passwordKey = ref(0)

async function savePassword() {
  const v = passwordForm.values
  passwordForm.errors = {
    current_password: v.current_password ? '' : 'Enter your current password',
    password: !v.password
      ? 'Enter a new password'
      : v.password.length < MIN_PASSWORD
        ? `Password must be at least ${MIN_PASSWORD} characters`
        : '',
    password_confirmation: v.password !== v.password_confirmation ? 'Passwords do not match' : '',
  }
  const ok = await submit(passwordForm, () => auth.changePassword({ ...v }), 'Password changed')
  if (ok) {
    passwordForm.values = { current_password: '', password: '', password_confirmation: '' }
    passwordKey.value++
  }
}
</script>

<template>
  <DashboardLayout>
    <PageHeader title="Settings" />

    <nav class="mt-5 flex gap-6 border-b border-neutral-200" aria-label="Settings sections">
      <button
        v-for="t in TABS"
        :key="t.value"
        type="button"
        class="-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors"
        :class="tab === t.value ? 'border-neutral-900 text-neutral-900' : 'border-transparent text-neutral-500 hover:text-neutral-900'"
        :aria-current="tab === t.value ? 'page' : undefined"
        @click="tab = t.value"
      >
        {{ t.label }}
      </button>
    </nav>

    <div class="mt-6">
      <template v-if="tab === 'profile'">
        <section class="rounded-xl border border-neutral-200 p-5">
          <p class="text-sm text-neutral-500">
            {{ auth.isClient ? 'Your freelancers see this name.' : 'Your clients see this name.' }}
          </p>
          <form class="mt-4 space-y-4" novalidate @submit.prevent="saveName">
            <FormError :message="nameForm.error" />
            <div class="grid gap-4 sm:grid-cols-2">
              <BaseInput
                v-model="nameForm.values.first_name"
                :label="auth.isClient ? 'First name or company' : 'First name'"
                autocomplete="given-name"
                :error="nameForm.errors.first_name"
              />
              <BaseInput v-model="nameForm.values.last_name" label="Last name" autocomplete="family-name" :error="nameForm.errors.last_name" />
            </div>
            <div class="flex justify-end">
              <BaseButton type="submit" size="sm" :block="false" :loading="nameForm.saving" :disabled="nameForm.saving">Save</BaseButton>
            </div>
          </form>
        </section>

        <section v-if="auth.isFreelancer" class="mt-4 rounded-xl border border-neutral-200 p-5">
          <p class="text-sm text-neutral-500">Task prices and report totals use this currency. Sent reports keep the one they were sent in.</p>
          <div class="mt-4 sm:w-56">
            <BaseSelect
              :model-value="auth.user?.currency ?? 'USD'"
              label="Currency"
              :options="currencyOptions"
              :class="savingCurrency ? 'pointer-events-none opacity-60' : ''"
              @update:model-value="saveCurrency"
            />
          </div>
        </section>
      </template>

      <section v-else-if="tab === 'email'" class="rounded-xl border border-neutral-200 p-5">
        <p class="text-sm text-neutral-500">You sign in with this email.</p>
        <form class="mt-4 space-y-4" novalidate @submit.prevent="saveEmail">
          <FormError :message="emailForm.error" />
          <BaseInput v-model="emailForm.values.email" label="Email" type="email" autocomplete="email" :error="emailForm.errors.email" />
          <PasswordInput
            v-model="emailForm.values.current_password"
            label="Current password"
            autocomplete="current-password"
            :error="emailForm.errors.current_password"
          />
          <div class="flex justify-end">
            <BaseButton type="submit" size="sm" :block="false" :loading="emailForm.saving" :disabled="emailForm.saving">Change email</BaseButton>
          </div>
        </form>
      </section>

      <section v-else class="rounded-xl border border-neutral-200 p-5">
        <p class="text-sm text-neutral-500">Confirm the change with your current password.</p>
        <form :key="passwordKey" class="mt-4 space-y-4" novalidate @submit.prevent="savePassword">
          <FormError :message="passwordForm.error" />
          <PasswordInput
            v-model="passwordForm.values.current_password"
            label="Current password"
            autocomplete="current-password"
            :error="passwordForm.errors.current_password"
          />
          <PasswordInput
            v-model="passwordForm.values.password"
            label="New password"
            autocomplete="new-password"
            :hint="`At least ${MIN_PASSWORD} characters.`"
            :error="passwordForm.errors.password"
          />
          <PasswordInput
            v-model="passwordForm.values.password_confirmation"
            label="Confirm new password"
            autocomplete="new-password"
            :error="passwordForm.errors.password_confirmation"
          />
          <div class="flex justify-end">
            <BaseButton type="submit" size="sm" :block="false" :loading="passwordForm.saving" :disabled="passwordForm.saving">
              Change password
            </BaseButton>
          </div>
        </form>
      </section>
    </div>
  </DashboardLayout>
</template>
