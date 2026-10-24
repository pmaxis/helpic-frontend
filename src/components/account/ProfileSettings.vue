<script setup lang="ts">
/** Settings › Profile: who you are, and how Helpic looks and counts for you. */
import { computed, ref } from 'vue'
import { z } from 'zod'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import SelectInput from '@/components/ui/SelectInput.vue'
import FormError from '@/components/auth/FormError.vue'
import SettingsGroup from '@/components/account/SettingsGroup.vue'
import SettingsRow from '@/components/account/SettingsRow.vue'
import RateInput from '@/components/account/RateInput.vue'
import { useAuthStore } from '@/stores/auth'
import { ApiRequestError } from '@/services/api'
import { toast } from '@/composables/useToasts'
import { useForm } from '@/composables/useForm'
import { THEMES, useTheme } from '@/composables/useTheme'
import { LIMITS, optionalText, requiredText } from '@/utils/validation'
import { isLocale, LOCALE_NAMES, LOCALES, t } from '@/i18n'
import { useI18n } from 'vue-i18n'
import { CURRENCIES } from '@/utils/money'

const auth = useAuthStore()

// --- who you are -------------------------------------------------------------

/** The account's role, and for a team member the company. */
const roleText = computed(() => {
  const u = auth.user
  if (!u) return ''
  if (auth.isAdmin) return t('project.roles.admin')
  if (auth.isFreelancer) return t('project.roles.freelancer')
  if (u.member_of) return `${t(`project.roles.${u.member_of.role}`)} · ${u.member_of.name}`
  return t('project.roles.owner')
})

// --- name -------------------------------------------------------------------

const nameForm = useForm(z.object({ first_name: requiredText('firstName', LIMITS.name), last_name: optionalText('lastName', LIMITS.name) }), {
  first_name: auth.user?.first_name ?? '',
  last_name: auth.user?.last_name ?? '',
})

/** The name has edits to save: only then is there a Save button. */
const nameDirty = computed(
  () => nameForm.values.first_name.trim() !== (auth.user?.first_name ?? '') || nameForm.values.last_name.trim() !== (auth.user?.last_name ?? ''),
)

function saveName() {
  void nameForm.submit(async (data) => {
    await auth.updateName(data.first_name, data.last_name)
    toast.success(t('settings.profile.nameUpdated'))
  })
}

// --- language ---------------------------------------------------------------------

const { locale } = useI18n()
const localeOptions = LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] }))
const savingLocale = ref(false)

/** Switches at once; the account keeps it for emails and Telegram. */
async function saveLocale(value: string) {
  if (!isLocale(value) || value === locale.value) return
  savingLocale.value = true
  try {
    await auth.setLocale(value)
    toast.success(t('settings.profile.languageChanged'))
  } catch (error) {
    toast.error(error instanceof ApiRequestError ? error.message : t('errors.generic'))
  } finally {
    savingLocale.value = false
  }
}

// --- theme --------------------------------------------------------------------

const { theme, isTheme } = useTheme()
const themeOptions = computed(() => THEMES.map((value) => ({ value, label: t(`settings.groups.themes.${value}`) })))

/** Kept on this device only, so it switches without a request. */
function saveTheme(value: string) {
  if (isTheme(value)) theme.value = value
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
    toast.success(t('settings.profile.currencyChanged', { currency }))
  } catch (error) {
    const field = error instanceof ApiRequestError ? error.fields?.currency : undefined
    toast.error(field ?? (error instanceof ApiRequestError ? error.message : t('settings.profile.currencyFailed')))
  } finally {
    savingCurrency.value = false
  }
}

// --- hourly rate (freelancers) --------------------------------------------------

const savingRate = ref(false)
const rateError = ref('')

/** Saved as soon as it's typed; tasks billed by the hour are priced at it. */
async function saveRate(rate: string | null) {
  savingRate.value = true
  rateError.value = ''
  try {
    await auth.setHourlyRate(rate)
    toast.success(t('timelog.rateChanged'))
  } catch (error) {
    const field = error instanceof ApiRequestError ? error.fields?.rate : undefined
    if (field) rateError.value = field
    else toast.error(error instanceof ApiRequestError ? error.message : t('timelog.rateFailed'))
  } finally {
    savingRate.value = false
  }
}
</script>

<template>
  <SettingsGroup :title="$t('settings.groups.profile')" :description="$t('settings.groups.profileText')">
    <SettingsRow :label="$t('settings.groups.name')" :hint="auth.isClient ? $t('settings.groups.nameTextClient') : $t('settings.groups.nameText')">
      <template #below>
        <form class="space-y-4" novalidate @submit.prevent="saveName">
          <FormError :message="nameForm.formError" />
          <div class="grid gap-4 sm:grid-cols-2">
            <BaseInput
              v-bind="nameForm.field('first_name')"
              :label="auth.isClient ? $t('settings.profile.firstNameOrCompany') : $t('settings.profile.firstName')"
              autocomplete="given-name"
            />
            <BaseInput v-bind="nameForm.field('last_name')" :label="$t('settings.profile.lastName')" autocomplete="family-name" />
          </div>
          <div v-if="nameDirty || nameForm.submitting" class="flex justify-end gap-2">
            <BaseButton
              variant="ghost"
              size="sm"
              :block="false"
              :disabled="nameForm.submitting"
              @click="nameForm.reset({ first_name: auth.user?.first_name ?? '', last_name: auth.user?.last_name ?? '' })"
            >
              {{ $t('common.cancel') }}
            </BaseButton>
            <BaseButton type="submit" size="sm" :block="false" :loading="nameForm.submitting" :disabled="nameForm.submitting">{{
              $t('common.save')
            }}</BaseButton>
          </div>
        </form>
      </template>
    </SettingsRow>

    <SettingsRow :label="$t('settings.groups.account')" :hint="$t('settings.groups.accountText')">
      <span class="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">{{ roleText }}</span>
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup :title="$t('settings.groups.preferences')">
    <SettingsRow :label="$t('common.language')" :hint="$t('settings.groups.languageText')">
      <SelectInput
        class="w-44"
        :class="savingLocale ? 'pointer-events-none opacity-60' : ''"
        :model-value="locale"
        :options="localeOptions"
        :aria-label="$t('common.language')"
        @update:model-value="saveLocale"
      />
    </SettingsRow>
    <SettingsRow :label="$t('settings.groups.theme')" :hint="$t('settings.groups.themeText')">
      <SelectInput
        class="w-44"
        :model-value="theme"
        :options="themeOptions"
        :aria-label="$t('settings.groups.theme')"
        @update:model-value="saveTheme"
      />
    </SettingsRow>
    <SettingsRow v-if="auth.isFreelancer" :label="$t('settings.profile.currency')" :hint="$t('settings.groups.currencyText')">
      <SelectInput
        class="w-44"
        :class="savingCurrency ? 'pointer-events-none opacity-60' : ''"
        :model-value="auth.user?.currency ?? 'USD'"
        :options="currencyOptions"
        :aria-label="$t('settings.profile.currency')"
        @update:model-value="saveCurrency"
      />
    </SettingsRow>
    <SettingsRow v-if="auth.isFreelancer" :label="$t('timelog.rate')" :hint="$t('timelog.rateText')">
      <RateInput
        class="w-44"
        :cents="auth.user?.hourly_rate_cents ?? null"
        :currency="auth.user?.currency ?? 'USD'"
        :label="$t('timelog.rate')"
        :saving="savingRate"
        :error="rateError"
        @save="saveRate"
      />
    </SettingsRow>
  </SettingsGroup>
</template>
